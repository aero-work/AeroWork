/**
 * Session Store
 *
 * UI-only state store for session management.
 * Session data (chatItems, toolCalls, etc.) is now managed by the backend.
 * Use `useSessionData(sessionId)` hook from `@/hooks/useSessionData` for session data.
 *
 * This store manages:
 * - activeSessionId: Currently selected session
 * - isLoading: Loading indicator for prompts
 * - error: Error messages
 * - availableSessions: List of available sessions from backend
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { SessionId, SessionInfo } from "@/types/acp";

interface SessionState {
  activeSessionId: SessionId | null;
  isLoading: boolean;
  error: string | null;
  // Available sessions from backend (historical + active)
  availableSessions: SessionInfo[];
  availableSessionsLoading: boolean;
}

interface SessionActions {
  setActiveSession: (sessionId: SessionId | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAvailableSessions: (sessions: SessionInfo[]) => void;
  setAvailableSessionsLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState: SessionState = {
  activeSessionId: null,
  isLoading: false,
  error: null,
  availableSessions: [],
  availableSessionsLoading: false,
};

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    immer((set) => ({
      ...initialState,

      setActiveSession: (sessionId) => {
        set((state) => {
          state.activeSessionId = sessionId;
        });
      },

      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },

      setAvailableSessions: (sessions) => {
        set((state) => {
          state.availableSessions = sessions;
        });
      },

      setAvailableSessionsLoading: (loading) => {
        set((state) => {
          state.availableSessionsLoading = loading;
        });
      },

      reset: () => {
        set(() => initialState);
      },
    })),
    {
      name: "aero-work-session",
      // Only persist activeSessionId, not transient state
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);

/**
 * @deprecated Use `useSessionData(sessionId)` hook instead for session data.
 * This selector only returns the active session ID.
 */
export const useActiveSession = () => {
  return useSessionStore((state) => state.activeSessionId);
};
