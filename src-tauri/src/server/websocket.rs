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
use tracing::{info, warn};

use crate::acp::{AcpError, InitializeResponse, NewSessionResponse, PermissionOutcome, PromptResponse};
use crate::core::{AgentManager, AppState};

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

    pub async fn start(self, port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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

        let addr = format!("0.0.0.0:{}", port);
        let listener = tokio::net::TcpListener::bind(&addr).await?;

        info!("WebSocket server listening on {}", addr);

        axum::serve(listener, app).await?;

        Ok(())
    }

    async fn start_event_forwarding(state: Arc<AppState>, event_tx: broadcast::Sender<String>) {
        // Forward session notifications
        let notification_rx = state.notification_rx.write().take();
        if let Some(mut rx) = notification_rx {
            let tx = event_tx.clone();
            tokio::spawn(async move {
                while let Some(notification) = rx.recv().await {
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

        // Forward permission requests
        let permission_rx = state.permission_rx.write().take();
        if let Some(mut rx) = permission_rx {
            let tx = event_tx.clone();
            tokio::spawn(async move {
                while let Some(request) = rx.recv().await {
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
    }
}

struct ServerState {
    app_state: Arc<AppState>,
    event_tx: broadcast::Sender<String>,
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

    // Subscribe to broadcast events
    let mut event_rx = state.event_tx.subscribe();

    // Channel for sending messages to WebSocket
    let (ws_tx, mut ws_rx) = mpsc::channel::<String>(100);

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

    // Handle incoming messages
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                let response = handle_message(&text, &state).await;
                if ws_tx.send(response).await.is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {} // Ignore other message types
            Err(e) => {
                warn!("WebSocket error: {}", e);
                break;
            }
        }
    }

    // Clean up
    event_task.abort();
    write_task.abort();
    info!("WebSocket connection closed");
}

async fn handle_message(text: &str, state: &Arc<ServerState>) -> String {
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

    let result = dispatch_method(&request.method, request.params, &state.app_state).await;

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
) -> Result<serde_json::Value, String> {
    let params = params.unwrap_or(serde_json::Value::Null);

    match method {
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
            let outcome: PermissionOutcome = serde_json::from_value(
                params.get("outcome").cloned().unwrap_or_default()
            ).map_err(|e| e.to_string())?;
            respond_permission_handler(state, request_id, outcome).await?;
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
            let response = send_prompt_handler(state, session_id, content).await?;
            serde_json::to_value(response).map_err(|e| e.to_string())
        }
        "cancel_session" => {
            let session_id = params.get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or("Missing sessionId parameter")?;
            cancel_session_handler(state, session_id).await?;
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

        // File commands
        "list_directory" => {
            let path = params.get("path")
                .and_then(|v| v.as_str())
                .ok_or("Missing path parameter")?;
            let entries = list_directory_handler(path).await?;
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

        _ => Err(format!("Unknown method: {}", method)),
    }
}

// Handler implementations (reusing core logic)

async fn connect_handler(state: &Arc<AppState>) -> Result<(), String> {
    info!("WebSocket: Connecting to ACP agent...");
    let manager = AgentManager::new(state.client.clone());
    let notification_tx = state.notification_tx.clone();
    let permission_tx = state.permission_tx.clone();

    manager
        .connect(notification_tx, permission_tx)
        .await
        .map_err(|e: AcpError| e.to_string())?;

    info!("WebSocket: Connected to ACP agent");
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
    info!("WebSocket: Initializing ACP agent...");
    let manager = AgentManager::new(state.client.clone());
    let response = manager.initialize().await.map_err(|e: AcpError| e.to_string())?;
    info!("WebSocket: Initialized ACP agent: {:?}", response.agent_info);
    Ok(response)
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
    let manager = AgentManager::new(state.client.clone());
    let response = manager.create_session(cwd).await.map_err(|e: AcpError| e.to_string())?;
    info!("WebSocket: Created session: {}", response.session_id);
    Ok(response)
}

async fn send_prompt_handler(state: &Arc<AppState>, session_id: &str, content: &str) -> Result<PromptResponse, String> {
    info!("WebSocket: Sending prompt to session {}", session_id);
    let manager = AgentManager::new(state.client.clone());
    let response = manager.prompt(session_id, content).await.map_err(|e: AcpError| e.to_string())?;
    info!("WebSocket: Prompt completed with stop_reason: {:?}", response.stop_reason);
    Ok(response)
}

async fn cancel_session_handler(state: &Arc<AppState>, session_id: &str) -> Result<(), String> {
    info!("WebSocket: Cancelling session {}", session_id);
    let manager = AgentManager::new(state.client.clone());
    manager.cancel(session_id).await.map_err(|e: AcpError| e.to_string())
}

async fn set_session_mode_handler(state: &Arc<AppState>, session_id: &str, mode_id: &str) -> Result<(), String> {
    info!("WebSocket: Setting session {} mode to {}", session_id, mode_id);
    let manager = AgentManager::new(state.client.clone());
    manager.set_session_mode(session_id, mode_id).await.map_err(|e: AcpError| e.to_string())
}

// File handlers
use crate::commands::file::{DirEntry};

async fn list_directory_handler(path: &str) -> Result<Vec<DirEntry>, String> {
    crate::commands::file::list_directory_impl(path).await
}

async fn read_file_handler(path: &str) -> Result<String, String> {
    crate::commands::file::read_file_impl(path).await
}

async fn write_file_handler(path: &str, content: &str) -> Result<(), String> {
    crate::commands::file::write_file_impl(path, content).await
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
