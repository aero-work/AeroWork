// Desktop-only modules
#[cfg(not(target_os = "android"))]
pub mod acp;
#[cfg(not(target_os = "android"))]
pub mod commands;
#[cfg(all(feature = "websocket", not(target_os = "android")))]
pub mod server;

pub mod core;

use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Check if running in headless environment (no display available)
#[cfg(not(target_os = "android"))]
pub fn is_headless() -> bool {
    // Check for --headless flag
    if std::env::args().any(|arg| arg == "--headless") {
        return true;
    }

    // On Linux, check DISPLAY and WAYLAND_DISPLAY
    #[cfg(target_os = "linux")]
    {
        let has_display = std::env::var("DISPLAY").is_ok() || std::env::var("WAYLAND_DISPLAY").is_ok();
        if !has_display {
            return true;
        }
    }

    false
}

use crate::core::AppState;

/// Headless mode - WebSocket server + Web client server, no GUI
#[cfg(all(feature = "websocket", not(target_os = "android")))]
pub fn run_headless() {
    use tokio::runtime::Runtime;
    use std::net::SocketAddr;
    use axum::Router;
    use tower_http::services::{ServeDir, ServeFile};

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aero_work=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let rt = Runtime::new().expect("Failed to create tokio runtime");
    rt.block_on(async {
        // Parse ports from args or env
        let ws_port: u16 = parse_arg_or_env("--ws-port", "AERO_WS_PORT", 9527);
        let web_port: u16 = parse_arg_or_env("--web-port", "AERO_WEB_PORT", 1420);

        // Find web assets directory
        let web_dir = find_web_assets_dir();

        // Create app state
        let state = Arc::new(AppState::new());

        // Drain notification channels (forwarded via WebSocket broadcast)
        let notification_rx = state.notification_rx.write().take();
        if let Some(mut rx) = notification_rx {
            tokio::spawn(async move {
                while rx.recv().await.is_some() {}
            });
        }

        let permission_rx = state.permission_rx.write().take();
        if let Some(mut rx) = permission_rx {
            tokio::spawn(async move {
                while rx.recv().await.is_some() {}
            });
        }

        let terminal_rx = state.terminal_output_rx.write().take();
        if let Some(mut rx) = terminal_rx {
            tokio::spawn(async move {
                while rx.recv().await.is_some() {}
            });
        }

        // Start WebSocket server
        let ws_server = server::WebSocketServer::new(state);
        let actual_ws_port = match ws_server.start(ws_port).await {
            Ok(port) => port,
            Err(e) => {
                eprintln!("Failed to start WebSocket server: {}", e);
                std::process::exit(1);
            }
        };

        // Start Web client server if assets directory exists
        let actual_web_port = if let Some(dir) = web_dir {
            let index_file = dir.join("index.html");

            // SPA fallback: serve index.html for all non-file routes
            let serve_dir = ServeDir::new(&dir)
                .not_found_service(ServeFile::new(&index_file));

            let app = Router::new()
                .fallback_service(serve_dir);

            let addr = SocketAddr::from(([0, 0, 0, 0], web_port));
            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("Failed to bind web server to port {}: {}", web_port, e);
                    std::process::exit(1);
                }
            };
            let actual_port = listener.local_addr().unwrap().port();

            tokio::spawn(async move {
                axum::serve(listener, app).await.ok();
            });

            Some(actual_port)
        } else {
            tracing::warn!("Web assets directory not found, web client server disabled");
            None
        };

        // Print startup info
        println!();
        println!("╔════════════════════════════════════════════════════════╗");
        println!("║           Aero Work - Headless Mode                    ║");
        println!("╠════════════════════════════════════════════════════════╣");
        if let Some(web_port) = actual_web_port {
            println!("║  Web Client:       http://0.0.0.0:{:<5}               ║", web_port);
        }
        println!("║  WebSocket Server: ws://0.0.0.0:{:<5}/ws              ║", actual_ws_port);
        println!("║                                                        ║");
        if actual_web_port.is_some() {
            println!("║  Open the Web Client URL in your browser to start.    ║");
        } else {
            println!("║  Web assets not found. Build with: bun run build      ║");
            println!("║  Or connect mobile app to the WebSocket URL.          ║");
        }
        println!("║                                                        ║");
        println!("║  Press Ctrl+C to stop                                  ║");
        println!("╚════════════════════════════════════════════════════════╝");
        println!();

        // Keep running until interrupted
        tokio::signal::ctrl_c().await.ok();
        println!("\nShutting down...");
    });
}

/// Parse command line argument or environment variable
#[cfg(all(feature = "websocket", not(target_os = "android")))]
fn parse_arg_or_env(arg_name: &str, env_name: &str, default: u16) -> u16 {
    std::env::args()
        .skip_while(|arg| arg != arg_name)
        .nth(1)
        .and_then(|p| p.parse().ok())
        .or_else(|| std::env::var(env_name).ok().and_then(|p| p.parse().ok()))
        .unwrap_or(default)
}

/// Find web assets directory (dist folder with index.html)
#[cfg(all(feature = "websocket", not(target_os = "android")))]
fn find_web_assets_dir() -> Option<std::path::PathBuf> {
    use std::path::PathBuf;

    // Check common locations
    let candidates = [
        // Relative to executable
        std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.join("dist"))),
        std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.join("../dist"))),
        std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.join("../../dist"))),
        // Relative to current directory
        Some(PathBuf::from("dist")),
        Some(PathBuf::from("../dist")),
        // Explicit env var
        std::env::var("AERO_WEB_DIR").ok().map(PathBuf::from),
    ];

    for candidate in candidates.into_iter().flatten() {
        let index = candidate.join("index.html");
        if index.exists() {
            tracing::info!("Found web assets at: {}", candidate.display());
            return Some(candidate);
        }
    }

    None
}

/// Desktop entry point - full featured with agent, terminal, WebSocket server
#[cfg(not(target_os = "android"))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;
    use crate::commands::{
        cancel_session, connect_agent, create_directory, create_file, create_session, delete_path,
        disconnect_agent, initialize_agent, list_directory, read_file, rename_path, respond_permission,
        send_prompt, set_session_mode, write_file,
        resume_session, fork_session, list_sessions, get_session_info,
        create_terminal, write_terminal, resize_terminal, kill_terminal, list_terminals,
    };

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aero_work=debug,tauri=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = Arc::new(AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            connect_agent,
            disconnect_agent,
            initialize_agent,
            create_session,
            send_prompt,
            cancel_session,
            set_session_mode,
            respond_permission,
            // Session management
            resume_session,
            fork_session,
            list_sessions,
            get_session_info,
            // File operations
            list_directory,
            read_file,
            write_file,
            create_file,
            create_directory,
            delete_path,
            rename_path,
            // Terminal operations
            create_terminal,
            write_terminal,
            resize_terminal,
            kill_terminal,
            list_terminals,
        ])
        .setup(|app| {
            // Start WebSocket server if enabled
            #[cfg(feature = "websocket")]
            {
                let ws_state = app.state::<Arc<AppState>>().inner().clone();
                let preferred_port = std::env::var("AERO_WS_PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or(9527);

                tauri::async_runtime::spawn(async move {
                    let server = server::WebSocketServer::new(ws_state.clone());
                    match server.start(preferred_port).await {
                        Ok(actual_port) => {
                            ws_state.set_ws_port(actual_port);
                            tracing::info!("WebSocket server started on port {}", actual_port);
                        }
                        Err(e) => {
                            tracing::error!("WebSocket server error: {}", e);
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Mobile entry point - WebView only, connects to desktop server
#[cfg(target_os = "android")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aero_work=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = Arc::new(AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
