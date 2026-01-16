export type SessionId = string;
export type ToolCallId = string;
export type PermissionOptionId = string;
export type SessionModeId = string;

// MCP Server Types
export interface MCPServerStdio {
  name: string;
  command: string;
  args?: string[];
  env?: { name: string; value: string }[];
}

export interface MCPServerHttp {
  name: string;
  type: "http" | "sse";
  url: string;
  headers?: { name: string; value: string }[];
}

export type MCPServer = MCPServerStdio | MCPServerHttp;

export interface Implementation {
  name: string;
  title?: string;
  version: string;
}

export interface ClientCapabilities {
  fs?: {
    readTextFile?: boolean;
    writeTextFile?: boolean;
  };
  terminal?: boolean;
}

export interface AgentCapabilities {
  promptCapabilities?: {
    image?: boolean;
    audio?: boolean;
    embeddedContext?: boolean;
  };
  mcpCapabilities?: {
    http?: boolean;
    sse?: boolean;
  };
  sessionCapabilities?: {
    fork?: object;
    resume?: object;
  };
  loadSession?: boolean;
}

export interface AuthMethod {
  id: string;
  name: string;
  description?: string;
}

export interface SessionMode {
  id: SessionModeId;
  name: string;
  description?: string;
}

export interface SessionModeState {
  currentModeId: SessionModeId;
  availableModes: SessionMode[];
}

export interface SessionModelState {
  currentModelId: string;
  availableModels: {
    modelId: string;
    name: string;
    description?: string;
  }[];
}

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";
export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";

export interface ToolCallLocation {
  path: string;
  line?: number;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
  uri?: string;
}

export interface Diff {
  type: "diff";
  path: string;
  oldText?: string;
  newText: string;
}

export interface Terminal {
  type: "terminal";
  terminalId: string;
}

export type ToolCallContent =
  | { type: "content"; content: TextContent | ImageContent }
  | Diff
  | Terminal;

export interface ToolCall {
  toolCallId: ToolCallId;
  title: string;
  kind?: ToolKind;
  status?: ToolCallStatus;
  rawInput?: unknown;
  rawOutput?: unknown;
  content?: ToolCallContent[];
  locations?: ToolCallLocation[];
}

export interface ToolCallUpdate {
  toolCallId: ToolCallId;
  title?: string;
  kind?: ToolKind;
  status?: ToolCallStatus;
  rawInput?: unknown;
  rawOutput?: unknown;
  content?: ToolCallContent[];
  locations?: ToolCallLocation[];
}

export interface PlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}

export interface Plan {
  entries: PlanEntry[];
}

export type PermissionOptionKind = "allow_once" | "allow_always" | "reject_once" | "reject_always";

export interface PermissionOption {
  optionId: PermissionOptionId;
  name: string;
  kind: PermissionOptionKind;
}

export interface PermissionRequest {
  requestId: unknown;
  sessionId: SessionId;
  toolCall: ToolCallUpdate;
  options: PermissionOption[];
}

export type PermissionOutcome =
  | { outcome: "cancelled" }
  | { outcome: "selected"; optionId: PermissionOptionId };

export interface AvailableCommand {
  name: string;
  description: string;
  input?: {
    hint: string;
  };
}

export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "max_turn_requests"
  | "refusal"
  | "cancelled";

// AskUserQuestion tool types
export interface AskUserQuestionOption {
  label: string;
  description: string;
}

export interface AskUserQuestion {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect: boolean;
}

export interface AskUserQuestionInput {
  questions: AskUserQuestion[];
}

// TodoWrite tool types
export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  content: string;
  activeForm: string;
  status: TodoStatus;
}

export interface TodoWriteInput {
  todos: TodoItem[];
}

export type SessionUpdate =
  | { sessionUpdate: "user_message_chunk"; content: TextContent | ImageContent }
  | {
      sessionUpdate: "agent_message_chunk";
      content: TextContent | ImageContent;
    }
  | { sessionUpdate: "agent_thought_chunk"; content: TextContent }
  | ({ sessionUpdate: "tool_call" } & ToolCall)
  | ({ sessionUpdate: "tool_call_update" } & ToolCallUpdate)
  | ({ sessionUpdate: "plan" } & Plan)
  | {
      sessionUpdate: "available_commands_update";
      availableCommands: AvailableCommand[];
    }
  | { sessionUpdate: "current_mode_update"; currentModeId: SessionModeId };

export interface SessionNotification {
  sessionId: SessionId;
  update: SessionUpdate;
}

export interface NewSessionParams {
  cwd: string;
  mcpServers?: MCPServer[];
}

export interface NewSessionResponse {
  sessionId: SessionId;
  modes?: SessionModeState;
  models?: SessionModelState;
}

export interface PromptResponse {
  stopReason: StopReason;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Unified chat item - can be a message or tool call
export type ChatItem =
  | { type: "message"; message: Message }
  | { type: "tool_call"; toolCall: ToolCall };

export interface Session {
  id: SessionId;
  name: string;
  // Working directory for the session
  cwd?: string;
  // Unified ordered list of all chat items (messages + tool calls)
  chatItems: ChatItem[];
  // Map for quick lookup of tool calls by ID (for updates)
  toolCallsMap: Map<ToolCallId, ToolCall>;
  plan?: Plan;
  modes?: SessionModeState;
  models?: SessionModelState;
  availableCommands?: AvailableCommand[];
  createdAt: number;
  updatedAt: number;
}

/** Session status for UI display */
export type SessionStatus = "stopped" | "idle" | "running" | "pending";

// Session info from backend (list_sessions response)
export interface SessionInfo {
  id: SessionId;
  summary: string;
  messageCount: number;
  lastActivity: string;
  cwd: string;
  active: boolean;
  /** Session status: stopped (not loaded), idle (waiting input), running (processing), pending (waiting permission) */
  status: SessionStatus;
  project?: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  /** Whether the session has any agent response (text or tool call) */
  hasAgentResponse: boolean;
}

export interface ListSessionsResponse {
  sessions: SessionInfo[];
  hasMore: boolean;
  total: number;
}

// === Backend-driven Session State Types ===

/**
 * SessionState from backend - single source of truth
 * Matches the Rust SessionState struct
 */
export interface SessionState {
  id: SessionId;
  cwd: string;
  chatItems: ChatItem[];
  plan?: Plan;
  modes?: SessionModeState;
  models?: SessionModelState;
  availableCommands?: AvailableCommand[];
  /** Pending permission request waiting for user response */
  pendingPermission?: PermissionRequest | null;
  /** Dangerous mode - auto-approve all tool calls for this session */
  dangerousMode?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Delta updates from backend for efficient sync
 * Matches the Rust SessionStateUpdate enum
 */
export type SessionStateUpdate =
  | { updateType: "message_chunk"; content: string }
  | { updateType: "message_added"; message: Message }
  | { updateType: "tool_call_added"; toolCall: ToolCall }
  | { updateType: "tool_call_updated"; toolCall: ToolCall }
  | { updateType: "plan_updated"; plan: Plan }
  | { updateType: "available_commands_updated"; commands: AvailableCommand[] }
  | { updateType: "current_mode_updated"; modeId: SessionModeId }
  | { updateType: "full_state"; state: SessionState }
  | { updateType: "dangerous_mode_updated"; dangerousMode: boolean }
  | { updateType: "noop" };
