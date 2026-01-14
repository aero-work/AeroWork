import type { Transport, InitializeResponse } from "./types";
import type {
  SessionId,
  SessionInfo,
  ListSessionsResponse,
  NewSessionResponse,
  PromptResponse,
  SessionUpdate,
  SessionState,
  PermissionRequest,
  PermissionOutcome,
} from "@/types/acp";
import type {
  ListPluginsResponse,
  MarketplaceResponse,
  InstallPluginResponse,
  UninstallPluginResponse,
} from "@/types/plugins";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: { code: number; message: string };
  id: number;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: unknown;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private connected = false;
  private url: string;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private permissionHandler:
    | ((request: PermissionRequest) => Promise<PermissionOutcome>)
    | null = null;
  private sessionActivatedHandler: ((sessionId: string | null) => void) | null = null;
  private reconnectHandlers = new Set<() => void>();

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected to", this.url);
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          this.connected = false;
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          if (!this.connected) {
            reject(new Error("Failed to connect to WebSocket server"));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleDisconnect() {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error("WebSocket disconnected"));
      this.pendingRequests.delete(id);
    }

    // Try to reconnect if we haven't exceeded max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        this.connect()
          .then(() => {
            // Notify reconnect handlers
            console.log("Reconnected, notifying handlers...");
            this.reconnectHandlers.forEach((handler) => handler());
          })
          .catch(console.error);
      }, delay);
    }
  }

  /**
   * Register a handler to be called when WebSocket reconnects
   */
  onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  /**
   * Remove a reconnect handler
   */
  offReconnect(handler: () => void): void {
    this.reconnectHandlers.delete(handler);
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);

      // Check if it's a response (has id)
      if ("id" in message && message.id !== null) {
        const response = message as JsonRpcResponse;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
        return;
      }

      // It's a notification
      const notification = message as JsonRpcNotification;
      this.handleNotification(notification);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private handleNotification(notification: JsonRpcNotification) {
    const { method, params } = notification;

    switch (method) {
      case "session/update": {
        const { sessionId, update } = params as {
          sessionId: string;
          update: SessionUpdate;
        };
        const handlers = this.eventHandlers.get(`session-update-${sessionId}`);
        if (handlers) {
          for (const handler of handlers) {
            handler(update);
          }
        }
        break;
      }
      case "permission/request": {
        const request = params as PermissionRequest;
        if (this.permissionHandler) {
          this.permissionHandler(request).then((outcome) => {
            this.send("respond_permission", {
              requestId: request.requestId,
              outcome,
            }).catch(console.error);
          });
        }
        break;
      }
      case "terminal/output": {
        const handlers = this.eventHandlers.get("terminal:output");
        if (handlers) {
          for (const handler of handlers) {
            handler(params);
          }
        }
        break;
      }
      case "session/activated": {
        const { sessionId } = params as { sessionId: string | null };
        if (this.sessionActivatedHandler) {
          this.sessionActivatedHandler(sessionId);
        }
        break;
      }
      case "session/state_update": {
        const { sessionId, update } = params as {
          sessionId: string;
          update: unknown;
        };
        const handlers = this.eventHandlers.get(`session-state-update-${sessionId}`);
        if (handlers) {
          for (const handler of handlers) {
            handler(update);
          }
        }
        // Also broadcast to generic handler for all sessions
        const globalHandlers = this.eventHandlers.get("session-state-update");
        if (globalHandlers) {
          for (const handler of globalHandlers) {
            handler({ sessionId, update });
          }
        }
        break;
      }
      default:
        console.log("Unhandled notification:", method, params);
    }
  }

  // Made public for use by service layer
  async send<T>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.ws!.send(JSON.stringify(request));
    });
  }

  async disconnect(): Promise<void> {
    if (!this.ws) return;

    try {
      await this.send("disconnect");
    } catch {
      // Ignore disconnect errors
    }

    this.ws.close();
    this.ws = null;
    this.connected = false;
    this.eventHandlers.clear();
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  async initialize(): Promise<InitializeResponse> {
    // First connect the agent
    await this.send("connect");
    // Then initialize
    return this.send<InitializeResponse>("initialize");
  }

  async createSession(cwd: string): Promise<NewSessionResponse> {
    return this.send<NewSessionResponse>("create_session", { cwd });
  }

  async resumeSession(sessionId: string, cwd: string): Promise<NewSessionResponse> {
    return this.send<NewSessionResponse>("resume_session", { sessionId, cwd });
  }

  async forkSession(sessionId: string, cwd: string): Promise<NewSessionResponse> {
    return this.send<NewSessionResponse>("fork_session", { sessionId, cwd });
  }

  async listSessions(cwd?: string, limit?: number, offset?: number): Promise<ListSessionsResponse> {
    return this.send<ListSessionsResponse>("list_sessions", { cwd, limit, offset });
  }

  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    return this.send<SessionInfo>("get_session_info", { sessionId });
  }

  async prompt(
    sessionId: SessionId,
    content: string,
    onUpdate: (update: SessionUpdate) => void,
    onPermissionRequest: (request: PermissionRequest) => Promise<PermissionOutcome>,
    messageId?: string
  ): Promise<PromptResponse> {
    // Set up event handler for session updates
    const eventKey = `session-update-${sessionId}`;
    if (!this.eventHandlers.has(eventKey)) {
      this.eventHandlers.set(eventKey, new Set());
    }
    // Wrap the handler to match the generic signature
    const wrappedHandler = (data: unknown) => onUpdate(data as SessionUpdate);
    this.eventHandlers.get(eventKey)!.add(wrappedHandler);

    // Set up permission handler
    this.permissionHandler = onPermissionRequest;

    try {
      const response = await this.send<PromptResponse>("send_prompt", {
        sessionId,
        content,
        messageId, // Pass messageId to backend for deduplication
      });
      return response;
    } finally {
      // Clean up event handler
      this.eventHandlers.get(eventKey)?.delete(wrappedHandler);
      if (this.eventHandlers.get(eventKey)?.size === 0) {
        this.eventHandlers.delete(eventKey);
      }
      this.permissionHandler = null;
    }
  }

  async cancelSession(sessionId: SessionId): Promise<void> {
    await this.send("cancel_session", { sessionId });
  }

  async setSessionMode(sessionId: SessionId, modeId: string): Promise<void> {
    await this.send("set_session_mode", { sessionId, modeId });
  }

  // Terminal event subscription for external use
  onTerminalOutput(handler: (output: { terminalId: string; data: string }) => void): () => void {
    const eventKey = "terminal:output";
    if (!this.eventHandlers.has(eventKey)) {
      this.eventHandlers.set(eventKey, new Set());
    }
    this.eventHandlers.get(eventKey)!.add(handler as (data: unknown) => void);

    return () => {
      this.eventHandlers.get(eventKey)?.delete(handler as (data: unknown) => void);
    };
  }

  // Session activation subscription
  onSessionActivated(handler: (sessionId: string | null) => void): () => void {
    this.sessionActivatedHandler = handler;
    return () => {
      this.sessionActivatedHandler = null;
    };
  }

  // Get current active session from backend
  async getCurrentSession(): Promise<string | null> {
    const result = await this.send<{ sessionId: string | null }>("get_current_session");
    return result.sessionId;
  }

  // Set current active session on backend (broadcasts to all clients)
  async setCurrentSession(sessionId: string | null): Promise<void> {
    await this.send("set_current_session", { sessionId });
  }

  // === Session State Subscription Methods ===

  /**
   * Get the client ID assigned by the backend
   */
  async getClientId(): Promise<string> {
    const result = await this.send<{ clientId: string }>("get_client_id");
    return result.clientId;
  }

  /**
   * Subscribe to session state updates
   * Returns the current session state and starts receiving updates
   * @param sessionId - Session ID to subscribe to
   * @param autoResume - If true, automatically resume historical sessions (default: true)
   */
  async subscribeSession(sessionId: SessionId, autoResume = true): Promise<SessionState> {
    return this.send<SessionState>("subscribe_session", { sessionId, autoResume });
  }

  /**
   * Unsubscribe from session state updates
   */
  async unsubscribeSession(sessionId: SessionId): Promise<void> {
    await this.send("unsubscribe_session", { sessionId });
  }

  /**
   * Get session state without subscribing (one-time fetch)
   * @param sessionId - Session ID to get state for
   * @param autoResume - If true, automatically resume historical sessions (default: true)
   */
  async getSessionState(sessionId: SessionId, autoResume = true): Promise<SessionState> {
    return this.send<SessionState>("get_session_state", { sessionId, autoResume });
  }

  /**
   * Generic request method for hooks
   */
  async request<T>(method: string, params?: unknown): Promise<T> {
    return this.send<T>(method, params);
  }

  /**
   * Subscribe to ACP session update notifications for a specific session
   * These are real-time updates from the ACP agent during prompts
   * @param sessionId - Session ID to listen for updates
   * @param handler - Callback for session updates
   * @returns Unsubscribe function
   */
  onSessionUpdate(sessionId: string, handler: (update: SessionUpdate) => void): () => void {
    const eventKey = `session-update-${sessionId}`;
    if (!this.eventHandlers.has(eventKey)) {
      this.eventHandlers.set(eventKey, new Set());
    }
    this.eventHandlers.get(eventKey)!.add(handler as (data: unknown) => void);

    return () => {
      this.eventHandlers.get(eventKey)?.delete(handler as (data: unknown) => void);
      if (this.eventHandlers.get(eventKey)?.size === 0) {
        this.eventHandlers.delete(eventKey);
      }
    };
  }

  /**
   * Subscribe to session state update notifications for a specific session
   * These are backend state sync updates (includes cross-client syncing)
   * @param sessionId - Session ID to listen for updates
   * @param handler - Callback for state updates
   * @returns Unsubscribe function
   */
  onSessionStateUpdate(sessionId: string, handler: (update: unknown) => void): () => void {
    const eventKey = `session-state-update-${sessionId}`;
    if (!this.eventHandlers.has(eventKey)) {
      this.eventHandlers.set(eventKey, new Set());
    }
    this.eventHandlers.get(eventKey)!.add(handler);

    return () => {
      this.eventHandlers.get(eventKey)?.delete(handler);
      if (this.eventHandlers.get(eventKey)?.size === 0) {
        this.eventHandlers.delete(eventKey);
      }
    };
  }

  /**
   * Subscribe to all session state update notifications
   * @param handler - Callback receiving { sessionId, update }
   * @returns Unsubscribe function
   */
  onAnySessionStateUpdate(handler: (data: { sessionId: string; update: unknown }) => void): () => void {
    const eventKey = "session-state-update";
    if (!this.eventHandlers.has(eventKey)) {
      this.eventHandlers.set(eventKey, new Set());
    }
    this.eventHandlers.get(eventKey)!.add(handler as (data: unknown) => void);

    return () => {
      this.eventHandlers.get(eventKey)?.delete(handler as (data: unknown) => void);
      if (this.eventHandlers.get(eventKey)?.size === 0) {
        this.eventHandlers.delete(eventKey);
      }
    };
  }

  // === Plugin Methods ===

  /**
   * List all marketplaces and their plugins
   */
  async listPlugins(): Promise<ListPluginsResponse> {
    return this.send<ListPluginsResponse>("list_plugins");
  }

  /**
   * Add a new marketplace by cloning a git repository
   */
  async addMarketplace(name: string, gitUrl: string): Promise<MarketplaceResponse> {
    return this.send<MarketplaceResponse>("add_marketplace", { name, gitUrl });
  }

  /**
   * Delete a marketplace
   */
  async deleteMarketplace(name: string): Promise<MarketplaceResponse> {
    return this.send<MarketplaceResponse>("delete_marketplace", { name });
  }

  /**
   * Update a marketplace by pulling latest changes
   */
  async updateMarketplace(name: string): Promise<MarketplaceResponse> {
    return this.send<MarketplaceResponse>("update_marketplace", { name });
  }

  /**
   * Install/enable a plugin
   */
  async installPlugin(pluginName: string, marketplaceName: string): Promise<InstallPluginResponse> {
    return this.send<InstallPluginResponse>("install_plugin", { pluginName, marketplaceName });
  }

  /**
   * Uninstall/disable a plugin
   */
  async uninstallPlugin(pluginKey: string): Promise<UninstallPluginResponse> {
    return this.send<UninstallPluginResponse>("uninstall_plugin", { pluginKey });
  }

  /**
   * Toggle marketplace enabled state
   */
  async toggleMarketplace(name: string, enabled: boolean): Promise<MarketplaceResponse> {
    return this.send<MarketplaceResponse>("toggle_marketplace", { name, enabled });
  }
}
