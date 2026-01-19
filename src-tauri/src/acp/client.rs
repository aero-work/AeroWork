use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot};
use tracing::{debug, error, info, warn};

use super::types::*;

#[derive(Debug, thiserror::Error)]
pub enum AcpError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Agent process error: {0}")]
    Process(String),

    #[error("RPC error {code}: {message}")]
    Rpc { code: i32, message: String, data: Option<serde_json::Value> },

    #[error("Request timeout")]
    Timeout,

    #[error("Channel closed")]
    ChannelClosed,

    #[error("Not connected")]
    NotConnected,
}

pub type Result<T> = std::result::Result<T, AcpError>;

type PendingRequest = oneshot::Sender<std::result::Result<serde_json::Value, AcpError>>;

pub struct AcpClient {
    child: Option<Child>,
    request_id: AtomicU64,
    pending_requests: Arc<RwLock<HashMap<u64, PendingRequest>>>,
    write_tx: Option<mpsc::Sender<String>>,
    notification_tx: mpsc::Sender<SessionNotification>,
    permission_tx: mpsc::Sender<PermissionRequest>,
}

impl AcpClient {
    pub fn new(
        notification_tx: mpsc::Sender<SessionNotification>,
        permission_tx: mpsc::Sender<PermissionRequest>,
    ) -> Self {
        Self {
            child: None,
            request_id: AtomicU64::new(1),
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            write_tx: None,
            notification_tx,
            permission_tx,
        }
    }

    pub async fn connect(
        &mut self,
        command: &str,
        args: &[&str],
        env_vars: Option<Vec<(String, String)>>,
    ) -> Result<()> {
        info!("Starting ACP agent: {} {:?}", command, args);

        let mut cmd = Command::new(command);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Apply any custom environment variables (e.g., CLAUDE_CODE_EXECUTABLE for bundled CLI)
        if let Some(vars) = env_vars {
            for (key, value) in vars {
                info!("Setting env var: {}={}", key, value);
                cmd.env(key, value);
            }
        }

        // On macOS, when launched via .app bundle (double-click), the environment is minimal.
        // We need to load the user's shell environment to find npx and other tools.
        #[cfg(target_os = "macos")]
        {
            // Try to get full shell environment by running a login shell
            let shell_env = get_shell_environment();

            // Apply shell environment variables (except a few we want to control)
            for (key, value) in &shell_env {
                // Skip PATH - we'll handle it specially
                if key != "PATH" && key != "PWD" && key != "_" {
                    cmd.env(key, value);
                }
            }

            // Build comprehensive PATH
            let shell_path = shell_env.get("PATH").map(|s| s.as_str()).unwrap_or("");
            let current_path = std::env::var("PATH").unwrap_or_default();
            let home = std::env::var("HOME").unwrap_or_default();

            let mut additional_paths = vec![
                "/usr/local/bin".to_string(),
                "/opt/homebrew/bin".to_string(),
                "/opt/local/bin".to_string(),
                format!("{}/.local/bin", home),
                format!("{}/Library/pnpm", home),
                format!("{}/.bun/bin", home),
                format!("{}/.cargo/bin", home),
            ];

            // Find nvm node versions
            let nvm_versions_dir = format!("{}/.nvm/versions/node", home);
            if let Ok(entries) = std::fs::read_dir(&nvm_versions_dir) {
                for entry in entries.flatten() {
                    let bin_path = entry.path().join("bin");
                    if bin_path.exists() {
                        additional_paths.push(bin_path.to_string_lossy().to_string());
                    }
                }
            }

            // Combine: additional paths + shell PATH + current PATH
            let new_path = format!("{}:{}:{}", additional_paths.join(":"), shell_path, current_path);
            cmd.env("PATH", new_path);
        }

        // On Linux, also ensure common paths are included
        #[cfg(target_os = "linux")]
        {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let home = std::env::var("HOME").unwrap_or_default();

            let additional_paths = vec![
                "/usr/local/bin".to_string(),
                format!("{}/.local/bin", home),
                format!("{}/.bun/bin", home),
                format!("{}/.cargo/bin", home),
                format!("{}/.nvm/versions/node/*/bin", home), // Won't work as glob, but nvm sets PATH anyway
            ];

            // Find nvm node versions
            let nvm_versions_dir = format!("{}/.nvm/versions/node", home);
            if let Ok(entries) = std::fs::read_dir(&nvm_versions_dir) {
                for entry in entries.flatten() {
                    let bin_path = entry.path().join("bin");
                    if bin_path.exists() {
                        cmd.env("PATH", format!("{}:{}", bin_path.to_string_lossy(), current_path.clone()));
                    }
                }
            }

            let new_path = format!("{}:{}", additional_paths.join(":"), current_path);
            cmd.env("PATH", new_path);
        }

        let mut child = cmd.spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| {
            AcpError::Process("Failed to get stdin handle".to_string())
        })?;

        let stdout = child.stdout.take().ok_or_else(|| {
            AcpError::Process("Failed to get stdout handle".to_string())
        })?;

        let stderr = child.stderr.take().ok_or_else(|| {
            AcpError::Process("Failed to get stderr handle".to_string())
        })?;

        let (write_tx, mut write_rx) = mpsc::channel::<String>(100);

        let mut stdin = stdin;
        tokio::spawn(async move {
            while let Some(msg) = write_rx.recv().await {
                if let Err(e) = stdin.write_all(msg.as_bytes()).await {
                    error!("Failed to write to stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.write_all(b"\n").await {
                    error!("Failed to write newline: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush().await {
                    error!("Failed to flush stdin: {}", e);
                    break;
                }
            }
        });

        let pending_requests = self.pending_requests.clone();
        let notification_tx = self.notification_tx.clone();
        let permission_tx = self.permission_tx.clone();

        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }

                debug!("Received: {}", line);

                // Try to parse as a generic JSON object to determine message type
                let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) else {
                    warn!("Failed to parse JSON: {}", line);
                    continue;
                };

                let has_id = msg.get("id").is_some();
                let has_method = msg.get("method").is_some();
                let has_result = msg.get("result").is_some();
                let has_error = msg.get("error").is_some();

                if has_id && (has_result || has_error) {
                    // This is a response to one of our requests
                    if let Ok(response) = serde_json::from_value::<JsonRpcResponse>(msg) {
                        if let Some(id) = response.id.as_u64() {
                            let mut pending = pending_requests.write();
                            if let Some(sender) = pending.remove(&id) {
                                let result = if let Some(error) = response.error {
                                    Err(AcpError::Rpc {
                                        code: error.code,
                                        message: error.message,
                                        data: error.data,
                                    })
                                } else {
                                    Ok(response.result.unwrap_or(serde_json::Value::Null))
                                };
                                let _ = sender.send(result);
                            }
                        }
                    }
                } else if has_id && has_method {
                    // This is a request FROM the agent (we need to respond)
                    if let Ok(request) = serde_json::from_value::<JsonRpcRequest>(msg) {
                        match request.method.as_str() {
                            "session/request_permission" => {
                                if let Some(params) = request.params {
                                    info!("Received permission request (id={:?}): {}", request.id, params);

                                    // Parse the permission request params
                                    #[derive(serde::Deserialize)]
                                    #[serde(rename_all = "camelCase")]
                                    struct PermissionParams {
                                        session_id: String,
                                        tool_call: ToolCallUpdate,
                                        options: Vec<PermissionOption>,
                                    }

                                    match serde_json::from_value::<PermissionParams>(params) {
                                        Ok(params) => {
                                            info!("Parsed permission request for session: {}", params.session_id);
                                            // Include the request ID so we can respond correctly
                                            let permission_request = PermissionRequest {
                                                request_id: request.id,
                                                session_id: params.session_id,
                                                tool_call: params.tool_call,
                                                options: params.options,
                                            };
                                            let _ = permission_tx.send(permission_request).await;
                                        }
                                        Err(e) => {
                                            error!("Failed to parse permission request params: {}", e);
                                        }
                                    }
                                }
                            }
                            _ => {
                                warn!("Unhandled agent request: {}", request.method);
                            }
                        }
                    }
                } else if has_method {
                    // This is a notification (no id)
                    if let Ok(notification) = serde_json::from_value::<JsonRpcNotification>(msg) {
                        match notification.method.as_str() {
                            "session/update" => {
                                if let Some(params) = notification.params {
                                    match serde_json::from_value::<SessionNotification>(params.clone()) {
                                        Ok(session_notification) => {
                                            debug!("Parsed session notification for session: {}", session_notification.session_id);
                                            if let Err(e) = notification_tx.send(session_notification).await {
                                                error!("Failed to send notification through channel: {}", e);
                                            }
                                        }
                                        Err(e) => {
                                            error!("Failed to parse session notification: {} - params: {:?}", e, params);
                                        }
                                    }
                                }
                            }
                            _ => {
                                debug!("Unknown notification: {}", notification.method);
                            }
                        }
                    }
                } else {
                    warn!("Unknown message type: {}", line);
                }
            }
        });

        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                warn!("Agent stderr: {}", line);
            }
        });

        self.child = Some(child);
        self.write_tx = Some(write_tx);

        Ok(())
    }

    pub async fn disconnect(&mut self) -> Result<()> {
        self.write_tx = None;

        if let Some(mut child) = self.child.take() {
            let _ = child.kill().await;
        }

        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.write_tx.is_some()
    }

    async fn send_request<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<T> {
        let write_tx = self.write_tx.as_ref().ok_or(AcpError::NotConnected)?;

        let id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: serde_json::Value::Number(id.into()),
            method: method.to_string(),
            params,
        };

        let (response_tx, response_rx) = oneshot::channel();

        {
            let mut pending = self.pending_requests.write();
            pending.insert(id, response_tx);
        }

        let json = serde_json::to_string(&request)?;
        debug!("Sending: {}", json);

        write_tx
            .send(json)
            .await
            .map_err(|_| AcpError::ChannelClosed)?;

        let result = tokio::time::timeout(std::time::Duration::from_secs(300), response_rx)
            .await
            .map_err(|_| AcpError::Timeout)?
            .map_err(|_| AcpError::ChannelClosed)??;

        let value: T = serde_json::from_value(result)?;
        Ok(value)
    }

    async fn send_notification(&self, method: &str, params: Option<serde_json::Value>) -> Result<()> {
        let write_tx = self.write_tx.as_ref().ok_or(AcpError::NotConnected)?;

        let notification = JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };

        let json = serde_json::to_string(&notification)?;
        debug!("Sending notification: {}", json);

        write_tx
            .send(json)
            .await
            .map_err(|_| AcpError::ChannelClosed)?;

        Ok(())
    }

    pub async fn initialize(&self) -> Result<InitializeResponse> {
        let params = InitializeRequest {
            protocol_version: 1,
            client_info: Some(Implementation {
                name: "aero-work".to_string(),
                title: Some("Aero Work".to_string()),
                version: env!("CARGO_PKG_VERSION").to_string(),
            }),
            client_capabilities: Some(ClientCapabilities {
                fs: None,      // Not implemented yet
                terminal: None, // Not implemented yet
            }),
        };

        self.send_request("initialize", Some(serde_json::to_value(params)?))
            .await
    }

    pub async fn create_session(&self, cwd: &str) -> Result<NewSessionResponse> {
        let params = NewSessionRequest {
            cwd: cwd.to_string(),
            mcp_servers: vec![],
        };

        self.send_request("session/new", Some(serde_json::to_value(params)?))
            .await
    }

    /// Resume an existing session (unstable API)
    ///
    /// This reattaches to an existing session without replaying history.
    /// The session must exist in ~/.claude/projects/{path_key}/{session_id}.jsonl
    pub async fn resume_session(&self, session_id: &str, cwd: &str) -> Result<NewSessionResponse> {
        let params = ResumeSessionRequest {
            session_id: session_id.to_string(),
            cwd: cwd.to_string(),
            mcp_servers: vec![],
        };

        info!("Resuming session {} in {}", session_id, cwd);
        self.send_request("session/resume", Some(serde_json::to_value(params)?))
            .await
    }

    /// Fork an existing session (unstable API)
    ///
    /// This creates a new session based on an existing one with a new ID.
    pub async fn fork_session(&self, session_id: &str, cwd: &str) -> Result<NewSessionResponse> {
        let params = ForkSessionRequest {
            session_id: session_id.to_string(),
            cwd: cwd.to_string(),
            mcp_servers: vec![],
        };

        info!("Forking session {} in {}", session_id, cwd);
        self.send_request("session/fork", Some(serde_json::to_value(params)?))
            .await
    }

    pub async fn prompt(&self, session_id: &str, content: &str) -> Result<PromptResponse> {
        let params = PromptRequest {
            session_id: session_id.to_string(),
            prompt: vec![ContentBlock::Text {
                text: content.to_string(),
            }],
        };

        self.send_request("session/prompt", Some(serde_json::to_value(params)?))
            .await
    }

    pub async fn cancel(&self, session_id: &str) -> Result<()> {
        let params = CancelNotification {
            session_id: session_id.to_string(),
        };

        self.send_notification("session/cancel", Some(serde_json::to_value(params)?))
            .await
    }

    pub async fn set_session_mode(&self, session_id: &str, mode_id: &str) -> Result<()> {
        let params = SetSessionModeRequest {
            session_id: session_id.to_string(),
            mode_id: mode_id.to_string(),
        };

        self.send_request::<serde_json::Value>("session/set_mode", Some(serde_json::to_value(params)?))
            .await?;

        Ok(())
    }

    pub async fn respond_permission(
        &self,
        request_id: RequestId,
        outcome: PermissionOutcome,
    ) -> Result<()> {
        let write_tx = self.write_tx.as_ref().ok_or(AcpError::NotConnected)?;

        // The result must be wrapped in RequestPermissionResult format
        // which has an "outcome" field containing the PermissionOutcome
        #[derive(serde::Serialize)]
        struct RequestPermissionResult {
            outcome: PermissionOutcome,
        }

        let result = RequestPermissionResult { outcome };

        // Send a JSON-RPC response to the agent's request
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request_id,
            result: Some(serde_json::to_value(result)?),
            error: None,
        };

        let json = serde_json::to_string(&response)?;
        info!("Sending permission response: {}", json);

        write_tx
            .send(json)
            .await
            .map_err(|_| AcpError::ChannelClosed)?;

        Ok(())
    }
}

impl Drop for AcpClient {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.start_kill();
        }
    }
}

/// Get environment variables from user's login shell.
/// This is important on macOS where GUI apps don't inherit shell environment.
#[cfg(target_os = "macos")]
fn get_shell_environment() -> HashMap<String, String> {
    use std::process::Command as StdCommand;

    let mut env_map = HashMap::new();

    // Try to get the user's default shell
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // Run a login shell to get environment variables
    // Using -l for login shell and -c to execute a command
    let result = StdCommand::new(&shell)
        .args(["-l", "-c", "env"])
        .output();

    match result {
        Ok(output) if output.status.success() => {
            let env_output = String::from_utf8_lossy(&output.stdout);
            for line in env_output.lines() {
                if let Some((key, value)) = line.split_once('=') {
                    env_map.insert(key.to_string(), value.to_string());
                }
            }
            info!("Loaded {} environment variables from login shell", env_map.len());
        }
        Ok(output) => {
            warn!("Login shell returned error: {:?}", String::from_utf8_lossy(&output.stderr));
        }
        Err(e) => {
            warn!("Failed to run login shell {}: {}", shell, e);
        }
    }

    env_map
}
