/**
 * useSessionData Hook
 *
 * Provides session data with robust client-server synchronization:
 * 1. Fetches full state from server on mount/session change
 * 2. Listens for incremental updates via notifications
 * 3. Re-fetches on reconnection for recovery
 *
 * The server is the single source of truth. This hook manages
 * local cache and keeps it in sync with server state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  SessionId,
  SessionState,
  SessionUpdate,
  SessionStateUpdate,
  Message,
  ToolCall,
} from "@/types/acp";
import { getTransport } from "@/services/transport";
import type { WebSocketTransport } from "@/services/transport/websocket";

interface UseSessionDataResult {
  /** Current session state */
  state: SessionState | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Manually refresh from server */
  refresh: () => Promise<void>;
  /** Add optimistic user message (will be confirmed by server) */
  addOptimisticMessage: (content: string) => string;
}

/**
 * Hook for accessing session data with server synchronization
 */
export function useSessionData(sessionId: SessionId | null): UseSessionDataResult {
  const [state, setState] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current session to avoid race conditions
  const currentSessionRef = useRef<SessionId | null>(null);

  /**
   * Fetch full session state from server
   */
  const fetchSessionState = useCallback(async (sid: SessionId) => {
    const transport = getTransport() as WebSocketTransport;
    if (!transport.isConnected()) {
      throw new Error("Not connected to server");
    }

    const response = await transport.getSessionState(sid);
    return response;
  }, []);

  /**
   * Apply backend state update (from session/state_update notification)
   * These are updates pushed by the server, including messages from other clients
   */
  const applyStateUpdate = useCallback((update: SessionStateUpdate) => {
    setState((prev) => {
      if (!prev) return prev;

      switch (update.updateType) {
        case "message_chunk": {
          // Only append if the LAST item is a message (preserve ordering)
          const newChatItems = [...prev.chatItems];
          const lastItem = newChatItems[newChatItems.length - 1];

          if (lastItem && lastItem.type === "message") {
            newChatItems[newChatItems.length - 1] = {
              type: "message",
              message: {
                ...lastItem.message,
                content: lastItem.message.content + update.content,
              },
            };
            return { ...prev, chatItems: newChatItems, updatedAt: Date.now() };
          }
          return prev;
        }

        case "message_added": {
          // Check if message already exists (avoid duplicates from optimistic updates)
          const exists = prev.chatItems.some(
            (item) => item.type === "message" && item.message.id === update.message.id
          );
          if (exists) return prev;

          return {
            ...prev,
            chatItems: [...prev.chatItems, { type: "message", message: update.message }],
            updatedAt: Date.now(),
          };
        }

        case "tool_call_added": {
          const exists = prev.chatItems.some(
            (item) => item.type === "tool_call" && item.toolCall.toolCallId === update.toolCall.toolCallId
          );
          if (exists) return prev;

          return {
            ...prev,
            chatItems: [...prev.chatItems, { type: "tool_call", toolCall: update.toolCall }],
            updatedAt: Date.now(),
          };
        }

        case "tool_call_updated": {
          const newChatItems = prev.chatItems.map((item) => {
            if (item.type === "tool_call" && item.toolCall.toolCallId === update.toolCall.toolCallId) {
              return { type: "tool_call" as const, toolCall: update.toolCall };
            }
            return item;
          });
          return { ...prev, chatItems: newChatItems, updatedAt: Date.now() };
        }

        case "plan_updated": {
          return { ...prev, plan: update.plan, updatedAt: Date.now() };
        }

        case "available_commands_updated": {
          return { ...prev, availableCommands: update.commands, updatedAt: Date.now() };
        }

        case "current_mode_updated": {
          if (!prev.modes) return prev;
          return {
            ...prev,
            modes: { ...prev.modes, currentModeId: update.modeId },
            updatedAt: Date.now(),
          };
        }

        case "full_state": {
          return update.state;
        }

        case "noop":
        default:
          return prev;
      }
    });
  }, []);

  /**
   * Apply incremental update to local state
   */
  const applyUpdate = useCallback((update: SessionUpdate) => {
    setState((prev) => {
      if (!prev) return prev;

      switch (update.sessionUpdate) {
        case "user_message_chunk":
        case "agent_message_chunk": {
          if (update.content.type !== "text") return prev;

          const role = update.sessionUpdate === "user_message_chunk" ? "user" : "assistant";
          const text = update.content.text;

          // Only append if the LAST item is a message with same role (preserve ordering)
          const newChatItems = [...prev.chatItems];
          const lastItem = newChatItems[newChatItems.length - 1];

          if (lastItem && lastItem.type === "message" && lastItem.message.role === role) {
            // Append to existing message
            newChatItems[newChatItems.length - 1] = {
              type: "message",
              message: {
                ...lastItem.message,
                content: lastItem.message.content + text,
              },
            };
            return { ...prev, chatItems: newChatItems, updatedAt: Date.now() };
          }

          // Create new message (last item is not a message with same role)
          const newMessage: Message = {
            id: crypto.randomUUID(),
            role,
            content: text,
            timestamp: Date.now(),
          };
          return {
            ...prev,
            chatItems: [...prev.chatItems, { type: "message", message: newMessage }],
            updatedAt: Date.now(),
          };
        }

        case "tool_call": {
          const toolCall: ToolCall = {
            toolCallId: update.toolCallId,
            title: update.title,
            kind: update.kind,
            status: update.status,
            rawInput: update.rawInput,
            content: update.content,
            locations: update.locations,
          };
          return {
            ...prev,
            chatItems: [...prev.chatItems, { type: "tool_call", toolCall }],
            updatedAt: Date.now(),
          };
        }

        case "tool_call_update": {
          const newChatItems = prev.chatItems.map((item) => {
            if (item.type === "tool_call" && item.toolCall.toolCallId === update.toolCallId) {
              return {
                type: "tool_call" as const,
                toolCall: {
                  ...item.toolCall,
                  title: update.title ?? item.toolCall.title,
                  kind: update.kind ?? item.toolCall.kind,
                  status: update.status ?? item.toolCall.status,
                  rawInput: update.rawInput ?? item.toolCall.rawInput,
                  rawOutput: update.rawOutput ?? item.toolCall.rawOutput,
                  content: update.content ?? item.toolCall.content,
                  locations: update.locations ?? item.toolCall.locations,
                },
              };
            }
            return item;
          });
          return { ...prev, chatItems: newChatItems, updatedAt: Date.now() };
        }

        case "plan": {
          return { ...prev, plan: { entries: update.entries }, updatedAt: Date.now() };
        }

        case "available_commands_update": {
          return { ...prev, availableCommands: update.availableCommands, updatedAt: Date.now() };
        }

        case "current_mode_update": {
          if (!prev.modes) return prev;
          return {
            ...prev,
            modes: { ...prev.modes, currentModeId: update.currentModeId },
            updatedAt: Date.now(),
          };
        }

        default:
          return prev;
      }
    });
  }, []);

  /**
   * Refresh session state from server
   */
  const refresh = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const newState = await fetchSessionState(sessionId);
      // Only update if this is still the current session
      if (currentSessionRef.current === sessionId) {
        setState(newState);
      }
    } catch (err) {
      if (currentSessionRef.current === sessionId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (currentSessionRef.current === sessionId) {
        setIsLoading(false);
      }
    }
  }, [sessionId, fetchSessionState]);

  /**
   * Add optimistic user message (for immediate UI feedback)
   * Returns the message ID for potential rollback
   */
  const addOptimisticMessage = useCallback((content: string): string => {
    const messageId = crypto.randomUUID();
    setState((prev) => {
      if (!prev) return prev;
      const newMessage: Message = {
        id: messageId,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      return {
        ...prev,
        chatItems: [...prev.chatItems, { type: "message", message: newMessage }],
        updatedAt: Date.now(),
      };
    });
    return messageId;
  }, []);

  // Setup effect: fetch state and listen for updates
  useEffect(() => {
    currentSessionRef.current = sessionId;

    if (!sessionId) {
      setState(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Fetch initial state
    const loadState = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const newState = await fetchSessionState(sessionId);
        if (currentSessionRef.current === sessionId) {
          setState(newState);
        }
      } catch (err) {
        if (currentSessionRef.current === sessionId) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (currentSessionRef.current === sessionId) {
          setIsLoading(false);
        }
      }
    };

    loadState();

    // Setup update listener
    const transport = getTransport() as WebSocketTransport;

    // Listen for session updates (from ACP agent)
    const handleUpdate = (update: SessionUpdate) => {
      if (currentSessionRef.current === sessionId) {
        applyUpdate(update);
      }
    };

    // Listen for state updates (from backend - includes cross-client syncing)
    const handleStateUpdate = (update: SessionStateUpdate) => {
      if (currentSessionRef.current === sessionId) {
        applyStateUpdate(update);
      }
    };

    // Register handler for this session's updates
    const eventHandlers = (transport as any).eventHandlers as Map<string, Set<(data: unknown) => void>>;

    // Register for ACP session updates
    const eventKey = `session-update-${sessionId}`;
    if (!eventHandlers.has(eventKey)) {
      eventHandlers.set(eventKey, new Set());
    }
    eventHandlers.get(eventKey)!.add(handleUpdate as (data: unknown) => void);

    // Register for backend state updates (cross-client sync)
    const stateUpdateKey = `session-state-update-${sessionId}`;
    if (!eventHandlers.has(stateUpdateKey)) {
      eventHandlers.set(stateUpdateKey, new Set());
    }
    eventHandlers.get(stateUpdateKey)!.add(handleStateUpdate as (data: unknown) => void);

    // Cleanup
    return () => {
      eventHandlers.get(eventKey)?.delete(handleUpdate as (data: unknown) => void);
      if (eventHandlers.get(eventKey)?.size === 0) {
        eventHandlers.delete(eventKey);
      }

      eventHandlers.get(stateUpdateKey)?.delete(handleStateUpdate as (data: unknown) => void);
      if (eventHandlers.get(stateUpdateKey)?.size === 0) {
        eventHandlers.delete(stateUpdateKey);
      }
    };
  }, [sessionId, fetchSessionState, applyUpdate, applyStateUpdate]);

  // Listen for reconnection events
  useEffect(() => {
    if (!sessionId) return;

    const transport = getTransport() as WebSocketTransport;

    // Re-fetch state when connection is restored
    const handleReconnect = () => {
      console.log("Connection restored, re-fetching session state...");
      refresh();
    };

    // Listen for reconnection (we'll add this event to transport)
    const reconnectHandler = () => handleReconnect();
    (transport as any).onReconnect?.(reconnectHandler);

    return () => {
      (transport as any).offReconnect?.(reconnectHandler);
    };
  }, [sessionId, refresh]);

  return {
    state,
    isLoading,
    error,
    refresh,
    addOptimisticMessage,
  };
}

/**
 * Hook for current active session ID with server sync
 */
export function useCurrentSessionId(): {
  sessionId: SessionId | null;
  setSessionId: (id: SessionId | null) => Promise<void>;
  isLoading: boolean;
} {
  const [sessionId, setLocalSessionId] = useState<SessionId | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current session on mount
  useEffect(() => {
    const fetchCurrentSession = async () => {
      try {
        const transport = getTransport() as WebSocketTransport;
        if (transport.isConnected()) {
          const currentId = await transport.getCurrentSession();
          setLocalSessionId(currentId);
        }
      } catch (err) {
        console.error("Failed to fetch current session:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentSession();

    // Listen for session activation from server
    const transport = getTransport() as WebSocketTransport;
    const unsubscribe = transport.onSessionActivated((id) => {
      setLocalSessionId(id);
    });

    return unsubscribe;
  }, []);

  // Set session on server
  const setSessionId = useCallback(async (id: SessionId | null) => {
    const transport = getTransport() as WebSocketTransport;
    await transport.setCurrentSession(id);
    // Local state will be updated via onSessionActivated callback
  }, []);

  return { sessionId, setSessionId, isLoading };
}
