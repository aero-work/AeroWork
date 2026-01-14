use std::sync::Arc;
use tauri::State;
use tracing::{error, info};

use crate::acp::{AcpError, InitializeResponse, PermissionOutcome};
use crate::core::{AgentManager, AppState};

#[tauri::command]
pub async fn connect_agent(
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    info!("Connecting to ACP agent...");

    let manager = AgentManager::new(state.client.clone());

    let notification_tx = state.notification_tx.clone();
    let permission_tx = state.permission_tx.clone();

    manager
        .connect(notification_tx.clone(), permission_tx.clone())
        .await
        .map_err(|e: AcpError| {
            error!("Failed to connect: {}", e);
            e.to_string()
        })?;

    info!("Connected to ACP agent");
    Ok(())
}

#[tauri::command]
pub async fn disconnect_agent(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    info!("Disconnecting from ACP agent...");

    let manager = AgentManager::new(state.client.clone());

    manager.disconnect().await.map_err(|e: AcpError| {
        error!("Failed to disconnect: {}", e);
        e.to_string()
    })?;

    info!("Disconnected from ACP agent");
    Ok(())
}

#[tauri::command]
pub async fn initialize_agent(
    state: State<'_, Arc<AppState>>,
) -> Result<InitializeResponse, String> {
    info!("Initializing ACP agent...");

    let manager = AgentManager::new(state.client.clone());

    let response = manager.initialize().await.map_err(|e: AcpError| {
        error!("Failed to initialize: {}", e);
        e.to_string()
    })?;

    info!("Initialized ACP agent: {:?}", response.agent_info);
    Ok(response)
}

#[tauri::command]
pub async fn respond_permission(
    state: State<'_, Arc<AppState>>,
    request_id: serde_json::Value,
    outcome: PermissionOutcome,
) -> Result<(), String> {
    info!("Responding to permission request id={:?}", request_id);

    let manager = AgentManager::new(state.client.clone());

    manager
        .respond_permission(request_id, outcome)
        .await
        .map_err(|e: AcpError| {
            error!("Failed to respond to permission: {}", e);
            e.to_string()
        })?;

    Ok(())
}
