//! Session State Module
//!
//! Stores complete session state including messages, tool calls, and plan.
//! This is the single source of truth for session data.

use std::collections::HashMap;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::acp::{
    AvailableCommand, ContentBlock, PermissionRequest, Plan, SessionId, SessionModeId,
    SessionModeState, SessionModelState, SessionUpdate, ToolCall, ToolCallId, ToolCallUpdate,
};

/// Message role
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    User,
    Assistant,
}

/// A chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub timestamp: i64,
}

/// Unified chat item - either a message or a tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatItem {
    Message { message: Message },
    #[serde(rename_all = "camelCase")]
    ToolCall { tool_call: ToolCall },
}

/// Full session state stored in backend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub id: SessionId,
    pub cwd: String,
    pub chat_items: Vec<ChatItem>,
    #[serde(skip)]
    tool_calls_map: HashMap<ToolCallId, usize>, // Maps tool_call_id to index in chat_items
    pub plan: Option<Plan>,
    pub modes: Option<SessionModeState>,
    pub models: Option<SessionModelState>,
    pub available_commands: Option<Vec<AvailableCommand>>,
    /// Pending permission request waiting for user response
    pub pending_permission: Option<PermissionRequest>,
    /// Dangerous mode - auto-approve all tool calls for this session
    #[serde(default)]
    pub dangerous_mode: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl SessionState {
    pub fn new(id: SessionId, cwd: String) -> Self {
        let now = Utc::now().timestamp_millis();
        Self {
            id,
            cwd,
            chat_items: Vec::new(),
            tool_calls_map: HashMap::new(),
            plan: None,
            modes: None,
            models: None,
            available_commands: None,
            pending_permission: None,
            dangerous_mode: false,
            created_at: now,
            updated_at: now,
        }
    }

    /// Set dangerous mode for this session
    pub fn set_dangerous_mode(&mut self, enabled: bool) {
        self.dangerous_mode = enabled;
        self.updated_at = Utc::now().timestamp_millis();
    }

    /// Check if dangerous mode is enabled
    pub fn is_dangerous_mode(&self) -> bool {
        self.dangerous_mode
    }

    /// Set pending permission request for this session
    pub fn set_pending_permission(&mut self, request: Option<PermissionRequest>) {
        self.pending_permission = request;
        self.updated_at = Utc::now().timestamp_millis();
    }

    /// Get pending permission request
    pub fn get_pending_permission(&self) -> Option<&PermissionRequest> {
        self.pending_permission.as_ref()
    }

    /// Check if there's a pending permission request
    pub fn has_pending_permission(&self) -> bool {
        self.pending_permission.is_some()
    }

    /// Set modes
    pub fn set_modes(&mut self, modes: SessionModeState) {
        self.modes = Some(modes);
        self.updated_at = Utc::now().timestamp_millis();
    }

    /// Set models
    pub fn set_models(&mut self, models: SessionModelState) {
        self.models = Some(models);
        self.updated_at = Utc::now().timestamp_millis();
    }

    /// Load historical chat items (for resuming sessions)
    pub fn load_history(&mut self, chat_items: Vec<ChatItem>) {
        // Build tool_calls_map index for any tool calls in history
        for (idx, item) in chat_items.iter().enumerate() {
            if let ChatItem::ToolCall { tool_call } = item {
                self.tool_calls_map.insert(tool_call.tool_call_id.clone(), idx);
            }
        }
        self.chat_items = chat_items;
        self.updated_at = Utc::now().timestamp_millis();
    }

    /// Add a user message
    /// If message_id is provided, use it; otherwise generate a new UUID
    pub fn add_user_message(&mut self, content: String, message_id: Option<String>) -> SessionStateUpdate {
        let message = Message {
            id: message_id.unwrap_or_else(|| Uuid::new_v4().to_string()),
            role: MessageRole::User,
            content,
            timestamp: Utc::now().timestamp_millis(),
        };
        self.chat_items.push(ChatItem::Message {
            message: message.clone(),
        });
        self.updated_at = Utc::now().timestamp_millis();
        SessionStateUpdate::MessageAdded { message }
    }

    /// Apply a SessionUpdate from ACP agent and return the delta for broadcasting
    pub fn apply_update(&mut self, update: &SessionUpdate) -> SessionStateUpdate {
        self.updated_at = Utc::now().timestamp_millis();

        match update {
            SessionUpdate::AgentMessageChunk { content } => {
                self.handle_agent_message_chunk(content)
            }
            SessionUpdate::UserMessageChunk { content } => {
                // User message chunks - create or append to user message
                self.handle_user_message_chunk(content)
            }
            SessionUpdate::AgentThoughtChunk { content } => {
                // Treat thought chunks like message chunks for now
                self.handle_agent_message_chunk(content)
            }
            SessionUpdate::ToolCall(tool_call) => {
                // Check if tool call already exists (avoid duplicates)
                if let Some(&idx) = self.tool_calls_map.get(&tool_call.tool_call_id) {
                    // Update existing tool call instead of adding duplicate
                    if let ChatItem::ToolCall { tool_call: existing } = &mut self.chat_items[idx] {
                        // Merge: only update fields that have values in the new tool call
                        existing.title = tool_call.title.clone();
                        if tool_call.kind.is_some() {
                            existing.kind = tool_call.kind.clone();
                        }
                        if tool_call.status.is_some() {
                            existing.status = tool_call.status.clone();
                        }
                        if tool_call.raw_input.is_some() {
                            existing.raw_input = tool_call.raw_input.clone();
                        }
                        if tool_call.raw_output.is_some() {
                            existing.raw_output = tool_call.raw_output.clone();
                        }
                        if tool_call.content.is_some() {
                            existing.content = tool_call.content.clone();
                        }
                        if tool_call.locations.is_some() {
                            existing.locations = tool_call.locations.clone();
                        }
                        return SessionStateUpdate::ToolCallUpdated {
                            tool_call: existing.clone(),
                        };
                    }
                }

                // New tool call - add it
                let index = self.chat_items.len();
                self.chat_items.push(ChatItem::ToolCall {
                    tool_call: tool_call.clone(),
                });
                self.tool_calls_map
                    .insert(tool_call.tool_call_id.clone(), index);
                SessionStateUpdate::ToolCallAdded {
                    tool_call: tool_call.clone(),
                }
            }
            SessionUpdate::ToolCallUpdate(tool_call_update) => {
                self.handle_tool_call_update(tool_call_update)
            }
            SessionUpdate::Plan(plan) => {
                self.plan = Some(plan.clone());
                SessionStateUpdate::PlanUpdated { plan: plan.clone() }
            }
            SessionUpdate::AvailableCommandsUpdate { available_commands } => {
                self.available_commands = Some(available_commands.clone());
                SessionStateUpdate::AvailableCommandsUpdated {
                    commands: available_commands.clone(),
                }
            }
            SessionUpdate::CurrentModeUpdate { current_mode_id } => {
                if let Some(ref mut modes) = self.modes {
                    modes.current_mode_id = current_mode_id.clone();
                }
                SessionStateUpdate::CurrentModeUpdated {
                    mode_id: current_mode_id.clone(),
                }
            }
        }
    }

    /// Handle agent message chunk - append to last assistant message or create new one
    /// Only appends if the LAST item in chat_items is an assistant message
    /// This preserves ordering: text A -> tool A -> tool B -> text B (not merged)
    fn handle_agent_message_chunk(&mut self, content: &ContentBlock) -> SessionStateUpdate {
        let text = match content {
            ContentBlock::Text { text } => text.clone(),
            _ => return SessionStateUpdate::Noop,
        };

        // Check if the LAST item is an assistant message - only then append
        if let Some(ChatItem::Message { message }) = self.chat_items.last_mut() {
            if message.role == MessageRole::Assistant {
                // Append to existing assistant message
                message.content.push_str(&text);
                message.timestamp = Utc::now().timestamp_millis();
                return SessionStateUpdate::MessageChunk { content: text };
            }
        }

        // Create new assistant message (last item is not an assistant message)
        let message = Message {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::Assistant,
            content: text,
            timestamp: Utc::now().timestamp_millis(),
        };
        self.chat_items.push(ChatItem::Message {
            message: message.clone(),
        });
        SessionStateUpdate::MessageAdded { message }
    }

    /// Handle user message chunk
    /// Only appends if the LAST item is a user message
    fn handle_user_message_chunk(&mut self, content: &ContentBlock) -> SessionStateUpdate {
        let text = match content {
            ContentBlock::Text { text } => text.clone(),
            _ => return SessionStateUpdate::Noop,
        };

        // Check if the LAST item is a user message - only then append
        if let Some(ChatItem::Message { message }) = self.chat_items.last_mut() {
            if message.role == MessageRole::User {
                // Append to existing user message
                message.content.push_str(&text);
                message.timestamp = Utc::now().timestamp_millis();
                return SessionStateUpdate::MessageChunk { content: text };
            }
        }

        // Create new user message (last item is not a user message)
        let message = Message {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::User,
            content: text,
            timestamp: Utc::now().timestamp_millis(),
        };
        self.chat_items.push(ChatItem::Message {
            message: message.clone(),
        });
        SessionStateUpdate::MessageAdded { message }
    }

    /// Handle tool call update
    fn handle_tool_call_update(&mut self, update: &ToolCallUpdate) -> SessionStateUpdate {
        if let Some(&idx) = self.tool_calls_map.get(&update.tool_call_id) {
            if let ChatItem::ToolCall { tool_call } = &mut self.chat_items[idx] {
                // Apply updates
                if let Some(ref title) = update.title {
                    tool_call.title = title.clone();
                }
                if let Some(ref kind) = update.kind {
                    tool_call.kind = Some(kind.clone());
                }
                if let Some(ref status) = update.status {
                    tool_call.status = Some(status.clone());
                }
                if let Some(ref raw_input) = update.raw_input {
                    tool_call.raw_input = Some(raw_input.clone());
                }
                if let Some(ref raw_output) = update.raw_output {
                    tool_call.raw_output = Some(raw_output.clone());
                }
                if let Some(ref content) = update.content {
                    tool_call.content = Some(content.clone());
                }
                if let Some(ref locations) = update.locations {
                    tool_call.locations = Some(locations.clone());
                }

                return SessionStateUpdate::ToolCallUpdated {
                    tool_call: tool_call.clone(),
                };
            }
        }
        SessionStateUpdate::Noop
    }

    /// Get a tool call by ID
    pub fn get_tool_call(&self, tool_call_id: &ToolCallId) -> Option<&ToolCall> {
        if let Some(&idx) = self.tool_calls_map.get(tool_call_id) {
            if let ChatItem::ToolCall { tool_call } = &self.chat_items[idx] {
                return Some(tool_call);
            }
        }
        None
    }
}

/// Delta update for broadcasting to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "updateType", rename_all = "snake_case")]
pub enum SessionStateUpdate {
    /// Append text to the last message
    MessageChunk { content: String },
    /// A new message was added
    MessageAdded { message: Message },
    /// A new tool call was added
    ToolCallAdded { tool_call: ToolCall },
    /// An existing tool call was updated
    ToolCallUpdated { tool_call: ToolCall },
    /// Plan was updated
    PlanUpdated { plan: Plan },
    /// Available commands were updated
    AvailableCommandsUpdated { commands: Vec<AvailableCommand> },
    /// Current mode was updated
    CurrentModeUpdated { mode_id: SessionModeId },
    /// Full state sync (for new subscribers)
    FullState { state: Box<SessionState> },
    /// Dangerous mode was updated
    #[serde(rename_all = "camelCase")]
    DangerousModeUpdated { dangerous_mode: bool },
    /// No operation (used for unhandled updates)
    Noop,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session_state() {
        let state = SessionState::new("test-session".to_string(), "/test/path".to_string());
        assert_eq!(state.id, "test-session");
        assert_eq!(state.cwd, "/test/path");
        assert!(state.chat_items.is_empty());
    }

    #[test]
    fn test_add_user_message() {
        let mut state = SessionState::new("test".to_string(), "/".to_string());
        let update = state.add_user_message("Hello".to_string(), None);

        assert_eq!(state.chat_items.len(), 1);
        if let SessionStateUpdate::MessageAdded { message } = update {
            assert_eq!(message.role, MessageRole::User);
            assert_eq!(message.content, "Hello");
        } else {
            panic!("Expected MessageAdded update");
        }
    }

    #[test]
    fn test_add_user_message_with_id() {
        let mut state = SessionState::new("test".to_string(), "/".to_string());
        let custom_id = "custom-message-id".to_string();
        let update = state.add_user_message("Hello".to_string(), Some(custom_id.clone()));

        assert_eq!(state.chat_items.len(), 1);
        if let SessionStateUpdate::MessageAdded { message } = update {
            assert_eq!(message.id, custom_id);
            assert_eq!(message.role, MessageRole::User);
            assert_eq!(message.content, "Hello");
        } else {
            panic!("Expected MessageAdded update");
        }
    }

    #[test]
    fn test_apply_agent_message_chunk() {
        let mut state = SessionState::new("test".to_string(), "/".to_string());

        // First chunk creates new message
        let update1 = state.apply_update(&SessionUpdate::AgentMessageChunk {
            content: ContentBlock::Text {
                text: "Hello".to_string(),
            },
        });
        assert!(matches!(update1, SessionStateUpdate::MessageAdded { .. }));

        // Second chunk appends
        let update2 = state.apply_update(&SessionUpdate::AgentMessageChunk {
            content: ContentBlock::Text {
                text: " World".to_string(),
            },
        });
        assert!(matches!(update2, SessionStateUpdate::MessageChunk { .. }));

        // Check final content
        if let ChatItem::Message { message } = &state.chat_items[0] {
            assert_eq!(message.content, "Hello World");
        }
    }
}
