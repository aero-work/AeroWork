# Aero Code - Project Structure

## Directory Layout

```
aero-code/
├── .agent/                       # AI assistant documentation
│   ├── AGENT.md                  # Main Claude Code instructions (READ FIRST)
│   ├── product.md                # Product overview and features
│   ├── tech.md                   # Technology stack
│   └── structure.md              # This file
├── src-tauri/                    # Rust Backend (Tauri)
│   ├── src/
│   │   ├── main.rs               # Application entry point
│   │   ├── lib.rs                # Library exports & command registration
│   │   ├── acp/                  # ACP protocol implementation
│   │   │   ├── mod.rs
│   │   │   ├── types.rs          # Protocol types (JsonRpc, ContentBlock, etc.)
│   │   │   └── client.rs         # ACP client (JSON-RPC over stdio)
│   │   ├── core/                 # Core business logic
│   │   │   ├── mod.rs
│   │   │   ├── agent.rs          # AgentManager (spawn, message handling)
│   │   │   └── state.rs          # AppState (shared state)
│   │   └── commands/             # Tauri IPC commands
│   │       ├── mod.rs
│   │       ├── agent.rs          # connect, disconnect, initialize, respond_permission
│   │       ├── session.rs        # create_session, send_prompt, cancel, set_mode
│   │       └── file.rs           # list_directory, read_file, write_file, create, delete, rename
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # Frontend (React/TypeScript)
│   ├── components/
│   │   ├── layout/               # Layout components
│   │   │   ├── MainLayout.tsx    # Main layout with resizable panels
│   │   │   ├── Header.tsx        # Top header with Connect button
│   │   │   ├── Sidebar.tsx       # Left sidebar (sessions, files, agents)
│   │   │   └── StatusBar.tsx     # Bottom status bar
│   │   ├── chat/                 # Chat interface components
│   │   │   ├── index.ts          # Barrel export
│   │   │   ├── ChatView.tsx      # Main chat container with empty states
│   │   │   ├── ChatInput.tsx     # Message input with submit/cancel
│   │   │   ├── MessageList.tsx   # Message list with auto-scroll
│   │   │   ├── MessageItem.tsx   # Single message rendering
│   │   │   └── ToolCallCard.tsx  # Tool execution with expand/collapse
│   │   ├── common/               # Shared UI components
│   │   │   ├── PermissionDialog.tsx  # Permission request modal
│   │   │   └── ProjectSelector.tsx   # Project/directory picker
│   │   └── ui/                   # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── resizable.tsx     # Resizable panel layout
│   │       ├── scroll-area.tsx
│   │       └── ... (other shadcn components)
│   ├── stores/                   # Zustand state stores
│   │   ├── sessionStore.ts       # Sessions, messages, tool calls
│   │   ├── agentStore.ts         # Agent connections, agent info
│   │   └── fileStore.ts          # Working directory, recent projects
│   ├── services/                 # Backend communication layer
│   │   ├── transport/
│   │   │   ├── index.ts          # Transport factory
│   │   │   ├── types.ts          # Transport interface
│   │   │   └── tauri.ts          # TauriTransport (invoke/listen)
│   │   └── api.ts                # AgentAPI class (high-level wrapper)
│   ├── types/
│   │   └── acp.ts                # ACP protocol types (must match Rust)
│   ├── lib/
│   │   └── utils.ts              # cn(), formatters, etc.
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Global styles + Tailwind
├── reference/                    # Reference implementations (read-only)
│   ├── agent-client-protocol/    # ACP specification
│   └── claude-code-acp/          # Claude Code ACP adapter
├── index.html                    # HTML entry
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind configuration
├── components.json               # shadcn/ui configuration
├── package.json
├── tsconfig.json
└── CLAUDE.md                     # Claude Code instructions
```

## Naming Conventions

### Files and Directories

| Type | Convention | Example |
|------|------------|---------|
| React components | PascalCase.tsx | `ChatView.tsx`, `ToolCallCard.tsx` |
| Hooks | camelCase with use prefix | `useSession.ts`, `useAgent.ts` |
| Stores | camelCase with Store suffix | `sessionStore.ts` |
| Rust modules | snake_case | `agent.rs`, `session.rs` |
| Rust types | PascalCase | `AgentManager`, `SessionState` |
| TypeScript types | PascalCase | `ContentBlock`, `PermissionRequest` |
| CSS/Tailwind | kebab-case for custom classes | `chat-message`, `tool-card` |

### Code Patterns

**React Components**
```tsx
// Functional component with props interface
interface ChatViewProps {
  sessionId: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
  // Hooks at top
  const messages = useSessionStore((s) => s.sessions.get(sessionId)?.messages);

  // Event handlers
  const handleSubmit = () => { /* ... */ };

  // Render
  return <div>...</div>;
}
```

**Zustand Store**
```typescript
interface SessionStore {
  // State
  sessions: Map<string, SessionState>;
  activeSessionId: string | null;

  // Actions
  createSession: (params: NewSessionParams) => Promise<string>;
  appendMessage: (sessionId: string, content: ContentBlock) => void;
}

export const useSessionStore = create<SessionStore>()(
  immer((set, get) => ({
    // Implementation
  }))
);
```

**Rust Tauri Command**
```rust
#[command]
pub async fn session_prompt(
    state: State<'_, SharedState>,
    window: Window,
    session_id: String,
    content: Vec<ContentBlock>,
) -> Result<(), String> {
    // Implementation
}
```

## Import Patterns

### Frontend (TypeScript)

```typescript
// External dependencies first
import { useState, useEffect } from 'react';
import { create } from 'zustand';

// Internal absolute imports (configured in tsconfig)
import { useSessionStore } from '@/stores/sessionStore';
import { ChatInput } from '@/components/chat/ChatInput';
import type { ContentBlock } from '@/types/acp';

// Relative imports last (same directory)
import { MessageItem } from './MessageItem';
```

### Backend (Rust)

```rust
// Standard library
use std::collections::HashMap;
use std::sync::Arc;

// External crates
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

// Internal modules
use crate::core::AgentManager;
use crate::acp::types::ContentBlock;
```

## Architectural Layers

### Frontend Data Flow

```
User Action
    ↓
React Component (UI event)
    ↓
Zustand Store (state update + async action)
    ↓
Service Layer (api.ts)
    ↓
Transport (tauri.ts or websocket.ts)
    ↓
Backend
```

### Backend Data Flow

```
Frontend Request (IPC or WebSocket)
    ↓
Transport Layer (commands/ or server/)
    ↓
Core Services (core/)
    ↓
ACP Client (acp/)
    ↓
Agent Process (stdio)
```

## State Management Stores

| Store | Responsibility |
|-------|---------------|
| `sessionStore` | Sessions, messages, tool calls, plan, streaming state |
| `agentStore` | Agent configurations, active agent, connection status |
| `fileStore` | Working directory, file tree, open files |
| `permissionStore` | Permission rules, pending requests, history |

## Key Interfaces

### Transport Interface

```typescript
interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: JsonRpcRequest): Promise<JsonRpcResponse>;
  onMessage(callback: (message: JsonRpcMessage) => void): () => void;
}
```

### Shared Application State (Rust)

```rust
pub struct AppState {
    pub agent_manager: AgentManager,
    pub session_manager: SessionManager,
    pub config: AppConfig,
}

pub type SharedState = Arc<RwLock<AppState>>;
```

## Configuration Files

| File | Purpose |
|------|---------|
| `tauri.conf.json` | Tauri app configuration (window, permissions, plugins) |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS customization |
| `components.json` | shadcn/ui component settings |
| `tsconfig.json` | TypeScript compiler options |
| `Cargo.toml` | Rust dependencies and features |

## ACP Protocol Types

### Core Types

```typescript
// Protocol version
export const PROTOCOL_VERSION = 1;

// Session types
export interface Session {
  id: string;
  workingDirectory: string;
  createdAt: Date;
  status: 'active' | 'idle' | 'disconnected';
}

// Content blocks
export type ContentBlock =
  | TextContent
  | ImageContent
  | ResourceLink
  | Resource;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data?: string;      // base64
  mimeType?: string;
  uri?: string;       // URL
}

export interface ResourceLink {
  type: 'resource_link';
  uri: string;
  mimeType?: string;
}

export interface Resource {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}
```

### Session Updates

```typescript
export type SessionUpdate =
  | AgentMessageChunk
  | UserMessageChunk
  | AgentThoughtChunk
  | ToolCall
  | ToolCallUpdate
  | PlanUpdate
  | AvailableCommandsUpdate
  | CurrentModeUpdate;

export interface AgentMessageChunk {
  sessionUpdate: 'agent_message_chunk';
  content: ContentBlock;
}

export interface ToolCall {
  sessionUpdate: 'tool_call';
  toolCallId: string;
  title: string;
  kind: ToolKind;
  status: ToolStatus;
  rawInput?: unknown;
  content?: ToolCallContent[];
  locations?: ToolCallLocation[];
}

export type ToolKind = 'read' | 'edit' | 'execute' | 'search' | 'fetch' | 'think' | 'switch_mode' | 'other';
export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
```

### Permission Types

```typescript
export interface PermissionRequest {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    title: string;
    rawInput?: unknown;
  };
  options: PermissionOption[];
}

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once';
}

export interface PermissionResponse {
  outcome: {
    outcome: 'selected' | 'cancelled';
    optionId?: string;
  };
}
```

### ACP Client Interface

```typescript
export interface ACPClient {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Agent management
  initialize(config: AgentConfig): Promise<InitializeResponse>;
  authenticate(methodId: string): Promise<void>;

  // Session management
  createSession(params: NewSessionParams): Promise<Session>;
  loadSession(sessionId: string): Promise<Session>;
  forkSession(sessionId: string, params: ForkSessionParams): Promise<Session>;

  // Chat
  sendPrompt(sessionId: string, content: ContentBlock[]): Promise<PromptResponse>;
  cancelPrompt(sessionId: string): Promise<void>;
  setMode(sessionId: string, modeId: string): Promise<void>;

  // Event handlers
  onSessionUpdate(callback: (sessionId: string, update: SessionUpdate) => void): () => void;
  onPermissionRequest(callback: (request: PermissionRequest) => Promise<PermissionResponse>): () => void;
  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void;

  // File operations (client capabilities)
  readFile(sessionId: string, path: string, options?: ReadFileOptions): Promise<string>;
  writeFile(sessionId: string, path: string, content: string): Promise<void>;

  // Terminal operations (client capabilities)
  createTerminal(sessionId: string, params: CreateTerminalParams): Promise<TerminalHandle>;
}
```

## Component Code Examples

### Layout Component

```tsx
// src/components/layout/MainLayout.tsx
export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return <MobileLayout />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={60} minSize={30}>
          <ChatPanel />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={40} minSize={20}>
          <EditorPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
      <TerminalDrawer />
      <PermissionDialog />
    </div>
  );
}
```

### Chat View Component

```tsx
// src/components/chat/ChatView.tsx
export function ChatView({ sessionId }: { sessionId: string }) {
  const messages = useSessionStore((s) => s.sessions.get(sessionId)?.messages ?? []);
  const toolCalls = useSessionStore((s) => s.sessions.get(sessionId)?.toolCalls);
  const plan = useSessionStore((s) => s.sessions.get(sessionId)?.plan);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolCalls]);

  return (
    <div className="flex flex-col h-full">
      {plan && plan.length > 0 && <PlanView entries={plan} />}
      <ScrollArea className="flex-1 p-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        {toolCalls && Array.from(toolCalls.values()).map((toolCall) => (
          <ToolCallCard key={toolCall.id} toolCall={toolCall} />
        ))}
        <div ref={scrollRef} />
      </ScrollArea>
      <ChatInput sessionId={sessionId} />
    </div>
  );
}
```

### Permission Dialog Component

```tsx
// src/components/common/PermissionDialog.tsx
export function PermissionDialog() {
  const pendingPermissions = usePermissionStore((s) => s.pendingPermissions);
  const respondToPermission = usePermissionStore((s) => s.respondToPermission);
  const currentPermission = pendingPermissions[0];

  if (!currentPermission) return null;

  const { request } = currentPermission;

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permission Required</DialogTitle>
          <DialogDescription>{request.toolCall.title}</DialogDescription>
        </DialogHeader>
        {request.toolCall.rawInput && (
          <div className="bg-muted p-3 rounded-md">
            <pre className="text-sm overflow-auto max-h-40">
              {JSON.stringify(request.toolCall.rawInput, null, 2)}
            </pre>
          </div>
        )}
        <DialogFooter className="flex gap-2">
          {request.options.map((option) => (
            <Button
              key={option.optionId}
              variant={option.kind === 'reject_once' ? 'destructive' : 'default'}
              onClick={() => respondToPermission(currentPermission.id, {
                outcome: { outcome: 'selected', optionId: option.optionId }
              })}
            >
              {option.name}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Rust Backend Code Examples

### Application State

```rust
// src-tauri/src/state.rs
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::core::{AgentManager, SessionManager};

pub struct AppState {
    pub agent_manager: AgentManager,
    pub session_manager: SessionManager,
    pub config: AppConfig,
}

impl AppState {
    pub fn new(config: AppConfig) -> Self {
        Self {
            agent_manager: AgentManager::new(),
            session_manager: SessionManager::new(),
            config,
        }
    }
}

pub type SharedState = Arc<RwLock<AppState>>;
```

### Agent Manager

```rust
// src-tauri/src/core/agent.rs
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

pub struct AgentManager {
    agents: HashMap<String, AgentProcess>,
}

struct AgentProcess {
    process: Child,
    stdin_tx: mpsc::Sender<String>,
    stdout_rx: mpsc::Receiver<String>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self { agents: HashMap::new() }
    }

    pub async fn spawn_agent(&mut self, config: AgentConfig) -> Result<String, AgentError> {
        let agent_id = uuid::Uuid::new_v4().to_string();

        let mut process = Command::new(&config.command)
            .args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let stdin = process.stdin.take().unwrap();
        let stdout = process.stdout.take().unwrap();

        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(32);
        let (stdout_tx, stdout_rx) = mpsc::channel::<String>(32);

        // Spawn stdin writer task
        tokio::spawn(async move {
            let mut stdin = stdin;
            while let Some(msg) = stdin_rx.recv().await {
                if stdin.write_all(msg.as_bytes()).await.is_err() { break; }
                let _ = stdin.flush().await;
            }
        });

        // Spawn stdout reader task
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if stdout_tx.send(line).await.is_err() { break; }
            }
        });

        self.agents.insert(agent_id.clone(), AgentProcess { process, stdin_tx, stdout_rx });
        Ok(agent_id)
    }

    pub async fn send(&self, agent_id: &str, message: &str) -> Result<(), AgentError> {
        let agent = self.agents.get(agent_id).ok_or(AgentError::NotFound)?;
        agent.stdin_tx.send(format!("{}\n", message)).await?;
        Ok(())
    }
}
```

### WebSocket Server

```rust
// src-tauri/src/server/ws.rs
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{sink::SinkExt, stream::StreamExt};
use crate::state::SharedState;

pub async fn start_ws_server(state: SharedState, addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("WebSocket server listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<SharedState>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: SharedState) {
    let (mut sender, mut receiver) = socket.split();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<JsonRpcRequest>(&text) {
                Ok(request) => {
                    let response = handle_jsonrpc_request(request, state.clone()).await;
                    let response_text = serde_json::to_string(&response).unwrap();
                    if sender.send(Message::Text(response_text)).await.is_err() { break; }
                }
                Err(e) => {
                    let error = JsonRpcError { code: -32700, message: format!("Parse error: {}", e) };
                    let _ = sender.send(Message::Text(serde_json::to_string(&error).unwrap())).await;
                }
            }
        }
    }
}
```

## Data Flow Diagrams

### Message Flow (Chat)

```
User Input
    │
    ▼
[ChatInput Component]
    │
    ▼
useSessionStore.sendPrompt()
    │
    ▼
ACPClient.sendPrompt()
    │
    ▼
Transport.send()
    │
    ├─────────────────────┬─────────────────────┐
    │                     │                     │
    ▼                     ▼                     │
[Tauri IPC]        [WebSocket]                 │
    │                     │                     │
    └──────────┬──────────┘                     │
               │                                │
               ▼                                │
    [Unified Rust Backend]                      │
               │                                │
               ▼                                │
    [Core Services]                             │
               │                                │
               ▼                                │
    [AI Agent Process]                          │
               │                                │
        ┌──────┴──────┐                         │
        │             │                         │
        ▼             ▼                         │
   session/     session/prompt                  │
   update       response                        │
        │             │                         │
        └──────┬──────┘                         │
               │                                │
               ▼                                │
    [Rust Backend routes response]              │
               │                                │
    ├──────────┴──────────┤                     │
    │                     │                     │
    ▼                     ▼                     │
[Tauri Event]      [WebSocket msg]             │
    │                     │                     │
    └──────────┬──────────┘                     │
               │                                │
               ▼                                │
    Transport.onMessage()                       │
               │                                │
               ▼                                │
    ACPClient event handlers ◄──────────────────┘
               │
               ▼
    useSessionStore.appendMessageChunk()
               │
               ▼
    [React Re-render]
               │
               ▼
    [ChatView Updates]
```

### Permission Flow

```
Agent requests permission
    │
    ▼
ACPClient.onPermissionRequest callback
    │
    ▼
usePermissionStore.enqueuePendingPermission()
    │
    ▼
[PermissionDialog renders]
    │
    ▼
User clicks option
    │
    ▼
usePermissionStore.respondToPermission()
    │
    ▼
Promise resolves with response
    │
    ▼
ACPClient returns response to agent
```
