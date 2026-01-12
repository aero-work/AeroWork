import type { Transport, InitializeResponse } from "./types";
import type {
  SessionId,
  NewSessionResponse,
  PromptResponse,
  SessionUpdate,
  PermissionRequest,
  PermissionOutcome,
} from "@/types/acp";

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
        this.connect().catch(console.error);
      }, delay);
    }
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

  async prompt(
    sessionId: SessionId,
    content: string,
    onUpdate: (update: SessionUpdate) => void,
    onPermissionRequest: (request: PermissionRequest) => Promise<PermissionOutcome>
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
}
