use std::sync::Arc;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, mpsc};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::acp::{AcpError, InitializeResponse, NewSessionResponse, PermissionOutcome, PromptResponse, SessionId};
use crate::core::{AgentManager, AppState, ClientId, SessionState};

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    method: String,
    params: Option<serde_json::Value>,
    id: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
    id: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcNotification {
    jsonrpc: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

impl JsonRpcResponse {
    fn success(id: serde_json::Value, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            result: Some(result),
            error: None,
            id,
        }
    }

    fn error(id: serde_json::Value, code: i32, message: String) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            result: None,
            error: Some(JsonRpcError { code, message }),
            id,
        }
    }
}

pub struct WebSocketServer {
    state: Arc<AppState>,
    event_tx: broadcast::Sender<String>,
}

impl WebSocketServer {
    pub fn new(state: Arc<AppState>) -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self { state, event_tx }
    }

    /// Start the WebSocket server, automatically finding an available port if the preferred port is occupied.
    /// Returns the actual port that was bound.
    pub async fn start(self, preferred_port: u16) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
        let server_state = Arc::new(ServerState {
            app_state: self.state.clone(),
            event_tx: self.event_tx.clone(),
        });

        // Start event forwarding from AppState channels
        Self::start_event_forwarding(self.state.clone(), self.event_tx.clone()).await;

        let app = Router::new()
            .route("/ws", get(ws_handler))
            .route("/health", get(health_handler))
            .with_state(server_state);

        // Try to bind to the preferred port first, then try alternative ports if occupied
        let (listener, actual_port) = Self::find_available_port(preferred_port).await?;

        info!("WebSocket server listening on 0.0.0.0:{}", actual_port);

        axum::serve(listener, app).await?;

        Ok(actual_port)
    }

    /// Find an available port, starting with the preferred port and trying alternatives if occupied
    async fn find_available_port(preferred_port: u16) -> Result<(tokio::net::TcpListener, u16), Box<dyn std::error::Error + Send + Sync>> {
        // Try the preferred port first
        let addr = format!("0.0.0.0:{}", preferred_port);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                return Ok((listener, preferred_port));
            }
            Err(e) => {
                warn!("Port {} is occupied: {}, trying alternative ports...", preferred_port, e);
            }
        }

        // Try a range of alternative ports
        let port_range = preferred_port.saturating_add(1)..=preferred_port.saturating_add(100);
        for port in port_range {
            let addr = format!("0.0.0.0:{}", port);
            match tokio::net::TcpListener::bind(&addr).await {
                Ok(listener) => {
                    info!("Found available port: {}", port);
                    return Ok((listener, port));
                }
                Err(_) => continue,
            }
        }

        // If no port found in the range, let the OS choose one
        let addr = "0.0.0.0:0";
        let listener = tokio::net::TcpListener::bind(addr).await?;
        let actual_port = listener.local_addr()?.port();
        info!("OS assigned port: {}", actual_port);
        Ok((listener, actual_port))
    }

    async fn start_event_forwarding(state: Arc<AppState>, event_tx: broadcast::Sender<String>) {
        // Forward session notifications and apply to SessionStateManager
        let notification_rx = state.notification_rx.write().take();
        if let Some(mut rx) = notification_rx {
            let tx = event_tx.clone();
            let session_state_manager = state.session_state_manager.clone();
            tokio::spawn(async move {
                while let Some(notification) = rx.recv().await {
                    // Apply update to SessionStateManager (single source of truth)
                    session_state_manager.apply_update(
                        &notification.session_id,
                        notification.update.clone(),
                    );

                    // Forward to all clients (backward compatibility)
                    let msg = JsonRpcNotification {
                        jsonrpc: "2.0".to_string(),
                        method: "session/update".to_string(),
                        params: serde_json::json!({
                            "sessionId": notification.session_id,
                            "update": notification.update,
                        }),
                    };
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ = tx.send(json);
                    }
                }
            });
        }

        // Forward permission requests and save to session state
        let permission_rx = state.permission_rx.write().take();
        if let Some(mut rx) = permission_rx {
            let tx = event_tx.clone();
            let state_clone = state.clone();
            tokio::spawn(async move {
                while let Some(request) = rx.recv().await {
                    // Check if session has dangerous mode enabled - auto-approve if so
                    if state_clone.session_state_manager.is_dangerous_mode(&request.session_id) {
                        info!("Dangerous mode enabled for session {}, auto-approving permission", request.session_id);
                        // Find allow option and auto-respond
                        if let Some(allow_option) = request.options.iter().find(|opt| {
                            matches!(opt.kind, crate::acp::PermissionOptionKind::AllowOnce | crate::acp::PermissionOptionKind::AllowAlways)
                        }) {
                            let outcome = PermissionOutcome::Selected {
                                option_id: allow_option.option_id.clone(),
                            };
                            // Respond to the permission request
                            let client_guard = state_clone.client.read().await;
                            if let Some(ref client) = *client_guard {
                                let _ = client.respond_permission(request.request_id.clone(), outcome).await;
                            }
                            continue; // Skip forwarding to clients
                        }
                    }

                    // Save the pending permission request to session state
                    state_clone.session_state_manager.set_pending_permission(
                        &request.session_id,
                        Some(request.clone()),
                    );
                    // Also keep in global state for backward compatibility
                    state_clone.set_pending_permission(Some(request.clone()));

                    // Set session status to Pending (waiting for user response)
                    state_clone.session_registry.update_status(
                        &request.session_id,
                        crate::core::SessionStatus::Pending,
                    );

                    let msg = JsonRpcNotification {
                        jsonrpc: "2.0".to_string(),
                        method: "permission/request".to_string(),
                        params: serde_json::to_value(&request).unwrap_or_default(),
                    };
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ = tx.send(json);
                    }
                }
            });
        }

        // Forward terminal output
        let terminal_rx = state.terminal_output_rx.write().take();
        if let Some(mut rx) = terminal_rx {
            let tx = event_tx.clone();
            tokio::spawn(async move {
                while let Some(output) = rx.recv().await {
                    let msg = JsonRpcNotification {
                        jsonrpc: "2.0".to_string(),
                        method: "terminal/output".to_string(),
                        params: serde_json::to_value(&output).unwrap_or_default(),
                    };
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ = tx.send(json);
                    }
                }
            });
        }

        // Forward session activation events
        let session_activated_rx = state.session_activated_rx.write().take();
        if let Some(mut rx) = session_activated_rx {
            let tx = event_tx.clone();
            tokio::spawn(async move {
                while let Some(activated) = rx.recv().await {
                    let msg = JsonRpcNotification {
                        jsonrpc: "2.0".to_string(),
                        method: "session/activated".to_string(),
                        params: serde_json::json!({
                            "sessionId": activated.session_id,
                        }),
                    };
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ = tx.send(json);
                    }
                }
            });
        }
    }
}

struct ServerState {
    app_state: Arc<AppState>,
    event_tx: broadcast::Sender<String>,
}

/// Per-client state for WebSocket connections
struct ClientState {
    client_id: ClientId,
    subscribed_sessions: std::sync::RwLock<std::collections::HashSet<SessionId>>,
}

async fn health_handler() -> &'static str {
    "OK"
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    let (mut sender, mut receiver) = socket.split();

    // Generate unique client ID for this connection
    let client_id = Uuid::new_v4().to_string();
    let client_state = Arc::new(ClientState {
        client_id: client_id.clone(),
        subscribed_sessions: std::sync::RwLock::new(std::collections::HashSet::new()),
    });

    info!("WebSocket client connected: {}", client_id);

    // Subscribe to broadcast events
    let mut event_rx = state.event_tx.subscribe();

    // Channel for sending messages to WebSocket
    let (ws_tx, mut ws_rx) = mpsc::channel::<String>(100);

    // NOTE: Don't push pending permission here - client will discover it
    // from SessionState.pendingPermission when it fetches session state

    // Task to forward broadcast events to this WebSocket
    let ws_tx_clone = ws_tx.clone();
    let event_task = tokio::spawn(async move {
        while let Ok(msg) = event_rx.recv().await {
            if ws_tx_clone.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Task to write messages to WebSocket
    let write_task = tokio::spawn(async move {
        while let Some(msg) = ws_rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages concurrently to avoid deadlocks
    // (e.g., send_prompt waiting for respond_permission)
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                // Spawn a task for each message to allow concurrent processing
                let state_clone = state.clone();
                let client_state_clone = client_state.clone();
                let ws_tx_clone = ws_tx.clone();
                tokio::spawn(async move {
                    let response = handle_message(&text, &state_clone, &client_state_clone).await;
                    let _ = ws_tx_clone.send(response).await;
                });
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {} // Ignore other message types
            Err(e) => {
                warn!("WebSocket error for client {}: {}", client_state.client_id, e);
                break;
            }
        }
    }

    // Clean up: unsubscribe from all sessions
    {
        let subscribed = client_state.subscribed_sessions.read().unwrap();
        for session_id in subscribed.iter() {
            state.app_state.session_state_manager.unsubscribe(&client_state.client_id, session_id);
        }
    }

    event_task.abort();
    write_task.abort();
    info!("WebSocket client disconnected: {}", client_state.client_id);
}

async fn handle_message(text: &str, state: &Arc<ServerState>, client_state: &Arc<ClientState>) -> String {
    let request: JsonRpcRequest = match serde_json::from_str(text) {
        Ok(r) => r,
        Err(e) => {
            return serde_json::to_string(&JsonRpcResponse::error(
                serde_json::Value::Null,
                -32700,
                format!("Parse error: {}", e),
            ))
            .unwrap_or_default();
        }
    };

    let result = dispatch_method(&request.method, request.params, &state.app_state, client_state, &state.event_tx).await;

    match result {
        Ok(value) => serde_json::to_string(&JsonRpcResponse::success(request.id, value)),
        Err(e) => serde_json::to_string(&JsonRpcResponse::error(request.id, -32603, e)),
    }
    .unwrap_or_default()
}

async fn dispatch_method(
    method: &str,
    params: Option<serde_json::Value>,
    state: &Arc<AppState>,
    client_state: &Arc<ClientState>,
    event_tx: &broadcast::Sender<String>,
) -> Result<serde_json::Value, String> {
    let params = params.unwrap_or(serde_json::Value::Null);

    match method {
        // Session state subscription methods
        "subscribe_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let auto_resume = params.get("autoResume")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            let session_state = subscribe_session_handler(state, client_state, session_id, auto_resume, event_tx).await?;
            serde_json::to_value(session_state).map_err(|e| e.to_string())
        }
        "unsubscribe_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            unsubscribe_session_handler(state, client_state, session_id);
            Ok(serde_json::Value::Null)
        }
        "get_session_state" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let auto_resume = params.get("autoResume")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            let session_state = get_session_state_handler(state, session_id, auto_resume).await?;
            serde_json::to_value(session_state).map_err(|e| e.to_string())
        }
        "get_client_id" => {
            Ok(serde_json::json!({ "clientId": client_state.client_id }))
        }
        "set_dangerous_mode" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let enabled = params.get("enabled")
                .and_then(|v| v.as_bool())
                .ok_or("Missing enabled parameter")?;
            let success = state.session_state_manager.set_dangerous_mode(&session_id.to_string(), enabled);

            // Broadcast update to all WebSocket clients
            if success {
                let msg = JsonRpcNotification {
                    jsonrpc: "2.0".to_string(),
                    method: "session/state_update".to_string(),
                    params: serde_json::json!({
                        "sessionId": session_id,
                        "update": {
                            "updateType": "dangerous_mode_updated",
                            "dangerousMode": enabled
                        }
                    }),
                };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = event_tx.send(json);
                }
            }

            Ok(serde_json::json!({ "success": success, "dangerousMode": enabled }))
        }
        "get_dangerous_mode" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let enabled = state.session_state_manager.is_dangerous_mode(&session_id.to_string());
            Ok(serde_json::json!({ "dangerousMode": enabled }))
        }

        // Agent commands
        "connect" => {
            connect_handler(state).await?;
            Ok(serde_json::Value::Null)
        }
        "disconnect" => {
            disconnect_handler(state).await?;
            Ok(serde_json::Value::Null)
        }
        "initialize" => {
            let response = initialize_handler(state).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "respond_permission" => {
            let request_id = params.get("requestId").cloned().unwrap_or_default();
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let outcome: PermissionOutcome = serde_json::from_value(
                params.get("outcome").cloned().unwrap_or_default()
            ).map_err(|e| e.to_string())?;
            // Clear pending permission from session state
            if let Some(ref sid) = session_id {
                state.session_state_manager.set_pending_permission(sid, None);
                // Set session status back to Running (continuing to process)
                state.session_registry.update_status(sid, crate::core::SessionStatus::Running);
            }
            // Also clear global state for backward compatibility
            state.set_pending_permission(None);
            respond_permission_handler(state, request_id.clone(), outcome).await?;

            // Broadcast permission resolved to all clients so they can close their dialogs
            let msg = JsonRpcNotification {
                jsonrpc: "2.0".to_string(),
                method: "permission/resolved".to_string(),
                params: serde_json::json!({
                    "requestId": request_id,
                    "sessionId": session_id,
                }),
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = event_tx.send(json);
            }

            Ok(serde_json::Value::Null)
        }

        // Session commands
        "create_session" => {
            let cwd = params.get("cwd")
                .and_then(|v| v.as_str())
                .ok_or("Missing cwd parameter")?;
            let response = create_session_handler(state, cwd).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "send_prompt" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let content = params.get("content")
                .and_then(|v| v.as_str())
                .ok_or("Missing content parameter")?;
            let message_id = params.get("messageId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let response = send_prompt_handler(state, session_id, content, message_id, event_tx).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "cancel_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            cancel_session_handler(state, session_id).await?;
            Ok(serde_json::Value::Null)
        }
        "stop_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            stop_session_handler(state, session_id, event_tx).await?;
            Ok(serde_json::Value::Null)
        }
        "set_session_mode" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let mode_id = params.get("modeId")
                .and_then(|v| v.as_str())
                .ok_or("Missing modeId parameter")?;
            set_session_mode_handler(state, session_id, mode_id).await?;
            Ok(serde_json::Value::Null)
        }
        "list_sessions" => {
            let cwd = params.get("cwd").and_then(|v| v.as_str());
            let limit = params.get("limit").and_then(|v| v.as_u64()).map(|v| v as usize);
            let offset = params.get("offset").and_then(|v| v.as_u64()).map(|v| v as usize);
            let response = list_sessions_handler(state, cwd, limit, offset).await;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "resume_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let cwd = params.get("cwd")
                .and_then(|v| v.as_str())
                .ok_or("Missing cwd parameter")?;
            let response = resume_session_handler(state, session_id, cwd).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "fork_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let cwd = params.get("cwd")
                .and_then(|v| v.as_str())
                .ok_or("Missing cwd parameter")?;
            let response = fork_session_handler(state, session_id, cwd).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "get_session_info" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let response = get_session_info_handler(state, session_id).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "delete_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            let deleted = delete_session_handler(state, session_id)?;
            Ok(serde_json::json!({ "deleted": deleted }))
        }
        "get_current_session" => {
            let session_id = state.get_current_session();
            Ok(serde_json::json!({ "sessionId": session_id }))
        }
        "set_current_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            state.set_current_session(session_id).await;
            Ok(serde_json::Value::Null)
        }

        // File commands
        "list_directory" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let show_hidden = params.get("showHidden")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let entries = list_directory_handler(path, show_hidden).await?;
            serde_json::to_value(entries).map_err(|e| e.to_string())
        }
        "read_file" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let content = read_file_handler(path).await?;
            Ok(serde_json::Value::String(content))
        }
        "write_file" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let content = params.get("content")
                .and_then(|v| v.as_str())
                .ok_or("Missing content parameter")?;
            write_file_handler(path, content).await?;
            Ok(serde_json::Value::Null)
        }
        "write_file_binary" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let content = params.get("content")
                .and_then(|v| v.as_str())
                .ok_or("Missing content parameter (base64)")?;
            write_file_binary_handler(path, content).await?;
            Ok(serde_json::Value::Null)
        }
        "create_file" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            create_file_handler(path).await?;
            Ok(serde_json::Value::Null)
        }
        "create_directory" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            create_directory_handler(path).await?;
            Ok(serde_json::Value::Null)
        }
        "delete_path" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            delete_path_handler(path).await?;
            Ok(serde_json::Value::Null)
        }
        "rename_path" => {
            let from = params.get("from")
                .and_then(|v| v.as_str())
                .ok_or("Missing from parameter")?;
            let to = params.get("to")
                .and_then(|v| v.as_str())
                .ok_or("Missing to parameter")?;
            rename_path_handler(from, to).await?;
            Ok(serde_json::Value::Null)
        }
        "read_file_binary" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let content = read_file_binary_handler(path).await?;
            serde_json::to_value(content).map_err(|e| e.to_string())
        }
        "get_file_info" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let info = get_file_info_handler(path).await?;
            serde_json::to_value(info).map_err(|e| e.to_string())
        }

        // Terminal commands
        "create_terminal" => {
            let cwd = params.get("cwd").and_then(|v| v.as_str());
            let cols = params.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;
            let rows = params.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u16;
            let terminal_id = create_terminal_handler(state, cwd, cols, rows).await?;
            Ok(serde_json::Value::String(terminal_id))
        }
        "write_terminal" => {
            let terminal_id = params.get("terminalId")
                .and_then(|v| v.as_str())
                .ok_or("Missing terminalId parameter")?;
            let data = params.get("data")
                .and_then(|v| v.as_str())
                .ok_or("Missing data parameter")?;
            write_terminal_handler(state, terminal_id, data).await?;
            Ok(serde_json::Value::Null)
        }
        "resize_terminal" => {
            let terminal_id = params.get("terminalId")
                .and_then(|v| v.as_str())
                .ok_or("Missing terminalId parameter")?;
            let cols = params.get("cols")
                .and_then(|v| v.as_u64())
                .ok_or("Missing cols parameter")? as u16;
            let rows = params.get("rows")
                .and_then(|v| v.as_u64())
                .ok_or("Missing rows parameter")? as u16;
            resize_terminal_handler(state, terminal_id, cols, rows).await?;
            Ok(serde_json::Value::Null)
        }
        "kill_terminal" => {
            let terminal_id = params.get("terminalId")
                .and_then(|v| v.as_str())
                .ok_or("Missing terminalId parameter")?;
            kill_terminal_handler(state, terminal_id).await?;
            Ok(serde_json::Value::Null)
        }
        "list_terminals" => {
            let terminals = list_terminals_handler(state).await?;
            serde_json::to_value(terminals).map_err(|e| e.to_string())
        }

        // Plugin commands
        "list_plugins" => {
            let response = list_plugins_handler()?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "add_marketplace" => {
            let name = params.get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing name parameter")?;
            let git_url = params.get("gitUrl")
                .and_then(|v| v.as_str())
                .ok_or("Missing gitUrl parameter")?;
            let response = add_marketplace_handler(name, git_url).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "delete_marketplace" => {
            let name = params.get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing name parameter")?;
            let response = delete_marketplace_handler(name)?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "update_marketplace" => {
            let name = params.get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing name parameter")?;
            let response = update_marketplace_handler(name).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "install_plugin" => {
            let plugin_name = params.get("pluginName")
                .and_then(|v| v.as_str())
                .ok_or("Missing pluginName parameter")?;
            let marketplace_name = params.get("marketplaceName")
                .and_then(|v| v.as_str())
                .ok_or("Missing marketplaceName parameter")?;
            let response = install_plugin_handler(plugin_name, marketplace_name)?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "uninstall_plugin" => {
            let plugin_key = params.get("pluginKey")
                .and_then(|v| v.as_str())
                .ok_or("Missing pluginKey parameter")?;
            let response = uninstall_plugin_handler(plugin_key)?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "toggle_marketplace" => {
            let name = params.get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing name parameter")?;
            let enabled = params.get("enabled")
                .and_then(|v| v.as_bool())
                .ok_or("Missing enabled parameter")?;
            let response = toggle_marketplace_handler(name, enabled)?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }

        // Server info commands
        "get_server_info" => {
            let port = state.get_ws_port();
            let cwd = std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "/".to_string());
            let home = dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "/".to_string());
            Ok(serde_json::json!({
                "port": port,
                "cwd": cwd,
                "home": home
            }))
        }

        // Recent projects commands
        "get_recent_projects" => {
            let projects = load_recent_projects()?;
            Ok(serde_json::json!({ "projects": projects }))
        }

        "add_recent_project" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let name = params.get("name")
                .and_then(|v| v.as_str());
            add_recent_project(path, name)?;
            let projects = load_recent_projects()?;
            Ok(serde_json::json!({ "projects": projects }))
        }

        "remove_recent_project" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            remove_recent_project(path)?;
            let projects = load_recent_projects()?;
            Ok(serde_json::json!({ "projects": projects }))
        }

        "clear_recent_projects" => {
            clear_recent_projects()?;
            Ok(serde_json::json!({ "projects": [] }))
        }

        _ => Err(format!("Unknown method: {}", method)),
    }
}

// Handler implementations (reusing core logic)

// Session state subscription handlers

/// Subscribe to a session, with optional auto-resume for historical sessions
/// Returns immediately with empty state, loads history in background
async fn subscribe_session_handler(
    state: &Arc<AppState>,
    client_state: &Arc<ClientState>,
    session_id: &str,
    auto_resume: bool,
    event_tx: &broadcast::Sender<String>,
) -> Result<SessionState, String> {
    let session_id = session_id.to_string();

    // First, try to subscribe if session already exists in memory
    let result = state.session_state_manager.subscribe(
        client_state.client_id.clone(),
        &session_id,
    );

    if let Some((session_state, _rx)) = result {
        // Track subscription in client state
        {
            let mut subscribed = client_state.subscribed_sessions.write().unwrap();
            subscribed.insert(session_id.clone());
        }

        info!(
            "Client {} subscribed to session {}",
            client_state.client_id, session_id
        );

        // NOTE: Don't push pending permission here - client will discover it
        // from SessionState.pendingPermission in the returned state

        return Ok(session_state);
    }

    // Session not in memory - try auto-resume if enabled
    if !auto_resume {
        return Err(format!("Session not found: {}", session_id));
    }

    info!("Session {} not in memory, attempting auto-resume...", session_id);

    // Check if session exists on disk
    let session_info = state.session_registry.get_session_info(&session_id)
        .ok_or_else(|| format!("Session not found on disk: {}", session_id))?;

    let cwd = session_info.cwd.clone();

    // Ensure ACP agent is running before resuming session
    ensure_agent_connected(state).await?;

    // Resume the session via ACP agent
    let manager = AgentManager::new(state.client.clone());
    let response = manager.resume_session(&session_id, &cwd).await
        .map_err(|e| format!("Failed to resume session: {}", e))?;

    info!("Auto-resumed session: {} -> {}", session_id, response.session_id);

    // Register in session registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd.clone(),
        response.modes.clone(),
        response.models.clone(),
    );

    // Create EMPTY session state first (for immediate response)
    let initial_state = state.session_state_manager.create_session(
        response.session_id.clone(),
        cwd.clone(),
        response.modes,
        response.models,
    );

    // Set as current active session
    state.set_current_session(Some(response.session_id.clone())).await;

    // Subscribe client to the session
    let result = state.session_state_manager.subscribe(
        client_state.client_id.clone(),
        &response.session_id,
    );

    if result.is_none() {
        return Err(format!("Failed to subscribe to resumed session: {}", response.session_id));
    }

    // Track subscription in client state
    {
        let mut subscribed = client_state.subscribed_sessions.write().unwrap();
        subscribed.insert(response.session_id.clone());
    }

    info!(
        "Client {} subscribed to auto-resumed session {} (loading history in background)",
        client_state.client_id, response.session_id
    );

    // Spawn background task to load history
    let state_clone = state.clone();
    let original_session_id = session_id.clone();
    let new_session_id = response.session_id.clone();
    let event_tx_clone = event_tx.clone();

    tokio::spawn(async move {
        // Load historical chat items from JSONL file
        let chat_items = state_clone.session_registry.load_chat_items(&original_session_id);

        if chat_items.is_empty() {
            debug!("No historical chat items to load for session {}", original_session_id);
            return;
        }

        info!("Background: Loaded {} historical chat items for session {}", chat_items.len(), original_session_id);

        // Update session state with history
        state_clone.session_state_manager.load_history(&new_session_id, chat_items);

        // Broadcast full state update to all subscribers
        if let Some(updated_state) = state_clone.session_state_manager.get_state(&new_session_id) {
            let msg = JsonRpcNotification {
                jsonrpc: "2.0".to_string(),
                method: "session/state_update".to_string(),
                params: serde_json::json!({
                    "sessionId": new_session_id,
                    "update": {
                        "updateType": "full_state",
                        "state": updated_state
                    }
                }),
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = event_tx_clone.send(json);
            }
            info!("Background: Broadcasted full state for session {}", new_session_id);
        }
    });

    Ok(initial_state)
}

fn unsubscribe_session_handler(
    state: &Arc<AppState>,
    client_state: &Arc<ClientState>,
    session_id: &str,
) {
    let session_id = session_id.to_string();

    // Unsubscribe from session
    state.session_state_manager.unsubscribe(&client_state.client_id, &session_id);

    // Remove from client tracking
    {
        let mut subscribed = client_state.subscribed_sessions.write().unwrap();
        subscribed.remove(&session_id);
    }

    debug!(
        "Client {} unsubscribed from session {}",
        client_state.client_id, session_id
    );
}

/// Get session state, with optional auto-resume for historical sessions
async fn get_session_state_handler(
    state: &Arc<AppState>,
    session_id: &str,
    auto_resume: bool,
) -> Result<SessionState, String> {
    let session_id_str = session_id.to_string();

    // First, check if session exists in SessionStateManager
    if let Some(session_state) = state.session_state_manager.get_state(&session_id_str) {
        return Ok(session_state);
    }

    // Session not in memory - try auto-resume if enabled
    if !auto_resume {
        return Err(format!("Session not found: {}", session_id));
    }

    info!("Session {} not in memory, attempting auto-resume for get_state...", session_id);

    // Check if session exists on disk
    let session_info = state.session_registry.get_session_info(session_id)
        .ok_or_else(|| format!("Session not found on disk: {}", session_id))?;

    let cwd = session_info.cwd.clone();

    // Ensure ACP agent is running before resuming session
    ensure_agent_connected(state).await?;

    // Resume the session via ACP agent
    let manager = AgentManager::new(state.client.clone());
    let response = manager.resume_session(session_id, &cwd).await
        .map_err(|e| format!("Failed to resume session: {}", e))?;

    info!("Auto-resumed session for get_state: {} -> {}", session_id, response.session_id);

    // Register in session registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd.clone(),
        response.modes.clone(),
        response.models.clone(),
    );

    // Load historical chat items from JSONL file
    let chat_items = state.session_registry.load_chat_items(session_id);
    info!("Loaded {} historical chat items for session {}", chat_items.len(), session_id);

    // Create session state with historical chat items
    state.session_state_manager.create_session_with_history(
        response.session_id.clone(),
        cwd,
        response.modes,
        response.models,
        chat_items,
    );

    // Set as current active session
    state.set_current_session(Some(response.session_id.clone())).await;

    // Return the new session state
    state.session_state_manager.get_state(&response.session_id)
        .ok_or_else(|| format!("Failed to get state for resumed session: {}", response.session_id))
}

/// Ensure ACP agent is running, start if not connected
/// This is called lazily when creating/resuming/forking sessions
async fn ensure_agent_connected(state: &Arc<AppState>) -> Result<(), String> {
    use crate::acp::AcpClient;

    // Check if already connected
    {
        let guard = state.client.read().await;
        if let Some(ref client) = *guard {
            if client.is_connected() {
                return Ok(());
            }
        }
    }

    // Not connected, create new connection
    info!("Starting ACP agent (lazy initialization)...");
    let notification_tx = state.notification_tx.clone();
    let permission_tx = state.permission_tx.clone();

    let mut client = AcpClient::new(notification_tx, permission_tx);
    client
        .connect("npx", &["@zed-industries/claude-code-acp"])
        .await
        .map_err(|e| e.to_string())?;

    // Initialize the agent
    let init_response = client.initialize().await.map_err(|e| e.to_string())?;
    info!("ACP agent initialized: {:?}", init_response.agent_info);

    {
        let mut guard = state.client.write().await;
        *guard = Some(client);
    }

    info!("ACP agent started and ready");
    Ok(())
}

async fn connect_handler(state: &Arc<AppState>) -> Result<(), String> {
    // connect is now a no-op, ACP agent is started lazily when needed
    info!("WebSocket: Client connected (ACP agent will start when session is created/resumed)");
    let manager = AgentManager::new(state.client.clone());
    let notification_tx = state.notification_tx.clone();
    let permission_tx = state.permission_tx.clone();

    manager
        .connect(notification_tx, permission_tx)
        .await
        .map_err(|e: AcpError| e.to_string())?;

    Ok(())
}

async fn disconnect_handler(state: &Arc<AppState>) -> Result<(), String> {
    info!("WebSocket: Disconnecting from ACP agent...");
    let manager = AgentManager::new(state.client.clone());
    manager.disconnect().await.map_err(|e: AcpError| e.to_string())?;
    info!("WebSocket: Disconnected from ACP agent");
    Ok(())
}

async fn initialize_handler(state: &Arc<AppState>) -> Result<InitializeResponse, String> {
    // Initialize is now a no-op since we return cached info
    // Real initialization happens lazily in ensure_agent_connected
    info!("WebSocket: Initialize called (agent will start when session is created/resumed)");

    // Check if agent is already connected and return its info
    {
        let guard = state.client.read().await;
        if let Some(ref client) = *guard {
            if client.is_connected() {
                // Agent already running, get its info
                return client.initialize().await.map_err(|e: AcpError| e.to_string());
            }
        }
    }

    // Agent not running yet, return empty response
    // Real initialization will happen when session is created/resumed
    Ok(InitializeResponse {
        protocol_version: 1,
        agent_info: None,
        agent_capabilities: None,
        auth_methods: None,
    })
}

async fn respond_permission_handler(
    state: &Arc<AppState>,
    request_id: serde_json::Value,
    outcome: PermissionOutcome,
) -> Result<(), String> {
    info!("WebSocket: Responding to permission request id={:?}", request_id);
    let manager = AgentManager::new(state.client.clone());
    manager.respond_permission(request_id, outcome).await.map_err(|e: AcpError| e.to_string())
}

async fn create_session_handler(state: &Arc<AppState>, cwd: &str) -> Result<NewSessionResponse, String> {
    info!("WebSocket: Creating new session in {}", cwd);

    // Ensure ACP agent is running before creating session
    ensure_agent_connected(state).await?;

    let manager = AgentManager::new(state.client.clone());
    let response = manager.create_session(cwd).await.map_err(|e: AcpError| e.to_string())?;

    // Register session in the registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd.to_string(),
        response.modes.clone(),
        response.models.clone(),
    );

    // Create session state in SessionStateManager (single source of truth)
    state.session_state_manager.create_session(
        response.session_id.clone(),
        cwd.to_string(),
        response.modes.clone(),
        response.models.clone(),
    );

    // Set as current active session and broadcast to all clients
    state.set_current_session(Some(response.session_id.clone())).await;

    info!("WebSocket: Created session: {}", response.session_id);
    Ok(response)
}

async fn send_prompt_handler(state: &Arc<AppState>, session_id: &str, content: &str, message_id: Option<String>, event_tx: &broadcast::Sender<String>) -> Result<PromptResponse, String> {
    info!("WebSocket: Sending prompt to session {}", session_id);

    // Set session status to Running
    state.session_registry.update_status(&session_id.to_string(), crate::core::SessionStatus::Running);

    // Add user message to SessionStateManager (single source of truth)
    // If message_id is provided (from frontend optimistic update), use it to avoid duplicates
    state.session_state_manager.add_user_message(&session_id.to_string(), content.to_string(), message_id.clone());

    // Broadcast user message to all WebSocket clients
    if let Some(session_state) = state.session_state_manager.get_state(&session_id.to_string()) {
        // Get the last chat item which should be the user message we just added
        if let Some(last_item) = session_state.chat_items.last() {
            let msg = JsonRpcNotification {
                jsonrpc: "2.0".to_string(),
                method: "session/state_update".to_string(),
                params: serde_json::json!({
                    "sessionId": session_id,
                    "update": {
                        "updateType": "message_added",
                        "message": match last_item {
                            crate::core::session_state::ChatItem::Message { message } => serde_json::to_value(message).ok(),
                            _ => None,
                        }
                    }
                }),
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = event_tx.send(json);
            }
        }
    }

    let manager = AgentManager::new(state.client.clone());

    // Try to send prompt, auto-resume if session not found in ACP agent
    let response = match manager.prompt(session_id, content).await {
        Ok(resp) => resp,
        Err(e) => {
            // Check if error is "Session not found" - need to resume
            let is_session_not_found = match &e {
                crate::acp::AcpError::Rpc { message, data, .. } => {
                    // Check message or data.details for "Session not found"
                    message.to_lowercase().contains("session not found") ||
                    data.as_ref()
                        .and_then(|d| d.get("details"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_lowercase().contains("session not found"))
                        .unwrap_or(false)
                }
                _ => false,
            };

            if is_session_not_found {
                warn!("WebSocket: Session {} not found in ACP agent, attempting auto-resume...", session_id);

                // Get session info to find cwd
                let session_info = state.session_registry.get_session_info(session_id)
                    .ok_or_else(|| format!("Session {} not found in registry", session_id))?;

                let cwd = session_info.cwd;

                // Ensure ACP agent is running before resuming
                ensure_agent_connected(state).await?;

                // Resume the session
                let resume_response = manager.resume_session(session_id, &cwd).await
                    .map_err(|e| format!("Failed to auto-resume session: {}", e))?;

                info!("WebSocket: Auto-resumed session {} -> {}", session_id, resume_response.session_id);

                // Update registry and state manager with potentially new session ID
                state.session_registry.register_session(
                    resume_response.session_id.clone(),
                    cwd.clone(),
                    resume_response.modes.clone(),
                    resume_response.models.clone(),
                );

                // Load historical chat items from JSONL file
                let history_items = state.session_registry.load_chat_items(session_id);
                info!("Loaded {} historical chat items for auto-resumed session {}", history_items.len(), session_id);

                // Create/update session state with historical chat items
                state.session_state_manager.create_session_with_history(
                    resume_response.session_id.clone(),
                    cwd,
                    resume_response.modes,
                    resume_response.models,
                    history_items,
                );

                // Re-add the user message to the new session state
                state.session_state_manager.add_user_message(&resume_response.session_id, content.to_string(), message_id.clone());

                // Broadcast user message to all WebSocket clients
                if let Some(session_state) = state.session_state_manager.get_state(&resume_response.session_id) {
                    if let Some(last_item) = session_state.chat_items.last() {
                        let msg = JsonRpcNotification {
                            jsonrpc: "2.0".to_string(),
                            method: "session/state_update".to_string(),
                            params: serde_json::json!({
                                "sessionId": resume_response.session_id,
                                "update": {
                                    "updateType": "message_added",
                                    "message": match last_item {
                                        crate::core::session_state::ChatItem::Message { message } => serde_json::to_value(message).ok(),
                                        _ => None,
                                    }
                                }
                            }),
                        };
                        if let Ok(json) = serde_json::to_string(&msg) {
                            let _ = event_tx.send(json);
                        }
                    }
                }

                // Set as current session
                state.set_current_session(Some(resume_response.session_id.clone())).await;

                // Retry the prompt with the resumed session
                manager.prompt(&resume_response.session_id, content).await
                    .map_err(|e| format!("Failed to send prompt after resume: {}", e))?
            } else {
                return Err(e.to_string());
            }
        }
    };

    info!("WebSocket: Prompt completed with stop_reason: {:?}", response.stop_reason);

    // Set session status back to Idle after prompt completes
    state.session_registry.update_status(&session_id.to_string(), crate::core::SessionStatus::Idle);

    Ok(response)
}

async fn cancel_session_handler(state: &Arc<AppState>, session_id: &str) -> Result<(), String> {
    info!("WebSocket: Cancelling session {}", session_id);
    let manager = AgentManager::new(state.client.clone());
    manager.cancel(session_id).await.map_err(|e: AcpError| e.to_string())
}

/// Stop a session: cancel if running, unload from memory, update status to stopped
async fn stop_session_handler(
    state: &Arc<AppState>,
    session_id: &str,
    event_tx: &broadcast::Sender<String>,
) -> Result<(), String> {
    info!("WebSocket: Stopping session {}", session_id);

    // Get session info before we remove it (for cwd filter)
    let session_cwd = state.session_registry.get_session_info(session_id)
        .map(|info| info.cwd.clone());

    // Check current session status
    let current_status = state.session_registry.get_status(&session_id.to_string());

    // If session is running or pending, cancel it first
    if let Some(status) = current_status {
        if status == crate::core::SessionStatus::Running || status == crate::core::SessionStatus::Pending {
            info!("Session {} is {:?}, cancelling first...", session_id, status);
            let manager = AgentManager::new(state.client.clone());
            // Ignore cancel errors (session might already be done)
            let _ = manager.cancel(session_id).await;
        }
    }

    // Remove session from memory (SessionStateManager)
    state.session_state_manager.remove_session(&session_id.to_string());

    // Unregister from active sessions (this sets active=false in list_sessions output)
    state.session_registry.unregister_session(&session_id.to_string());

    // Broadcast sessions update to all clients (filtered by cwd if available)
    let sessions = state.session_registry.list_sessions(session_cwd.as_deref(), 50, 0);
    let notification = JsonRpcNotification {
        jsonrpc: "2.0".to_string(),
        method: "sessions/updated".to_string(),
        params: serde_json::json!({ "sessions": sessions.sessions }),
    };
    let _ = event_tx.send(serde_json::to_string(&notification).unwrap());

    info!("Session {} stopped successfully", session_id);
    Ok(())
}

async fn set_session_mode_handler(state: &Arc<AppState>, session_id: &str, mode_id: &str) -> Result<(), String> {
    info!("WebSocket: Setting session {} mode to {}", session_id, mode_id);
    let manager = AgentManager::new(state.client.clone());
    manager.set_session_mode(session_id, mode_id).await.map_err(|e: AcpError| e.to_string())
}

use crate::core::{ListSessionsResponse, SessionInfo};

async fn list_sessions_handler(
    state: &Arc<AppState>,
    cwd: Option<&str>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> ListSessionsResponse {
    let limit = limit.unwrap_or(20);
    let offset = offset.unwrap_or(0);
    info!("WebSocket: Listing sessions (cwd={:?}, limit={}, offset={})", cwd, limit, offset);
    let response = state.session_registry.list_sessions(cwd, limit, offset);
    info!("WebSocket: Found {} sessions (total: {})", response.sessions.len(), response.total);
    response
}

async fn resume_session_handler(state: &Arc<AppState>, session_id: &str, cwd: &str) -> Result<NewSessionResponse, String> {
    info!("WebSocket: Resuming session {} in {}", session_id, cwd);

    // Ensure ACP agent is running before resuming session
    ensure_agent_connected(state).await?;

    let manager = AgentManager::new(state.client.clone());
    let response = manager.resume_session(session_id, cwd).await.map_err(|e: AcpError| e.to_string())?;

    // Register session in the registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd.to_string(),
        response.modes.clone(),
        response.models.clone(),
    );

    // Load historical chat items from JSONL file
    let chat_items = state.session_registry.load_chat_items(session_id);
    info!("Loaded {} historical chat items for session {}", chat_items.len(), session_id);

    // Create session state with historical chat items
    state.session_state_manager.create_session_with_history(
        response.session_id.clone(),
        cwd.to_string(),
        response.modes.clone(),
        response.models.clone(),
        chat_items,
    );

    // Set as current active session and broadcast to all clients
    state.set_current_session(Some(response.session_id.clone())).await;

    info!("WebSocket: Resumed session: {}", response.session_id);
    Ok(response)
}

async fn fork_session_handler(state: &Arc<AppState>, session_id: &str, cwd: &str) -> Result<NewSessionResponse, String> {
    info!("WebSocket: Forking session {} in {}", session_id, cwd);

    // Ensure ACP agent is running before forking session
    ensure_agent_connected(state).await?;

    let manager = AgentManager::new(state.client.clone());
    let response = manager.fork_session(session_id, cwd).await.map_err(|e: AcpError| e.to_string())?;

    // Register new session in the registry
    state.session_registry.register_session(
        response.session_id.clone(),
        cwd.to_string(),
        response.modes.clone(),
        response.models.clone(),
    );

    // Load historical chat items from JSONL file
    let chat_items = state.session_registry.load_chat_items(session_id);
    info!("Loaded {} historical chat items for forked session {}", chat_items.len(), session_id);

    // Create session state with historical chat items
    state.session_state_manager.create_session_with_history(
        response.session_id.clone(),
        cwd.to_string(),
        response.modes.clone(),
        response.models.clone(),
        chat_items,
    );

    // Set as current active session and broadcast to all clients
    state.set_current_session(Some(response.session_id.clone())).await;

    info!("WebSocket: Forked session {} -> {}", session_id, response.session_id);
    Ok(response)
}

async fn get_session_info_handler(state: &Arc<AppState>, session_id: &str) -> Result<SessionInfo, String> {
    info!("WebSocket: Getting session info: {}", session_id);
    state.session_registry.get_session_info(session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))
}

fn delete_session_handler(state: &Arc<AppState>, session_id: &str) -> Result<bool, String> {
    info!("WebSocket: Deleting session: {}", session_id);
    // Also remove from session state manager if present
    state.session_state_manager.remove_session(&session_id.to_string());
    state.session_registry.delete_session(session_id)
}

// File handlers
use crate::commands::file::{DirEntry, FileInfo, BinaryFileContent};

async fn list_directory_handler(path: &str, show_hidden: bool) -> Result<Vec<DirEntry>, String> {
    crate::commands::file::list_directory_impl(path, show_hidden).await
}

async fn read_file_handler(path: &str) -> Result<String, String> {
    crate::commands::file::read_file_impl(path).await
}

async fn read_file_binary_handler(path: &str) -> Result<BinaryFileContent, String> {
    crate::commands::file::read_file_binary_impl(path).await
}

async fn get_file_info_handler(path: &str) -> Result<FileInfo, String> {
    crate::commands::file::get_file_info_impl(path).await
}

async fn write_file_handler(path: &str, content: &str) -> Result<(), String> {
    crate::commands::file::write_file_impl(path, content).await
}

async fn write_file_binary_handler(path: &str, content: &str) -> Result<(), String> {
    crate::commands::file::write_file_binary_impl(path, content).await
}

async fn create_file_handler(path: &str) -> Result<(), String> {
    crate::commands::file::create_file_impl(path).await
}

async fn create_directory_handler(path: &str) -> Result<(), String> {
    crate::commands::file::create_directory_impl(path).await
}

async fn delete_path_handler(path: &str) -> Result<(), String> {
    crate::commands::file::delete_path_impl(path).await
}

async fn rename_path_handler(from: &str, to: &str) -> Result<(), String> {
    crate::commands::file::rename_path_impl(from, to).await
}

// Terminal handlers
use crate::core::terminal::TerminalInfo;

async fn create_terminal_handler(state: &Arc<AppState>, cwd: Option<&str>, cols: u16, rows: u16) -> Result<String, String> {
    let cwd = cwd.map(|s| s.to_string()).unwrap_or_else(|| std::env::var("HOME").unwrap_or_else(|_| "/".to_string()));
    state.terminal_manager.create_terminal(cwd, cols, rows)
}

async fn write_terminal_handler(state: &Arc<AppState>, terminal_id: &str, data: &str) -> Result<(), String> {
    state.terminal_manager.write_to_terminal(terminal_id, data)
}

async fn resize_terminal_handler(state: &Arc<AppState>, terminal_id: &str, cols: u16, rows: u16) -> Result<(), String> {
    state.terminal_manager.resize_terminal(terminal_id, cols, rows)
}

async fn kill_terminal_handler(state: &Arc<AppState>, terminal_id: &str) -> Result<(), String> {
    state.terminal_manager.kill_terminal(terminal_id)
}

async fn list_terminals_handler(state: &Arc<AppState>) -> Result<Vec<TerminalInfo>, String> {
    Ok(state.terminal_manager.list_terminals())
}

// Plugin handlers
use crate::core::{
    AddMarketplaceRequest, InstallPluginRequest, InstallPluginResponse,
    ListPluginsResponse, MarketplaceResponse, PluginManager, UninstallPluginResponse,
};

fn list_plugins_handler() -> Result<ListPluginsResponse, String> {
    PluginManager::list_plugins()
}

async fn add_marketplace_handler(name: &str, git_url: &str) -> Result<MarketplaceResponse, String> {
    let request = AddMarketplaceRequest {
        name: name.to_string(),
        git_url: git_url.to_string(),
    };
    PluginManager::add_marketplace(request).await
}

fn delete_marketplace_handler(name: &str) -> Result<MarketplaceResponse, String> {
    PluginManager::delete_marketplace(name)
}

async fn update_marketplace_handler(name: &str) -> Result<MarketplaceResponse, String> {
    PluginManager::update_marketplace(name).await
}

fn install_plugin_handler(plugin_name: &str, marketplace_name: &str) -> Result<InstallPluginResponse, String> {
    let request = InstallPluginRequest {
        plugin_name: plugin_name.to_string(),
        marketplace_name: marketplace_name.to_string(),
    };
    PluginManager::install_plugin(request)
}

fn uninstall_plugin_handler(plugin_key: &str) -> Result<UninstallPluginResponse, String> {
    PluginManager::uninstall_plugin(plugin_key)
}

fn toggle_marketplace_handler(name: &str, enabled: bool) -> Result<MarketplaceResponse, String> {
    PluginManager::toggle_marketplace(name, enabled)
}

// ===== Recent Projects Persistence =====

const MAX_RECENT_PROJECTS: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecentProject {
    path: String,
    name: String,
    #[serde(rename = "lastOpened")]
    last_opened: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct RecentProjectsConfig {
    projects: Vec<RecentProject>,
}

/// Get the config directory path (~/.config/aerowork/)
fn get_config_dir() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home.join(".config").join("aerowork");

    // Create directory if it doesn't exist
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir)
}

/// Get the recent projects config file path
fn get_recent_projects_path() -> Result<std::path::PathBuf, String> {
    Ok(get_config_dir()?.join("recent-projects.json"))
}

/// Load recent projects from config file
fn load_recent_projects() -> Result<Vec<RecentProject>, String> {
    let config_path = get_recent_projects_path()?;

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read recent projects: {}", e))?;

    let config: RecentProjectsConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recent projects: {}", e))?;

    Ok(config.projects)
}

/// Save recent projects to config file
fn save_recent_projects(projects: &[RecentProject]) -> Result<(), String> {
    let config_path = get_recent_projects_path()?;
    let config = RecentProjectsConfig {
        projects: projects.to_vec(),
    };

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write recent projects: {}", e))?;

    Ok(())
}

/// Add a project to recent projects list
fn add_recent_project(path: &str, name: Option<&str>) -> Result<(), String> {
    let mut projects = load_recent_projects().unwrap_or_default();

    // Remove existing entry with same path
    projects.retain(|p| p.path != path);

    // Create new entry
    let project_name = name
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string())
        });

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    // Insert at the beginning
    projects.insert(0, RecentProject {
        path: path.to_string(),
        name: project_name,
        last_opened: now,
    });

    // Limit to max projects
    if projects.len() > MAX_RECENT_PROJECTS {
        projects.truncate(MAX_RECENT_PROJECTS);
    }

    save_recent_projects(&projects)
}

/// Remove a project from recent projects list
fn remove_recent_project(path: &str) -> Result<(), String> {
    let mut projects = load_recent_projects().unwrap_or_default();
    projects.retain(|p| p.path != path);
    save_recent_projects(&projects)
}

/// Clear all recent projects
fn clear_recent_projects() -> Result<(), String> {
    save_recent_projects(&[])
}
