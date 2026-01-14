/**
 * useVisibilityRefresh Hook
 *
 * Automatically refreshes data when the page becomes visible.
 * This ensures that when users switch back to the tab/window,
 * they see the latest state from the backend.
 */

import { useEffect, useRef, useCallback } from "react";
import { useAgentStore } from "@/stores/agentStore";
import { useSessionStore } from "@/stores/sessionStore";
import { agentAPI } from "@/services/api";
import { getTransport } from "@/services/transport";
import type { WebSocketTransport } from "@/services/transport/websocket";

interface UseVisibilityRefreshOptions {
  /** Minimum time between refreshes in ms (default: 5000) */
  minInterval?: number;
  /** Whether to refresh sessions list (default: true) */
  refreshSessions?: boolean;
  /** Callback when visibility changes to visible */
  onVisible?: () => void;
}

export function useVisibilityRefresh(options: UseVisibilityRefreshOptions = {}) {
  const {
    minInterval = 5000,
    refreshSessions = true,
    onVisible,
  } = options;

  const lastRefreshRef = useRef<number>(0);
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const isConnected = connectionStatus === "connected";

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < minInterval) {
      return; // Too soon since last refresh
    }

    if (!isConnected) {
      // Try to reconnect if disconnected
      console.log("Page visible but not connected, attempting reconnect...");
      try {
        await agentAPI.connect();
      } catch (error) {
        console.error("Failed to reconnect:", error);
        return;
      }
    }

    lastRefreshRef.current = now;
    console.log("Page visible, refreshing state...");

    // Refresh sessions list
    if (refreshSessions) {
      try {
        await agentAPI.listSessions(undefined, 20, 0);
      } catch (error) {
        console.error("Failed to refresh sessions:", error);
      }
    }

    // Refresh current session state if subscribed
    if (activeSessionId) {
      try {
        const transport = getTransport() as WebSocketTransport;
        if (transport.isConnected()) {
          // Re-fetch session state to ensure it's current
          await transport.getSessionState(activeSessionId);
        }
      } catch (error) {
        console.error("Failed to refresh session state:", error);
      }
    }

    onVisible?.();
  }, [isConnected, activeSessionId, minInterval, refreshSessions, onVisible]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    // Also refresh on window focus (for multi-window scenarios)
    const handleFocus = () => {
      refresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  return { refresh };
}
