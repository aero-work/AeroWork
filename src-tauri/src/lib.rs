pub mod acp;
pub mod commands;
pub mod core;

use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::commands::{
    cancel_session, connect_agent, create_directory, create_file, create_session, delete_path,
    disconnect_agent, initialize_agent, list_directory, read_file, rename_path, respond_permission,
    send_prompt, set_session_mode, write_file,
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
            // File operations
            list_directory,
            read_file,
            write_file,
            create_file,
            create_directory,
            delete_path,
            rename_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
