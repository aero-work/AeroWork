//! Standalone WebSocket server for web mode
//!
//! Run with: cargo run --bin server
//! Or: cargo run --bin server -- --port 8765

use std::sync::Arc;

use aero_code_lib::core::AppState;
use aero_code_lib::server::WebSocketServer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aero_code=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Parse port from args or env
    let port: u16 = std::env::args()
        .skip_while(|arg| arg != "--port")
        .nth(1)
        .and_then(|p| p.parse().ok())
        .or_else(|| std::env::var("AERO_WS_PORT").ok().and_then(|p| p.parse().ok()))
        .unwrap_or(8765);

    tracing::info!("Starting standalone WebSocket server on port {}", port);

    // Create app state
    let state = Arc::new(AppState::new());

    // Start notification forwarding tasks (these would normally be handled by Tauri events)
    // For standalone mode, we just need to drain the channels
    let notification_rx = state.notification_rx.write().take();
    if let Some(mut rx) = notification_rx {
        tokio::spawn(async move {
            while rx.recv().await.is_some() {
                // Notifications are forwarded via WebSocket broadcast in the server
            }
        });
    }

    let permission_rx = state.permission_rx.write().take();
    if let Some(mut rx) = permission_rx {
        tokio::spawn(async move {
            while rx.recv().await.is_some() {
                // Permissions are forwarded via WebSocket broadcast in the server
            }
        });
    }

    let terminal_rx = state.terminal_output_rx.write().take();
    if let Some(mut rx) = terminal_rx {
        tokio::spawn(async move {
            while rx.recv().await.is_some() {
                // Terminal output is forwarded via WebSocket broadcast in the server
            }
        });
    }

    // Start WebSocket server
    let server = WebSocketServer::new(state);
    server.start(port).await?;

    Ok(())
}
