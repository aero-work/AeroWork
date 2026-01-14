//! Session State Manager Module
//!
//! Manages all session states and handles subscriptions for real-time updates.
//! This is the central point for session data management.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use parking_lot::RwLock;
use tokio::sync::broadcast;
use tracing::{debug, info};

use crate::acp::{SessionId, SessionModeState, SessionModelState, SessionUpdate};

use super::session_state::{SessionState, SessionStateUpdate};

/// Client identifier for subscription management
pub type ClientId = String;

/// Subscription info for a session
struct SessionSubscription {
    /// Broadcast sender for this session's updates
    tx: broadcast::Sender<SessionStateUpdate>,
    /// Set of subscribed client IDs
    subscribers: HashSet<ClientId>,
}

/// Session State Manager - single source of truth for all session data
pub struct SessionStateManager {
    /// Session states by session ID
    states: RwLock<HashMap<SessionId, SessionState>>,
    /// Subscriptions by session ID
    subscriptions: RwLock<HashMap<SessionId, SessionSubscription>>,
}

impl SessionStateManager {
    pub fn new() -> Self {
        Self {
            states: RwLock::new(HashMap::new()),
            subscriptions: RwLock::new(HashMap::new()),
        }
    }

    /// Create a new session state
    pub fn create_session(
        &self,
        id: SessionId,
        cwd: String,
        modes: Option<SessionModeState>,
        models: Option<SessionModelState>,
    ) -> SessionState {
        let mut state = SessionState::new(id.clone(), cwd);
        if let Some(m) = modes {
            state.set_modes(m);
        }
        if let Some(m) = models {
            state.set_models(m);
        }

        let mut states = self.states.write();
        states.insert(id.clone(), state.clone());

        // Create subscription channel for this session
        let (tx, _) = broadcast::channel(1000);
        let mut subs = self.subscriptions.write();
        subs.insert(
            id.clone(),
            SessionSubscription {
                tx,
                subscribers: HashSet::new(),
            },
        );

        info!("Created session state: {}", id);
        state
    }

    /// Create a session with pre-loaded chat items (for resuming historical sessions)
    pub fn create_session_with_history(
        &self,
        id: SessionId,
        cwd: String,
        modes: Option<SessionModeState>,
        models: Option<SessionModelState>,
        chat_items: Vec<super::session_state::ChatItem>,
    ) -> SessionState {
        let mut state = SessionState::new(id.clone(), cwd);
        if let Some(m) = modes {
            state.set_modes(m);
        }
        if let Some(m) = models {
            state.set_models(m);
        }

        // Load historical chat items
        state.load_history(chat_items);

        let mut states = self.states.write();
        states.insert(id.clone(), state.clone());

        // Create subscription channel for this session
        let (tx, _) = broadcast::channel(1000);
        let mut subs = self.subscriptions.write();
        subs.insert(
            id.clone(),
            SessionSubscription {
                tx,
                subscribers: HashSet::new(),
            },
        );

        info!("Created session state with history: {} ({} items)", id, state.chat_items.len());
        state
    }

    /// Remove a session state
    pub fn remove_session(&self, id: &SessionId) {
        let mut states = self.states.write();
        states.remove(id);

        let mut subs = self.subscriptions.write();
        subs.remove(id);

        info!("Removed session state: {}", id);
    }

    /// Check if a session exists
    pub fn has_session(&self, id: &SessionId) -> bool {
        let states = self.states.read();
        states.contains_key(id)
    }

    /// Apply an update from ACP agent
    pub fn apply_update(&self, session_id: &SessionId, update: SessionUpdate) {
        let delta = {
            let mut states = self.states.write();
            if let Some(state) = states.get_mut(session_id) {
                state.apply_update(&update)
            } else {
                debug!("Session not found for update: {}", session_id);
                return;
            }
        };

        // Broadcast delta to subscribers (skip Noop)
        if !matches!(delta, SessionStateUpdate::Noop) {
            self.broadcast_update(session_id, delta);
        }
    }

    /// Load historical chat items into an existing session
    pub fn load_history(&self, session_id: &SessionId, chat_items: Vec<super::session_state::ChatItem>) {
        let mut states = self.states.write();
        if let Some(state) = states.get_mut(session_id) {
            state.load_history(chat_items);
            info!("Loaded history into session {}", session_id);
        } else {
            debug!("Session not found for history load: {}", session_id);
        }
    }

    /// Add a user message to session
    /// If message_id is provided, use it; otherwise generate a new UUID
    pub fn add_user_message(&self, session_id: &SessionId, content: String, message_id: Option<String>) {
        let delta = {
            let mut states = self.states.write();
            if let Some(state) = states.get_mut(session_id) {
                state.add_user_message(content, message_id)
            } else {
                return;
            }
        };

        self.broadcast_update(session_id, delta);
    }

    /// Subscribe a client to session updates
    /// Returns the current state and a receiver for future updates
    pub fn subscribe(
        &self,
        client_id: ClientId,
        session_id: &SessionId,
    ) -> Option<(SessionState, broadcast::Receiver<SessionStateUpdate>)> {
        // Get current state
        let state = {
            let states = self.states.read();
            states.get(session_id).cloned()?
        };

        // Add to subscribers and get receiver
        let mut subs = self.subscriptions.write();
        let sub = subs.get_mut(session_id)?;
        sub.subscribers.insert(client_id.clone());
        let rx = sub.tx.subscribe();

        info!(
            "Client {} subscribed to session {} ({} subscribers)",
            client_id,
            session_id,
            sub.subscribers.len()
        );

        Some((state, rx))
    }

    /// Unsubscribe a client from session updates
    pub fn unsubscribe(&self, client_id: &ClientId, session_id: &SessionId) {
        let mut subs = self.subscriptions.write();
        if let Some(sub) = subs.get_mut(session_id) {
            sub.subscribers.remove(client_id);
            info!(
                "Client {} unsubscribed from session {} ({} subscribers)",
                client_id,
                session_id,
                sub.subscribers.len()
            );
        }
    }

    /// Unsubscribe a client from all sessions
    pub fn unsubscribe_all(&self, client_id: &ClientId) {
        let mut subs = self.subscriptions.write();
        for (session_id, sub) in subs.iter_mut() {
            if sub.subscribers.remove(client_id) {
                debug!("Client {} unsubscribed from session {}", client_id, session_id);
            }
        }
    }

    /// Get full session state
    pub fn get_state(&self, session_id: &SessionId) -> Option<SessionState> {
        let states = self.states.read();
        states.get(session_id).cloned()
    }

    /// Get all session IDs
    pub fn get_session_ids(&self) -> Vec<SessionId> {
        let states = self.states.read();
        states.keys().cloned().collect()
    }

    /// Get subscriber count for a session
    pub fn subscriber_count(&self, session_id: &SessionId) -> usize {
        let subs = self.subscriptions.read();
        subs.get(session_id)
            .map(|s| s.subscribers.len())
            .unwrap_or(0)
    }

    /// Broadcast an update to all subscribers of a session
    fn broadcast_update(&self, session_id: &SessionId, update: SessionStateUpdate) {
        let subs = self.subscriptions.read();
        if let Some(sub) = subs.get(session_id) {
            if !sub.subscribers.is_empty() {
                // Ignore send errors (no subscribers is fine)
                let _ = sub.tx.send(update);
            }
        }
    }
}

impl Default for SessionStateManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe wrapper for SessionStateManager
pub type SharedSessionStateManager = Arc<SessionStateManager>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_get_session() {
        let manager = SessionStateManager::new();
        let state = manager.create_session("test".to_string(), "/path".to_string(), None, None);

        assert_eq!(state.id, "test");
        assert!(manager.has_session(&"test".to_string()));

        let retrieved = manager.get_state(&"test".to_string());
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "test");
    }

    #[test]
    fn test_subscribe_unsubscribe() {
        let manager = SessionStateManager::new();
        manager.create_session("test".to_string(), "/".to_string(), None, None);

        // Subscribe
        let result = manager.subscribe("client1".to_string(), &"test".to_string());
        assert!(result.is_some());
        assert_eq!(manager.subscriber_count(&"test".to_string()), 1);

        // Subscribe another client
        let _ = manager.subscribe("client2".to_string(), &"test".to_string());
        assert_eq!(manager.subscriber_count(&"test".to_string()), 2);

        // Unsubscribe
        manager.unsubscribe(&"client1".to_string(), &"test".to_string());
        assert_eq!(manager.subscriber_count(&"test".to_string()), 1);
    }

    #[test]
    fn test_remove_session() {
        let manager = SessionStateManager::new();
        manager.create_session("test".to_string(), "/".to_string(), None, None);
        assert!(manager.has_session(&"test".to_string()));

        manager.remove_session(&"test".to_string());
        assert!(!manager.has_session(&"test".to_string()));
    }
}
