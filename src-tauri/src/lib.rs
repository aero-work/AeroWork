pub mod acp;
pub mod commands;
pub mod core;
#[cfg(feature = "websocket")]
pub mod server;

use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::commands::{
    cancel_session, connect_agent, create_directory, create_file, create_session, delete_path,
    disconnect_agent, initialize_agent, list_directory, read_file, rename_path, respond_permission,
    send_prompt, set_session_mode, write_file,
    // Session management commands
    resume_session, fork_session, list_sessions, get_session_info,
    // Terminal commands
    create_terminal, write_terminal, resize_terminal, kill_terminal, list_terminals,
};
use crate::core::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aero_code=debug,tauri=info".into()),
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
            // Note: WebSocket server handles all event forwarding (session updates, permissions, terminal output)
            // This makes the architecture simpler - both desktop and web clients use WebSocket
            #[cfg(feature = "websocket")]
            {
                let ws_state = app.state::<Arc<AppState>>().inner().clone();
                let port = std::env::var("AERO_WS_PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or(8765);

                tauri::async_runtime::spawn(async move {
                    let server = server::WebSocketServer::new(ws_state);
                    if let Err(e) = server.start(port).await {
                        tracing::error!("WebSocket server error: {}", e);
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
