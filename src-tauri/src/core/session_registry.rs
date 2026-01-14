//! Session Registry Module
//!
//! Manages session state for both desktop and web clients.
//! Scans Claude Code session files from ~/.claude/projects/ directory
//! and tracks active sessions in memory.

use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::acp::{SessionId, SessionModeState, SessionModelState};
use super::session_state::{ChatItem, Message, MessageRole};

/// Information about a session (both active and historical)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    /// Session ID
    pub id: SessionId,
    /// Human-readable summary/preview
    pub summary: String,
    /// Number of messages in the session
    pub message_count: u32,
    /// Last activity timestamp (ISO 8601)
    pub last_activity: String,
    /// Working directory for the session
    pub cwd: String,
    /// Whether session is currently active (connected to agent)
    pub active: bool,
    /// Project key (derived from cwd)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    /// Preview of the last user message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_user_message: Option<String>,
    /// Preview of the last assistant message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_assistant_message: Option<String>,
}

/// Active session state in memory
#[derive(Debug, Clone)]
pub struct ActiveSession {
    pub id: SessionId,
    pub cwd: String,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub modes: Option<SessionModeState>,
    pub models: Option<SessionModelState>,
}

/// Response for list_sessions command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsResponse {
    pub sessions: Vec<SessionInfo>,
    pub has_more: bool,
    pub total: usize,
}

/// Session Registry - central management of sessions
pub struct SessionRegistry {
    /// Active sessions (connected to agent)
    active_sessions: RwLock<HashMap<SessionId, ActiveSession>>,
    /// Path to Claude projects directory (~/.claude/projects)
    projects_dir: PathBuf,
}

impl SessionRegistry {
    pub fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let projects_dir = home.join(".claude").join("projects");

        Self {
            active_sessions: RwLock::new(HashMap::new()),
            projects_dir,
        }
    }

    /// Register a new active session
    pub fn register_session(
        &self,
        id: SessionId,
        cwd: String,
        modes: Option<SessionModeState>,
        models: Option<SessionModelState>,
    ) {
        let now = Utc::now();
        let session = ActiveSession {
            id: id.clone(),
            cwd,
            created_at: now,
            last_activity: now,
            modes,
            models,
        };

        let mut sessions = self.active_sessions.write();
        sessions.insert(id.clone(), session);
        info!("Registered active session: {}", id);
    }

    /// Unregister a session (disconnected)
    pub fn unregister_session(&self, id: &SessionId) {
        let mut sessions = self.active_sessions.write();
        if sessions.remove(id).is_some() {
            info!("Unregistered session: {}", id);
        }
    }

    /// Update session last activity
    pub fn update_activity(&self, id: &SessionId) {
        let mut sessions = self.active_sessions.write();
        if let Some(session) = sessions.get_mut(id) {
            session.last_activity = Utc::now();
        }
    }

    /// Update session modes
    pub fn update_modes(&self, id: &SessionId, modes: SessionModeState) {
        let mut sessions = self.active_sessions.write();
        if let Some(session) = sessions.get_mut(id) {
            session.modes = Some(modes);
        }
    }

    /// Get active session
    pub fn get_active_session(&self, id: &SessionId) -> Option<ActiveSession> {
        let sessions = self.active_sessions.read();
        sessions.get(id).cloned()
    }

    /// Check if session is active
    pub fn is_session_active(&self, id: &SessionId) -> bool {
        let sessions = self.active_sessions.read();
        sessions.contains_key(id)
    }

    /// Get all active sessions
    pub fn get_active_sessions(&self) -> Vec<ActiveSession> {
        let sessions = self.active_sessions.read();
        sessions.values().cloned().collect()
    }

    /// List available sessions (both active and historical)
    ///
    /// Scans ~/.claude/projects/ for session files and merges with active sessions
    pub fn list_sessions(
        &self,
        cwd: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> ListSessionsResponse {
        let mut all_sessions: HashMap<SessionId, SessionInfo> = HashMap::new();

        // 1. Add active sessions from memory
        {
            let active = self.active_sessions.read();
            for (id, session) in active.iter() {
                // Filter by cwd if specified
                if let Some(filter_cwd) = cwd {
                    if session.cwd != filter_cwd {
                        continue;
                    }
                }

                all_sessions.insert(
                    id.clone(),
                    SessionInfo {
                        id: id.clone(),
                        summary: "Active session".to_string(),
                        message_count: 0,
                        last_activity: session.last_activity.to_rfc3339(),
                        cwd: session.cwd.clone(),
                        active: true,
                        project: Some(cwd_to_path_key(&session.cwd)),
                        last_user_message: None,
                        last_assistant_message: None,
                    },
                );
            }
        }

        // 2. Scan session files from disk
        if self.projects_dir.exists() {
            let project_dirs: Vec<_> = if let Some(filter_cwd) = cwd {
                let path_key = cwd_to_path_key(filter_cwd);
                vec![self.projects_dir.join(&path_key)]
            } else {
                match std::fs::read_dir(&self.projects_dir) {
                    Ok(entries) => entries
                        .filter_map(|e| e.ok())
                        .map(|e| e.path())
                        .filter(|p| p.is_dir())
                        .collect(),
                    Err(e) => {
                        warn!("Failed to read projects directory: {}", e);
                        vec![]
                    }
                }
            };

            for project_dir in project_dirs {
                if !project_dir.exists() || !project_dir.is_dir() {
                    continue;
                }

                let project_name = project_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Read all .jsonl files in the project directory
                if let Ok(entries) = std::fs::read_dir(&project_dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let path = entry.path();
                        if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                            if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                                // Skip if already in active sessions
                                if all_sessions.contains_key(session_id) {
                                    // Update the active session with parsed metadata
                                    if let Some(parsed) = parse_session_file(&path) {
                                        if let Some(existing) = all_sessions.get_mut(session_id) {
                                            existing.summary = parsed.summary;
                                            existing.message_count = parsed.message_count;
                                            existing.last_user_message = parsed.last_user_message;
                                            existing.last_assistant_message =
                                                parsed.last_assistant_message;
                                        }
                                    }
                                    continue;
                                }

                                // Skip agent sessions
                                if session_id.starts_with("agent-") {
                                    continue;
                                }

                                // Parse session file
                                if let Some(mut info) = parse_session_file(&path) {
                                    info.id = session_id.to_string();
                                    info.active = false;
                                    info.project = Some(project_name.clone());

                                    // Derive cwd from project name if not set
                                    if info.cwd.is_empty() {
                                        info.cwd = path_key_to_cwd(&project_name);
                                    }

                                    all_sessions.insert(session_id.to_string(), info);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Sort by last activity (newest first)
        let mut sessions: Vec<_> = all_sessions.into_values().collect();
        sessions.sort_by(|a, b| b.last_activity.cmp(&a.last_activity));

        // 4. Apply pagination
        let total = sessions.len();
        let paginated: Vec<_> = sessions.into_iter().skip(offset).take(limit).collect();
        let has_more = offset + limit < total;

        ListSessionsResponse {
            sessions: paginated,
            has_more,
            total,
        }
    }

    /// Find session file path for a given session ID
    pub fn find_session_file(&self, session_id: &str) -> Option<PathBuf> {
        if !self.projects_dir.exists() {
            return None;
        }

        // Search all project directories
        if let Ok(entries) = std::fs::read_dir(&self.projects_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let project_dir = entry.path();
                if !project_dir.is_dir() {
                    continue;
                }

                let session_file = project_dir.join(format!("{}.jsonl", session_id));
                if session_file.exists() {
                    return Some(session_file);
                }
            }
        }

        None
    }

    /// Load chat items for a session from its JSONL file
    pub fn load_chat_items(&self, session_id: &str) -> Vec<ChatItem> {
        if let Some(file_path) = self.find_session_file(session_id) {
            load_session_chat_items(&file_path)
        } else {
            debug!("No session file found for {}", session_id);
            Vec::new()
        }
    }

    /// Get session info by ID (active or from disk)
    pub fn get_session_info(&self, session_id: &str) -> Option<SessionInfo> {
        // Check active sessions first
        {
            let active = self.active_sessions.read();
            if let Some(session) = active.get(session_id) {
                return Some(SessionInfo {
                    id: session_id.to_string(),
                    summary: "Active session".to_string(),
                    message_count: 0,
                    last_activity: session.last_activity.to_rfc3339(),
                    cwd: session.cwd.clone(),
                    active: true,
                    project: Some(cwd_to_path_key(&session.cwd)),
                    last_user_message: None,
                    last_assistant_message: None,
                });
            }
        }

        // Try to find on disk
        if let Some(file_path) = self.find_session_file(session_id) {
            if let Some(mut info) = parse_session_file(&file_path) {
                info.id = session_id.to_string();
                info.active = false;

                // Get project from parent directory
                if let Some(project_dir) = file_path.parent() {
                    if let Some(project_name) = project_dir.file_name().and_then(|n| n.to_str()) {
                        info.project = Some(project_name.to_string());
                        if info.cwd.is_empty() {
                            info.cwd = path_key_to_cwd(project_name);
                        }
                    }
                }

                return Some(info);
            }
        }

        None
    }
}

impl Default for SessionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert cwd path to Claude's path_key format
/// e.g., "/Users/foo/project" -> "-Users-foo-project"
/// e.g., "/Users/foo/my_project" -> "-Users-foo-my-project"
/// Note: Both '/' and '_' are replaced with '-'
/// Also resolves symlinks to get the canonical path
fn cwd_to_path_key(cwd: &str) -> String {
    // Try to resolve symlinks to get canonical path (like Claude Code does)
    let resolved = std::fs::canonicalize(cwd)
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
        .unwrap_or_else(|| cwd.to_string());
    resolved.replace('/', "-").replace('_', "-")
}

/// Convert path_key back to cwd (approximate)
/// e.g., "-Users-foo-project" -> "/Users/foo/project"
fn path_key_to_cwd(path_key: &str) -> String {
    path_key.replace('-', "/")
}

/// Truncate a string to approximately max_chars characters, respecting char boundaries
fn truncate_string(s: &str, max_chars: usize) -> String {
    let char_count = s.chars().count();
    if char_count <= max_chars {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_chars).collect();
        format!("{}...", truncated)
    }
}

/// Maximum number of chat items to load from history
const MAX_HISTORY_ITEMS: usize = 200;

/// Load chat items from a session file
/// Returns a vector of ChatItem (messages only, tool calls are skipped for now)
/// Limits to the most recent MAX_HISTORY_ITEMS messages for performance
pub fn load_session_chat_items(path: &PathBuf) -> Vec<ChatItem> {
    use std::io::{BufRead, BufReader};
    use std::fs::File;

    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            debug!("Failed to open session file {:?}: {}", path, e);
            return Vec::new();
        }
    };

    let reader = BufReader::new(file);
    let mut chat_items: Vec<ChatItem> = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // Skip entries without sessionId
        if entry.get("sessionId").and_then(|v| v.as_str()).is_none() {
            continue;
        }

        // Skip API error messages
        if entry.get("isApiErrorMessage").and_then(|v| v.as_bool()) == Some(true) {
            continue;
        }

        // Process message entries
        if let Some(msg) = entry.get("message") {
            let role_str = msg.get("role").and_then(|v| v.as_str());
            let content = extract_text_content(msg.get("content"));

            if let (Some(role_str), Some(text)) = (role_str, content) {
                // Skip system messages
                if is_system_message(&text) {
                    continue;
                }

                let role = match role_str {
                    "user" => MessageRole::User,
                    "assistant" => MessageRole::Assistant,
                    _ => continue,
                };

                // Get timestamp from entry
                let timestamp = entry
                    .get("timestamp")
                    .and_then(|v| v.as_str())
                    .and_then(|ts| DateTime::parse_from_rfc3339(ts).ok())
                    .map(|dt| dt.timestamp_millis())
                    .unwrap_or_else(|| Utc::now().timestamp_millis());

                // Get message ID or generate one
                let id = entry
                    .get("uuid")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| Uuid::new_v4().to_string());

                let message = Message {
                    id,
                    role,
                    content: text,
                    timestamp,
                };

                chat_items.push(ChatItem::Message { message });
            }
        }
    }

    // Keep only the most recent messages
    let total = chat_items.len();
    if total > MAX_HISTORY_ITEMS {
        chat_items = chat_items.split_off(total - MAX_HISTORY_ITEMS);
        info!("Loaded {} chat items (truncated from {}) from {:?}", chat_items.len(), total, path);
    } else {
        info!("Loaded {} chat items from {:?}", chat_items.len(), path);
    }

    chat_items
}

/// System message patterns to filter out from previews
const SYSTEM_MESSAGE_PATTERNS: &[&str] = &[
    "<command-name>",
    "<command-message>",
    "<command-args>",
    "<local-command-stdout>",
    "<system-reminder>",
    "Caveat:",
    "This session is being continued from a previous",
    "Invalid API key",
    "{\"subtasks\":",
    "CRITICAL: You MUST respond with ONLY a JSON",
    "Warmup",
];

fn is_system_message(content: &str) -> bool {
    if content.is_empty() {
        return false;
    }
    SYSTEM_MESSAGE_PATTERNS
        .iter()
        .any(|pattern| content.starts_with(pattern))
}

/// Parse a session JSONL file and extract metadata
fn parse_session_file(path: &PathBuf) -> Option<SessionInfo> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            debug!("Failed to read session file {:?}: {}", path, e);
            return None;
        }
    };

    let mut summary = "New Session".to_string();
    let mut message_count: u32 = 0;
    let mut last_activity = String::new();
    let mut cwd = String::new();
    let mut last_user_message: Option<String> = None;
    let mut last_assistant_message: Option<String> = None;
    let mut pending_summaries: HashMap<String, String> = HashMap::new();

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let entry: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // Handle summary entries without sessionId
        if entry.get("type").and_then(|v| v.as_str()) == Some("summary") {
            if let Some(s) = entry.get("summary").and_then(|v| v.as_str()) {
                if let Some(leaf_uuid) = entry.get("leafUuid").and_then(|v| v.as_str()) {
                    pending_summaries.insert(leaf_uuid.to_string(), s.to_string());
                }
            }
        }

        // Skip entries without sessionId for most processing
        let session_id = entry.get("sessionId").and_then(|v| v.as_str());
        if session_id.is_none() {
            continue;
        }

        // Update cwd from entry if available
        if cwd.is_empty() {
            if let Some(c) = entry.get("cwd").and_then(|v| v.as_str()) {
                cwd = c.to_string();
            }
        }

        // Apply pending summary if parentUuid matches
        if summary == "New Session" {
            if let Some(parent_uuid) = entry.get("parentUuid").and_then(|v| v.as_str()) {
                if let Some(s) = pending_summaries.get(parent_uuid) {
                    summary = s.clone();
                }
            }
        }

        // Update summary from summary entries with sessionId
        if entry.get("type").and_then(|v| v.as_str()) == Some("summary") {
            if let Some(s) = entry.get("summary").and_then(|v| v.as_str()) {
                summary = s.to_string();
            }
        }

        // Track messages
        if let Some(msg) = entry.get("message") {
            let role = msg.get("role").and_then(|v| v.as_str());
            let content = extract_text_content(msg.get("content"));

            if let Some(text) = content {
                if !is_system_message(&text) {
                    match role {
                        Some("user") => {
                            last_user_message = Some(text);
                        }
                        Some("assistant") => {
                            // Skip API error messages
                            if entry.get("isApiErrorMessage").and_then(|v| v.as_bool()) != Some(true)
                            {
                                last_assistant_message = Some(text);
                            }
                        }
                        _ => {}
                    }
                }
            }

            message_count += 1;
        }

        // Update timestamp
        if let Some(ts) = entry.get("timestamp").and_then(|v| v.as_str()) {
            last_activity = ts.to_string();
        }
    }

    // Skip sessions with no messages (empty or invalid session files)
    if message_count == 0 {
        debug!("Skipping empty session file: {:?}", path);
        return None;
    }

    // Set final summary based on messages if no summary exists
    if summary == "New Session" {
        if let Some(ref msg) = last_user_message {
            summary = truncate_string(msg, 50);
        } else if let Some(ref msg) = last_assistant_message {
            summary = truncate_string(msg, 50);
        }
    }

    // If no activity timestamp, use file modification time
    if last_activity.is_empty() {
        if let Ok(metadata) = std::fs::metadata(path) {
            if let Ok(modified) = metadata.modified() {
                let datetime: DateTime<Utc> = modified.into();
                last_activity = datetime.to_rfc3339();
            }
        }
    }

    Some(SessionInfo {
        id: String::new(), // Will be set by caller
        summary,
        message_count,
        last_activity,
        cwd,
        active: false,
        project: None,
        last_user_message,
        last_assistant_message,
    })
}

/// Extract text content from message content field
fn extract_text_content(content: Option<&serde_json::Value>) -> Option<String> {
    let content = content?;

    // String content
    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }

    // Array content (e.g., [{"type": "text", "text": "..."}])
    if let Some(arr) = content.as_array() {
        if let Some(first) = arr.first() {
            // Object with "text" field
            if let Some(text) = first.get("text").and_then(|v| v.as_str()) {
                return Some(text.to_string());
            }
            // String in array
            if let Some(s) = first.as_str() {
                return Some(s.to_string());
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cwd_to_path_key() {
        // Note: This test uses paths that don't exist, so canonicalize falls back to original
        assert_eq!(cwd_to_path_key("/Users/foo/project"), "-Users-foo-project");
        // Underscores are also replaced with dashes
        assert_eq!(
            cwd_to_path_key("/home/user/my_project"),
            "-home-user-my-project"
        );
    }

    #[test]
    fn test_path_key_to_cwd() {
        assert_eq!(path_key_to_cwd("-Users-foo-project"), "/Users/foo/project");
    }

    #[test]
    fn test_is_system_message() {
        assert!(is_system_message("<system-reminder>test"));
        assert!(is_system_message("<command-name>/commit"));
        assert!(!is_system_message("Hello, how can I help?"));
        assert!(!is_system_message(""));
    }
}
