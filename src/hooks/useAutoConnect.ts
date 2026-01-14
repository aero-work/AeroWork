/**
 * useAutoConnect Hook
 *
 * Automatically connects to the backend when the app loads.
 * Also handles reconnection on page visibility change and window focus.
 */

import { useEffect, useRef, useCallback } from "react";
import { useAgentStore } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { agentAPI } from "@/services/api";

export function useAutoConnect() {
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const hasAttemptedConnect = useRef(false);
  const lastRefreshRef = useRef<number>(0);
  const isConnected = connectionStatus === "connected";

  // Initial auto-connect
  useEffect(() => {
    // Only attempt auto-connect once when app loads
    if (hasAttemptedConnect.current) return;
    if (connectionStatus !== "disconnected") return;

    hasAttemptedConnect.current = true;

    console.log("Auto-connecting to backend...");
    agentAPI.connect().catch((error) => {
      console.error("Auto-connect failed:", error);
      // Reset flag to allow manual retry
      hasAttemptedConnect.current = false;
    });
  }, [connectionStatus]);

  // Refresh function for when page becomes visible
  const refreshState = useCallback(async () => {
    const now = Date.now();
    // Minimum 3 seconds between refreshes
    if (now - lastRefreshRef.current < 3000) {
      return;
    }
    lastRefreshRef.current = now;

    // If not connected, try to reconnect
    if (!isConnected) {
      console.log("Page visible but not connected, attempting reconnect...");
      try {
        await agentAPI.connect();
      } catch (error) {
        console.error("Reconnect failed:", error);
        return;
      }
    }

    console.log("Page visible, refreshing sessions list...");

    // Refresh sessions list
    try {
      await agentAPI.listSessions(currentWorkingDir || undefined, 20, 0);
    } catch (error) {
      console.error("Failed to refresh sessions:", error);
    }
  }, [isConnected, currentWorkingDir]);

  // Handle visibility change and window focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshState();
      }
    };

    const handleFocus = () => {
      refreshState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshState]);

  return connectionStatus;
}
