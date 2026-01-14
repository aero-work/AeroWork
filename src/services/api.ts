/**
 * Agent API
 *
 * Simplified API layer that only handles:
 * 1. Sending requests to backend
 * 2. Managing connection lifecycle
 * 3. Permission dialog coordination
 *
 * State management is handled by:
 * - Server: Single source of truth for all session data
 * - Hooks: useSessionData for session state
 * - sessionStore: UI-only state (isLoading, error)
 */

import { getTransport } from "./transport";
import { WebSocketTransport } from "./transport/websocket";
import { useSessionStore } from "@/stores/sessionStore";
import { useAgentStore } from "@/stores/agentStore";
import type {
  SessionId,
  SessionInfo,
  ListSessionsResponse,
  PermissionRequest,
  PermissionOutcome,
  SessionUpdate,
} from "@/types/acp";

class AgentAPI {
  private permissionResolver: ((outcome: PermissionOutcome) => void) | null = null;
  private sessionActivatedUnsubscribe: (() => void) | null = null;

  /**
   * Connect to agent and initialize
   */
  async connect(): Promise<void> {
    const transport = getTransport() as WebSocketTransport;
    const agentStore = useAgentStore.getState();
    const sessionStore = useSessionStore.getState();

    agentStore.setConnectionStatus("connecting");

    try {
      await transport.connect();

      // Subscribe to session activation events from backend
      this.sessionActivatedUnsubscribe = transport.onSessionActivated((sessionId) => {
        console.log("Session activated from backend:", sessionId);
        sessionStore.setActiveSession(sessionId);
      });

      const initResponse = await transport.initialize();

      if (initResponse.agentInfo) {
        agentStore.setAgentInfo(initResponse.agentInfo);
      }
      if (initResponse.agentCapabilities) {
        agentStore.setAgentCapabilities(initResponse.agentCapabilities);
      }
      if (initResponse.authMethods) {
        agentStore.setAuthMethods(initResponse.authMethods);
      }

      // Sync current session from backend
      const currentSessionId = await transport.getCurrentSession();
      if (currentSessionId) {
        console.log("Syncing current session from backend:", currentSessionId);
        sessionStore.setActiveSession(currentSessionId);
      }

      agentStore.setConnectionStatus("connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect";
      agentStore.setError(message);
      throw error;
    }
  }

  /**
   * Disconnect from agent
   */
  async disconnect(): Promise<void> {
    const transport = getTransport();
    const agentStore = useAgentStore.getState();

    if (this.sessionActivatedUnsubscribe) {
      this.sessionActivatedUnsubscribe();
      this.sessionActivatedUnsubscribe = null;
    }

    try {
      await transport.disconnect();
    } finally {
      agentStore.reset();
    }
  }

  /**
   * Create a new session
   */
  async createSession(cwd?: string): Promise<SessionId> {
    const transport = getTransport();
    const workingDir = cwd || "/";
    const response = await transport.createSession(workingDir);
    // activeSessionId is set via backend broadcast (session/activated)
    return response.sessionId;
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string, cwd: string): Promise<SessionId> {
    const transport = getTransport();
    const response = await transport.resumeSession(sessionId, cwd);
    return response.sessionId;
  }

  /**
   * Fork an existing session
   */
  async forkSession(sessionId: string, cwd: string): Promise<SessionId> {
    const transport = getTransport();
    const response = await transport.forkSession(sessionId, cwd);
    return response.sessionId;
  }

  /**
   * List available sessions
   */
  async listSessions(cwd?: string, limit?: number, offset?: number): Promise<ListSessionsResponse> {
    const transport = getTransport();
    const sessionStore = useSessionStore.getState();

    sessionStore.setAvailableSessionsLoading(true);

    try {
      const response = await transport.listSessions(cwd, limit, offset);
      sessionStore.setAvailableSessions(response.sessions);
      return response;
    } finally {
      sessionStore.setAvailableSessionsLoading(false);
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    const transport = getTransport();
    return transport.getSessionInfo(sessionId);
  }

  /**
   * Send a prompt to a session
   * Note: User message is added optimistically by the UI hook,
   * and confirmed by server via session/update notification
   * @param sessionId - Session ID to send to
   * @param content - Message content
   * @param messageId - Optional message ID from optimistic update (for deduplication)
   */
  async sendPrompt(sessionId: SessionId, content: string, messageId?: string): Promise<void> {
    const transport = getTransport();
    const sessionStore = useSessionStore.getState();
    const agentStore = useAgentStore.getState();

    sessionStore.setLoading(true);

    try {
      const handleUpdate = (_update: SessionUpdate) => {
        // Updates are handled by useSessionData hook via event listeners
        // This callback is kept for permission handling during prompt
      };

      const handlePermissionRequest = async (
        request: PermissionRequest
      ): Promise<PermissionOutcome> => {
        agentStore.setPendingPermission(request);

        return new Promise((resolve) => {
          this.permissionResolver = resolve;
        });
      };

      await transport.prompt(sessionId, content, handleUpdate, handlePermissionRequest, messageId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      sessionStore.setError(message);
      throw error;
    } finally {
      sessionStore.setLoading(false);
    }
  }

  /**
   * Resolve a permission request
   */
  resolvePermission(outcome: PermissionOutcome): void {
    const agentStore = useAgentStore.getState();

    if (this.permissionResolver) {
      this.permissionResolver(outcome);
      this.permissionResolver = null;
    }

    agentStore.setPendingPermission(null);
  }

  /**
   * Cancel current prompt in a session
   */
  async cancelSession(sessionId: SessionId): Promise<void> {
    const transport = getTransport();
    await transport.cancelSession(sessionId);
  }

  /**
   * Set session mode
   */
  async setSessionMode(sessionId: SessionId, modeId: string): Promise<void> {
    const transport = getTransport();
    await transport.setSessionMode(sessionId, modeId);
  }

  // Keep old method name for backward compatibility
  sendMessage = this.sendPrompt;
}

export const agentAPI = new AgentAPI();
