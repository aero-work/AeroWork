# Aero Work - Technology Stack

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Aero Work                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Frontend (React/TS)                    │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │  │
│  │  │  Chat   │ │  Files  │ │Terminal │ │    Settings     │ │  │
│  │  │  View   │ │ Manager │ │  Panel  │ │     Panel       │ │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘ │  │
│  │       │           │           │               │          │  │
│  │  ┌────┴───────────┴───────────┴───────────────┴────────┐ │  │
│  │  │              State Management (Zustand)              │ │  │
│  │  └─────────────────────────┬───────────────────────────┘ │  │
│  │                            │                              │  │
│  │  ┌─────────────────────────┴───────────────────────────┐ │  │
│  │  │              Service Layer                          │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │ │  │
│  │  │  │ACP Svc  │ │File Svc │ │Term Svc │ │Config Svc │ │ │  │
│  │  │  └────┬────┘ └────┬────┘ └────┬────┘ └─────┬─────┘ │ │  │
│  │  └───────┼───────────┼───────────┼────────────┼───────┘ │  │
│  └──────────┼───────────┼───────────┼────────────┼─────────┘  │
│             │           │           │            │            │
│  ┌──────────┴───────────┴───────────┴────────────┴─────────┐  │
│  │              Transport Abstraction Layer                 │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │  │
│  │  │   Tauri IPC Bridge  │  │   WebSocket Transport   │   │  │
│  │  │  (Desktop Mode)     │  │   (Web Mode)            │   │  │
│  │  └──────────┬──────────┘  └───────────┬─────────────┘   │  │
│  └─────────────┼─────────────────────────┼─────────────────┘  │
│                │                         │                    │
├────────────────┴─────────────────────────┴────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Unified Rust Backend                         │ │
│  │                                                           │ │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │ │
│  │  │   Tauri Commands    │  │   WebSocket Server      │   │ │
│  │  │   (IPC Handler)     │  │   (axum/tungstenite)    │   │ │
│  │  └──────────┬──────────┘  └───────────┬─────────────┘   │ │
│  │             │                         │                  │ │
│  │  ┌──────────┴─────────────────────────┴───────────────┐ │ │
│  │  │              Core Services (Shared)                 │ │ │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │ │ │
│  │  │  │   Agent     │ │    ACP      │ │   Session    │  │ │ │
│  │  │  │   Manager   │ │   Protocol  │ │   Manager    │  │ │ │
│  │  │  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘  │ │ │
│  │  └─────────┼───────────────┼───────────────┼──────────┘ │ │
│  │            │               │               │            │ │
│  │  ┌─────────┴───────────────┴───────────────┴──────────┐ │ │
│  │  │              Terminal Manager (PTY)                 │ │ │
│  │  └─────────────────────────┬───────────────────────────┘ │ │
│  └────────────────────────────┼─────────────────────────────┘ │
│                               │                               │
└───────────────────────────────┼───────────────────────────────┘
                                │
               ┌────────────────┴────────────────┐
               │       AI Agent Process          │
               │    (Claude Code, Aider, etc.)   │
               │         stdin/stdout            │
               └─────────────────────────────────┘
```

## Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18+ | UI framework |
| TypeScript | 5+ | Type safety |
| Tailwind CSS | 4+ | Utility-first styling (with oklch colors) |
| shadcn/ui | latest | Component library (Radix UI based, Slate theme) |
| Zustand | 4+ | State management with immer middleware |
| xterm.js | 5+ | Terminal emulator |
| Monaco Editor | latest | Code editing with syntax highlighting |
| react-resizable-panels | 4+ | Resizable panel layout |
| Vite | 5+ | Build tool and dev server |

### Frontend Patterns

- **State Management**: Zustand stores with immer for immutable updates
  - **Important**: `enableMapSet()` from immer must be called in `main.tsx` for Set/Map support
- **Component Structure**: Functional components with hooks
- **Styling**: Tailwind CSS with shadcn/ui components (responsive design supports 360px minimum width)
- **Transport Abstraction**: Factory pattern for Tauri IPC / WebSocket switching

## Backend Stack (Tauri/Rust)

| Technology | Version | Purpose |
|------------|---------|---------|
| Tauri | 2.0 | Desktop application framework |
| Rust | 1.70+ | Backend language |
| Axum | 0.7 | HTTP/WebSocket server |
| tokio | 1.0 | Async runtime |
| serde | 1.0 | JSON serialization |
| serde_json | 1.0 | JSON parsing |
| uuid | 1.0 | UUID generation |
| tracing | 0.1 | Logging and diagnostics |
| portable-pty | 0.8 | Cross-platform PTY support |
| futures | 0.3 | Async stream utilities |

### Rust Cargo Features

```toml
[features]
default = ["websocket"]
websocket = []  # Enable WebSocket server for web mode
```

## Development Tools

| Tool | Purpose |
|------|---------|
| bun | Package manager and runtime |
| ESLint | JavaScript/TypeScript linting |
| Prettier | Code formatting |
| Clippy | Rust linting |
| Vitest | Frontend unit testing |
| cargo test | Backend unit testing |

### Running the App

```bash
# Install dependencies
bun install

# Development mode
bun run tauri dev

# Production build
bun run tauri build
```

## Protocol: Agent Client Protocol (ACP)

Communication between Aero Work and AI agents uses the **Agent Client Protocol**:

- **Transport**: JSON-RPC 2.0 over stdio (agent subprocess)
- **Protocol Version**: 1
- **Reference**: https://agentclientprotocol.com/

### Key ACP Concepts

| Concept | Description |
|---------|-------------|
| Session | A conversation context with working directory |
| ContentBlock | Text, image, resource, or resource_link |
| SessionUpdate | Streaming updates (message chunks, tool calls, plan updates) |
| ToolCall | Agent tool execution with status tracking |
| Permission | Client-side approval for sensitive operations |

## Deployment Modes

### Desktop Mode
- Frontend runs in Tauri WebView
- Communication via Tauri IPC (`invoke()` / `listen()`)
- Direct file system and terminal access
- Agent processes spawned locally via stdio

### Web Mode
- Frontend served as static files or accessed remotely
- Communication via WebSocket (Axum server embedded in Tauri backend)
- Same Rust backend handles all operations
- Optional JWT authentication
- Can run headless (no WebView window)

## Cargo Dependencies

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"

# WebSocket server
axum = { version = "0.7", features = ["ws"] }
futures = "0.3"
tower = "0.4"

# PTY support
portable-pty = "0.8"
```

## NPM Dependencies (Frontend)

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "zustand": "^4.0.0",
    "@tauri-apps/api": "^2.0.0",
    "xterm": "^5.0.0",
    "xterm-addon-fit": "^0.8.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^3.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Technical Constraints

### Performance Requirements
- Message streaming with < 50ms latency perception
- Virtualized lists for 1000+ messages
- Terminal output buffering (batch updates)

### Security Requirements
- Path validation to prevent directory traversal
- All external commands require permission
- HTTPS required for web mode in production
- JWT token expiration and refresh

### Compatibility
- macOS 10.15+, Windows 10+, Ubuntu 20.04+
- Android 7.0+ (API 24+) - WebView-only client
- Modern browsers (Chrome 90+, Firefox 90+, Safari 14+)
- Node.js 18+ for agent processes

## Android Architecture

### Overview
Android app is a **WebView-only client** - it contains no Rust backend and connects to a desktop server via WebSocket.

### Build Configuration
```bash
# After tauri android init, run post-init script
./scripts/android-post-init.sh
```

The script configures:
1. **Cleartext Traffic**: `network_security_config.xml` allows `ws://` connections
2. **Keyboard Handling**: `windowSoftInputMode="adjustResize"`
3. **Release Signing**: Uses environment variables or falls back to debug keystore

### Signing Configuration
```kotlin
// Release signing in build.gradle.kts
signingConfigs {
    create("release") {
        // If ANDROID_KEYSTORE_PATH is set, use release keystore
        // Otherwise, fallback to ~/.android/debug.keystore
    }
}
```

Environment variables:
- `ANDROID_KEYSTORE_PATH` - Path to release keystore
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias (default: aerowork)
- `ANDROID_KEY_PASSWORD` - Key password

### Conditional Compilation
Desktop-only features use conditional compilation:
```rust
#[cfg(not(target_os = "android"))]
mod agent;  // Agent spawning only on desktop

#[cfg(not(target_os = "android"))]
mod terminal;  // PTY only on desktop
```

### First Launch Behavior
1. Show WebSocket setup dialog (required on mobile)
2. User enters desktop server URL (e.g., `ws://192.168.1.100:9527/ws`)
3. Can scan QR code from desktop app for easy setup

## State Management (Zustand)

### Store Interfaces

```typescript
// Session Store - manages chat sessions
interface SessionStore {
  sessions: Map<string, SessionState>;
  activeSessionId: string | null;
  createSession: (workDir: string) => Promise<string>;
  sendPrompt: (sessionId: string, content: ContentBlock[]) => Promise<void>;
  cancelPrompt: (sessionId: string) => Promise<void>;
}

// Agent Store - manages agent connections
interface AgentStore {
  agents: AgentConfig[];
  activeAgentId: string | null;
  connectionStatus: ConnectionStatus;
  connect: (agentId: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

// File Store - manages file browser state
interface FileStore {
  workingDirectory: string;
  fileTree: FileNode[];
  openFiles: OpenFile[];
  setWorkingDirectory: (path: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
}

// Settings Store - manages app settings with persistence
interface SettingsStore {
  mcpServers: MCPServer[];
  models: ModelConfig[];
  permissionRules: PermissionRule[];
  generalSettings: GeneralSettings;
  addMCPServer: (server: MCPServer) => void;
  addPermissionRule: (rule: PermissionRule) => void;
}
```

## Performance Optimizations

### Message Streaming
- Use `requestAnimationFrame` for batching DOM updates
- Virtualize long message lists with `react-window`
- Debounce rapid state updates

### File Operations
- Lazy-load file contents
- Cache recently viewed files
- Use web workers for large file parsing

### Terminal
- Buffer terminal output and batch updates
- Use canvas-based rendering (xterm.js default)
- Limit scrollback buffer size

## Model Provider Configuration

The model provider system allows users to configure different AI providers with their credentials.

### Config File
- **Location**: `~/.config/aerowork/models.json`

### Supported Providers
| Provider | Environment Variables |
|----------|----------------------|
| Default | None (uses system env) |
| Anthropic | `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL` |
| Bedrock | `CLAUDE_CODE_USE_BEDROCK`, `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION`, `ANTHROPIC_MODEL` |
| BigModel | `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` |
| MiniMax | `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_AUTH_TOKEN` |
| Moonshot | `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_AUTH_TOKEN` |
| Custom | User-defined: `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` |

### Environment Variable Flow
```
User configures provider in UI
    ↓
ModelSettings.tsx saves to backend
    ↓
model_config.rs saves to ~/.config/aerowork/models.json
    ↓
On agent connect, websocket.rs calls ModelConfig::load()
    ↓
ModelConfig::get_env_vars() generates HashMap<String, String>
    ↓
AcpClient::connect() receives env_vars parameter
    ↓
Command::env() sets vars on child process
    ↓
Agent process receives environment variables
```

## MCP Configuration Architecture

The MCP server configuration uses a dual-config approach:

### Config Files
- **Aerowork Config** (`~/.config/aerowork/mcp.json`): Stores all MCP servers with enable/disable state
- **Claude Config** (`~/.claude.json`): Contains only enabled servers (synced from Aerowork config)

### Aerowork Config Format
```json
{
  "mcpServers": {
    "web-search": {
      "enabled": true,
      "config": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@anthropic-ai/mcp-server-tavily"],
        "env": { "TAVILY_API_KEY": "..." }
      }
    }
  }
}
```

### Bootstrap Behavior
- On first load, if `~/.config/aerowork/mcp.json` doesn't exist:
  1. Read `~/.claude.json` to import existing servers
  2. Convert all servers to Aerowork format with `enabled: true`
  3. Save new Aerowork config
- If both files don't exist, create empty Aerowork config

### Sync Behavior
- When a server is toggled enabled/disabled, both configs are updated
- Only enabled servers are written to `~/.claude.json`
- Disabled servers are preserved in Aerowork config but removed from Claude config

## Error Handling

### Connection Errors
- Auto-reconnect with exponential backoff
- Queue messages during disconnection
- Show connection status indicator

### Agent Errors
- Display error messages in chat
- Allow retry for failed operations
- Log errors for debugging

### Permission Errors
- Handle cancelled permissions gracefully
- Show reason for denied permissions
- Allow editing permission rules
