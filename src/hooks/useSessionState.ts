/**
 * useSessionState Hook
 *
 * Subscribes to backend session state and provides real-time updates.
 * This is the recommended way to access session data in components.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionId, SessionState } from "@/types/acp";
import { useTransport } from "@/services/transport";

interface UseSessionStateResult {
  /** Current session state (null if not loaded or error) */
  state: SessionState | null;
  /** Whether the session is currently loading */
  isLoading: boolean;
  /** Error message if subscription failed */
  error: string | null;
  /** Manually refresh the session state */
  refresh: () => Promise<void>;
}

/**
 * Subscribe to backend session state for real-time updates
 *
 * @param sessionId - The session ID to subscribe to (null to unsubscribe)
 * @returns Session state, loading status, and error
 *
 * @example
 * ```tsx
 * const { state, isLoading, error } = useSessionState(activeSessionId);
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (!state) return <EmptyState />;
 *
 * return <ChatView chatItems={state.chatItems} />;
 * ```
 */
export function useSessionState(
  sessionId: SessionId | null
): UseSessionStateResult {
  const transport = useTransport();
  const [state, setState] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current subscription to avoid race conditions
  const currentSubscriptionRef = useRef<SessionId | null>(null);

  // Subscribe to session
  const subscribe = useCallback(
    async (sid: SessionId) => {
      if (!transport) {
        setError("Transport not available");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await transport.request<SessionState>(
          "subscribe_session",
          { sessionId: sid }
        );
        setState(response);
        currentSubscriptionRef.current = sid;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState(null);
      } finally {
        setIsLoading(false);
      }
    },
    [transport]
  );

  // Unsubscribe from session
  const unsubscribe = useCallback(
    async (sid: SessionId) => {
      if (!transport) return;

      try {
        await transport.request("unsubscribe_session", { sessionId: sid });
      } catch (err) {
        console.warn("Failed to unsubscribe from session:", err);
      }
    },
    [transport]
  );

  // Refresh session state
  const refresh = useCallback(async () => {
    if (!sessionId || !transport) return;

    setIsLoading(true);
    try {
      const response = await transport.request<SessionState>(
        "get_session_state",
        { sessionId }
      );
      setState(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, transport]);

  // Handle subscription changes
  useEffect(() => {
    const previousSubscription = currentSubscriptionRef.current;

    // Unsubscribe from previous session if different
    if (previousSubscription && previousSubscription !== sessionId) {
      unsubscribe(previousSubscription);
      currentSubscriptionRef.current = null;
    }

    // Subscribe to new session
    if (sessionId) {
      subscribe(sessionId);
    } else {
      setState(null);
      setError(null);
    }

    // Cleanup on unmount
    return () => {
      const sub = currentSubscriptionRef.current;
      if (sub) {
        unsubscribe(sub);
        currentSubscriptionRef.current = null;
      }
    };
  }, [sessionId, subscribe, unsubscribe]);

  // TODO: Listen for session/state_update notifications and apply updates
  // This will be implemented when we add the notification listener to transport

  return { state, isLoading, error, refresh };
}

/**
 * Get session state without subscribing (one-time fetch)
 */
export async function getSessionState(
  transport: ReturnType<typeof useTransport>,
  sessionId: SessionId
): Promise<SessionState | null> {
  if (!transport) return null;

  try {
    return await transport.request<SessionState>("get_session_state", {
      sessionId,
    });
  } catch (err) {
    console.error("Failed to get session state:", err);
    return null;
  }
}
