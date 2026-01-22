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

import { getTransport, isDesktopApp } from "./transport";
import type { ServerInfo } from "./transport";
import { WebSocketTransport } from "./transport/websocket";

const DEFAULT_LOCAL_WS_URL = "ws://127.0.0.1:9527/ws";
import { useAgentStore } from "@/stores/agentStore";
import { useSettingsStore, type PermissionRule } from "@/stores/settingsStore";
import { useFileStore } from "@/stores/fileStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type {
  SessionId,
  SessionInfo,
  ListSessionsResponse,
  PermissionRequest,
  PermissionOutcome,
  SessionUpdate,
  MCPServer,
} from "@/types/acp";

/**
 * Check if a tool name matches a permission rule pattern
 */
function matchesRule(toolName: string, rule: PermissionRule): boolean {
  if (!rule.enabled) return false;

  try {
    const regex = new RegExp(`^(${rule.toolPattern})$`, "i");
    return regex.test(toolName);
  } catch {
    // Invalid regex, try exact match
    return toolName.toLowerCase() === rule.toolPattern.toLowerCase();
  }
}

/**
 * Check permission rules from settings store (synchronous, no WebSocket calls)
 */
function checkPermissionRules(request: PermissionRequest): PermissionOutcome | null {
  const rules = useSettingsStore.getState().permissionRules;

  if (!rules || rules.length === 0) {
    return null; // No rules, show dialog
  }

  // Extract tool name from title (e.g., "Read /path/to/file" -> "Read")
  const toolName = request.toolCall.title?.split(" ")[0] || "";

  // Check rules in order (first match wins)
  for (const rule of rules) {
    if (matchesRule(toolName, rule)) {
      if (rule.action === "allow") {
        // Find the allow option
        const allowOption = request.options.find(
          (opt) => opt.kind === "allow_once" || opt.kind === "allow_always"
        );
        if (allowOption) {
          return { outcome: "selected", optionId: allowOption.optionId };
        }
      } else if (rule.action === "deny") {
        // Find the reject option
        const rejectOption = request.options.find(
          (opt) => opt.kind === "reject_once" || opt.kind === "reject_always"
        );
        if (rejectOption) {
          return { outcome: "selected", optionId: rejectOption.optionId };
        }
      }
      // action === "ask" means show dialog
      return null;
    }
  }

  return null; // No matching rule, show dialog
}

class AgentAPI {
  private permissionResolver: ((outcome: PermissionOutcome) => void) | null = null;
  private sessionActivatedUnsubscribe: (() => void) | null = null;
  private reconnectUnsubscribe: (() => void) | null = null;

  /**
   * Global permission handler - handles all permission requests from any session
   * Note: Dangerous mode auto-approval is now handled on the server side
   */
  private handleGlobalPermissionRequest = (
    request: PermissionRequest
  ): Promise<PermissionOutcome> => {
    const agentStore = useAgentStore.getState();

    // Check permission rules first (synchronous, uses settings store)
    const autoOutcome = checkPermissionRules(request);
    if (autoOutcome) {
      return Promise.resolve(autoOutcome);
    }

    // No matching rule or rule says "ask", show dialog
    agentStore.setPendingPermission(request);

    return new Promise((resolve) => {
      this.permissionResolver = resolve;
    });
  };

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

      // Set up global permission handler for all permission requests
      transport.setGlobalPermissionHandler(this.handleGlobalPermissionRequest);

      // Set up handler for when permission is resolved by another client
      transport.onPermissionResolved((requestId, sessionId) => {
        console.log("Permission resolved by another client:", requestId, sessionId);
        const agentStore = useAgentStore.getState();
        // Clear pending permission dialog if it matches
        const pending = agentStore.pendingPermission;
        if (pending && JSON.stringify(pending.requestId) === JSON.stringify(requestId)) {
          agentStore.setPendingPermission(null);
          // Clear the resolver since permission was handled elsewhere
          this.permissionResolver = null;
        }
      });

      // Subscribe to session activation events from backend
      this.sessionActivatedUnsubscribe = transport.onSessionActivated((sessionId) => {
        console.log("Session activated from backend:", sessionId);
        sessionStore.setActiveSession(sessionId);
      });

      // Register reconnect handler to restore terminal state
      this.reconnectUnsubscribe = transport.onReconnect(() => {
        console.log("WebSocket reconnected, restoring terminal state...");
        const terminalStore = useTerminalStore.getState();
        terminalStore.listTerminals().catch((err) => {
          console.warn("Failed to restore terminals on reconnect:", err);
        });
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

      // Sync current session from backend (skip on first launch to show welcome screen)
      const settingsStore = useSettingsStore.getState();
      if (settingsStore.hasLaunchedBefore) {
        const currentSessionId = await transport.getCurrentSession();
        if (currentSessionId) {
          console.log("Syncing current session from backend:", currentSessionId);
          sessionStore.setActiveSession(currentSessionId);
        }
      } else {
        console.log("First launch detected, clearing session and showing welcome screen");
        // Clear any persisted session ID from localStorage
        sessionStore.setActiveSession(null);
        // Mark as launched after first successful connection
        settingsStore.markLaunched();
      }

      // Get server info (cwd, home path) and set defaults
      try {
        const serverInfo = await transport.request<ServerInfo>("get_server_info");
        console.log("Server info:", serverInfo);
        const fileStore = useFileStore.getState();
        fileStore.setServerPaths(serverInfo.cwd, serverInfo.home);
      } catch (e) {
        console.warn("Failed to get server info:", e);
      }

      // Load recent projects from server
      try {
        const response = await transport.request<{ projects: Array<{ path: string; name: string; lastOpened: number }> }>("get_recent_projects");
        console.log("Recent projects from server:", response.projects);
        const fileStore = useFileStore.getState();
        fileStore.setRecentProjects(response.projects);
      } catch (e) {
        console.warn("Failed to load recent projects:", e);
      }

      // Restore existing terminals from backend
      try {
        const terminalStore = useTerminalStore.getState();
        await terminalStore.listTerminals();
        console.log("Restored terminals:", terminalStore.terminals.length);
      } catch (e) {
        console.warn("Failed to restore terminals:", e);
      }

      agentStore.setConnectionStatus("connected");
      // Clear any detected local server since we're now connected
      agentStore.setDetectedLocalServer(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect";
      agentStore.setError(message);

      // For desktop app: if connection failed, try to detect local server on default port
      if (isDesktopApp()) {
        this.detectLocalServer();
      }

      throw error;
    }
  }

  /**
   * Detect if local server is running on default port (desktop app only)
   */
  private async detectLocalServer(): Promise<void> {
    const agentStore = useAgentStore.getState();
    const currentUrl = getTransport().getUrl?.() || "";

    // Don't detect if already trying to connect to default local URL
    if (currentUrl === DEFAULT_LOCAL_WS_URL) {
      return;
    }

    console.log("Checking for local server on default port...");

    try {
      // Try to connect to default local server
      const testTransport = new WebSocketTransport(DEFAULT_LOCAL_WS_URL);
      await testTransport.connect();

      // If successful, store the detected URL and disconnect test connection
      console.log("Local server detected at", DEFAULT_LOCAL_WS_URL);
      agentStore.setDetectedLocalServer(DEFAULT_LOCAL_WS_URL);

      testTransport.disconnect();
    } catch {
      console.log("No local server found on default port");
      agentStore.setDetectedLocalServer(null);
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

    if (this.reconnectUnsubscribe) {
      this.reconnectUnsubscribe();
      this.reconnectUnsubscribe = null;
    }

    try {
      await transport.disconnect();
    } finally {
      agentStore.reset();
    }
  }

  /**
   * Convert settings MCP server format to ACP protocol format
   */
  private getMcpServers(): MCPServer[] {
    const settingsStore = useSettingsStore.getState();
    const enabledServers = settingsStore.mcpServers.filter(s => s.enabled);

    return enabledServers.map(server => {
      // Convert env from Record<string, string> to array format
      const envArray = server.env
        ? Object.entries(server.env).map(([name, value]) => ({ name, value }))
        : undefined;

      return {
        name: server.name,
        command: server.command,
        args: server.args,
        env: envArray,
      };
    });
  }

  /**
   * Create a new session
   */
  async createSession(cwd?: string): Promise<SessionId> {
    const transport = getTransport();
    const fileStore = useFileStore.getState();
    // Use provided cwd, or current working dir, or server cwd, or fallback to "/"
    const workingDir = cwd || fileStore.currentWorkingDir || fileStore.serverCwd || "/";
    const mcpServers = this.getMcpServers();
    const response = await transport.createSession(workingDir, mcpServers);
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
    const settingsStore = useSettingsStore.getState();

    sessionStore.setAvailableSessionsLoading(true);

    try {
      const response = await transport.listSessions(cwd, limit, offset);

      // Filter out empty sessions if auto-clean is enabled
      // Empty = no messages, or has user message but no agent response
      let sessions = response.sessions;
      if (settingsStore.autoCleanEmptySessions) {
        sessions = sessions.filter(s => s.active || s.hasAgentResponse);
      }

      sessionStore.setAvailableSessions(sessions);

      // Validate activeSessionId against available sessions
      // Clear it if session doesn't exist or doesn't match current project
      const activeSessionId = sessionStore.activeSessionId;
      if (activeSessionId) {
        const activeSession = sessions.find(s => s.id === activeSessionId);
        const shouldClear = !activeSession || (cwd && activeSession.cwd !== cwd);
        if (shouldClear) {
          console.log(
            `Clearing invalid activeSessionId: ${activeSessionId}`,
            activeSession ? `(cwd mismatch: ${activeSession.cwd} vs ${cwd})` : "(session not found)"
          );
          sessionStore.setActiveSession(null);
        }
      }

      return { ...response, sessions };
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
   * Delete a session and its file
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const transport = getTransport() as WebSocketTransport;
    const sessionStore = useSessionStore.getState();

    const result = await transport.deleteSession(sessionId);

    // If deleted session was active, clear it
    if (sessionStore.activeSessionId === sessionId) {
      sessionStore.setActiveSession(null);
    }

    // Remove from available sessions list
    const currentSessions = sessionStore.availableSessions;
    sessionStore.setAvailableSessions(currentSessions.filter(s => s.id !== sessionId));

    return result.deleted;
  }

  /**
   * Send a prompt to a session
   * Note: User message is added optimistically by the UI hook,
   * and confirmed by server via session/update notification.
   * Permission handling is done via global handler (set on connect)
   * which broadcasts to all clients like messages.
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
        // This callback is kept for API compatibility
      };

      // Permission handling is done via global handler (set on connect)
      // which broadcasts to all clients like messages
      const noopPermissionHandler = () => Promise.reject(new Error("Use global handler"));

      await transport.prompt(sessionId, content, handleUpdate, noopPermissionHandler, messageId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      sessionStore.setError(message);
      throw error;
    } finally {
      sessionStore.setLoading(false);
      // Clean up permission state in case of error during prompt
      // This ensures dialog closes if prompt fails after showing permission request
      if (this.permissionResolver) {
        this.permissionResolver = null;
        agentStore.setPendingPermission(null);
      }
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
   * Cancel current prompt in a session (only works if session is running)
   */
  async cancelSession(sessionId: SessionId): Promise<void> {
    const transport = getTransport();
    await transport.cancelSession(sessionId);
  }

  /**
   * Stop a session: cancel if running, unload from memory, mark as stopped
   */
  async stopSession(sessionId: SessionId): Promise<void> {
    const transport = getTransport();
    await transport.request("stop_session", { sessionId });
  }

  /**
   * Set dangerous mode for a session (auto-approve all tool calls)
   */
  async setDangerousMode(sessionId: SessionId, enabled: boolean): Promise<boolean> {
    const transport = getTransport();
    const result = await transport.request<{ success: boolean; dangerousMode: boolean }>(
      "set_dangerous_mode",
      { sessionId, enabled }
    );
    return result.dangerousMode;
  }

  /**
   * Get dangerous mode status for a session
   */
  async getDangerousMode(sessionId: SessionId): Promise<boolean> {
    const transport = getTransport();
    const result = await transport.request<{ dangerousMode: boolean }>(
      "get_dangerous_mode",
      { sessionId }
    );
    return result.dangerousMode;
  }

  /**
   * Set session mode
   */
  async setSessionMode(sessionId: SessionId, modeId: string): Promise<void> {
    const transport = getTransport();
    await transport.setSessionMode(sessionId, modeId);
  }

  /**
   * Add a project to recent projects (syncs with server)
   */
  async addRecentProject(path: string, name?: string): Promise<void> {
    const transport = getTransport();
    const fileStore = useFileStore.getState();

    try {
      const response = await transport.request<{ projects: Array<{ path: string; name: string; lastOpened: number }> }>(
        "add_recent_project",
        { path, name }
      );
      fileStore.setRecentProjects(response.projects);
    } catch (e) {
      console.warn("Failed to sync recent project to server:", e);
      // Fall back to local-only update
      fileStore.addRecentProject(path, name);
    }
  }

  /**
   * Remove a project from recent projects (syncs with server)
   */
  async removeRecentProject(path: string): Promise<void> {
    const transport = getTransport();
    const fileStore = useFileStore.getState();

    try {
      const response = await transport.request<{ projects: Array<{ path: string; name: string; lastOpened: number }> }>(
        "remove_recent_project",
        { path }
      );
      fileStore.setRecentProjects(response.projects);
    } catch (e) {
      console.warn("Failed to sync recent project removal to server:", e);
      // Fall back to local-only update
      fileStore.removeRecentProject(path);
    }
  }

  /**
   * Clear all recent projects (syncs with server)
   */
  async clearRecentProjects(): Promise<void> {
    const transport = getTransport();
    const fileStore = useFileStore.getState();

    try {
      await transport.request("clear_recent_projects");
      fileStore.setRecentProjects([]);
    } catch (e) {
      console.warn("Failed to sync recent projects clear to server:", e);
      // Fall back to local-only update
      fileStore.clearRecentProjects();
    }
  }

  // Keep old method name for backward compatibility
  sendMessage = this.sendPrompt;
}

export const agentAPI = new AgentAPI();
