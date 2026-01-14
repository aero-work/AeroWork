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
  Implementation,
  AgentCapabilities,
  AuthMethod,
} from "@/types/acp";

export interface InitializeResponse {
  protocolVersion: number;
  agentInfo?: Implementation;
  agentCapabilities?: AgentCapabilities;
  authMethods?: AuthMethod[];
}

export interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  initialize(): Promise<InitializeResponse>;

  createSession(cwd: string): Promise<NewSessionResponse>;

  // Session management
  resumeSession(sessionId: string, cwd: string): Promise<NewSessionResponse>;
  forkSession(sessionId: string, cwd: string): Promise<NewSessionResponse>;
  listSessions(cwd?: string, limit?: number, offset?: number): Promise<ListSessionsResponse>;
  getSessionInfo(sessionId: string): Promise<SessionInfo>;

  prompt(
    sessionId: SessionId,
    content: string,
    onUpdate: (update: SessionUpdate) => void,
    onPermissionRequest: (
      request: PermissionRequest
    ) => Promise<PermissionOutcome>,
    messageId?: string
  ): Promise<PromptResponse>;

  cancelSession(sessionId: SessionId): Promise<void>;

  setSessionMode(sessionId: SessionId, modeId: string): Promise<void>;

  // Session state subscription methods
  subscribeSession(sessionId: SessionId): Promise<SessionState>;
  unsubscribeSession(sessionId: SessionId): Promise<void>;
  getSessionState(sessionId: SessionId): Promise<SessionState>;

  // Generic request for custom methods
  request<T>(method: string, params?: unknown): Promise<T>;
}

export interface TransportConfig {
  websocketUrl?: string;
}
