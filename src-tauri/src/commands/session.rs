use std::sync::Arc;
use tauri::State;
use tracing::{error, info};

use crate::acp::{AcpError, NewSessionResponse, PromptResponse};
use crate::core::{AgentManager, AppState, ListSessionsResponse, SessionInfo};

#[tauri::command]
pub async fn create_session(
    state: State<'_, Arc<AppState>>,
    cwd: String,
) -> Result<NewSessionResponse, String> {
    info!("Creating new session in {}", cwd);

    let manager = AgentManager::new(state.client.clone());

    let response = manager.create_session(&cwd).await.map_err(|e: AcpError| {
        error!("Failed to create session: {}", e);
        e.to_string()
    })?;

    // Register session in the registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd,
        response.modes.clone(),
        response.models.clone(),
    );

    info!("Created session: {}", response.session_id);
    Ok(response)
}

/// Resume an existing session
#[tauri::command]
pub async fn resume_session(
    state: State<'_, Arc<AppState>>,
    session_id: String,
    cwd: String,
) -> Result<NewSessionResponse, String> {
    info!("Resuming session {} in {}", session_id, cwd);

    let manager = AgentManager::new(state.client.clone());

    let response = manager
        .resume_session(&session_id, &cwd)
        .await
        .map_err(|e: AcpError| {
            error!("Failed to resume session: {}", e);
            e.to_string()
        })?;

    // Register session in the registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd,
        response.modes.clone(),
        response.models.clone(),
    );

    info!("Resumed session: {}", response.session_id);
    Ok(response)
}

/// Fork an existing session (creates new session from existing one)
#[tauri::command]
pub async fn fork_session(
    state: State<'_, Arc<AppState>>,
    session_id: String,
    cwd: String,
) -> Result<NewSessionResponse, String> {
    info!("Forking session {} in {}", session_id, cwd);

    let manager = AgentManager::new(state.client.clone());

    let response = manager
        .fork_session(&session_id, &cwd)
        .await
        .map_err(|e: AcpError| {
            error!("Failed to fork session: {}", e);
            e.to_string()
        })?;

    // Register new session in the registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd,
        response.modes.clone(),
        response.models.clone(),
    );

    info!("Forked session {} -> {}", session_id, response.session_id);
    Ok(response)
}

/// List available sessions (active + historical)
#[tauri::command]
pub async fn list_sessions(
    state: State<'_, Arc<AppState>>,
    cwd: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<ListSessionsResponse, String> {
    let limit = limit.unwrap_or(20);
    let offset = offset.unwrap_or(0);

    info!("Listing sessions (cwd={:?}, limit={}, offset={})", cwd, limit, offset);

    let response = state.session_registry.list_sessions(cwd.as_deref(), limit, offset);

    info!("Found {} sessions (total: {})", response.sessions.len(), response.total);
    Ok(response)
}

/// Get session info by ID
#[tauri::command]
pub async fn get_session_info(
    state: State<'_, Arc<AppState>>,
    session_id: String,
) -> Result<SessionInfo, String> {
    info!("Getting session info: {}", session_id);

    state
        .session_registry
        .get_session_info(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))
}

#[tauri::command]
pub async fn send_prompt(
    state: State<'_, Arc<AppState>>,
    session_id: String,
    content: String,
) -> Result<PromptResponse, String> {
    info!("Sending prompt to session {}", session_id);

    let manager = AgentManager::new(state.client.clone());

    let response = manager.prompt(&session_id, &content).await.map_err(|e: AcpError| {
        error!("Failed to send prompt: {}", e);
        e.to_string()
    })?;

    info!("Prompt completed with stop_reason: {:?}", response.stop_reason);
    Ok(response)
}

#[tauri::command]
pub async fn cancel_session(
    state: State<'_, Arc<AppState>>,
    session_id: String,
) -> Result<(), String> {
    info!("Cancelling session {}", session_id);

    let manager = AgentManager::new(state.client.clone());

    manager.cancel(&session_id).await.map_err(|e: AcpError| {
        error!("Failed to cancel session: {}", e);
        e.to_string()
    })?;

    info!("Session {} cancelled", session_id);
    Ok(())
}

#[tauri::command]
pub async fn set_session_mode(
    state: State<'_, Arc<AppState>>,
    session_id: String,
    mode_id: String,
) -> Result<(), String> {
    info!("Setting session {} mode to {}", session_id, mode_id);

    let manager = AgentManager::new(state.client.clone());

    manager
        .set_session_mode(&session_id, &mode_id)
        .await
        .map_err(|e: AcpError| {
            error!("Failed to set session mode: {}", e);
            e.to_string()
        })?;

    info!("Session {} mode set to {}", session_id, mode_id);
    Ok(())
}
