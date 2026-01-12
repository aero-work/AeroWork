# Aero Code - Product Overview

## Vision

Build a unified interface for AI-powered code development that works seamlessly across desktop and web, supporting multiple AI agents with fine-grained permission control. A single Rust backend ensures consistent behavior and reduces maintenance overhead.

## Target Users

- Developers who want to use AI agents for coding assistance
- Teams that need remote access to AI coding capabilities
- Users who prefer visual interfaces over CLI tools

## Key Differentiators

| Feature | Description |
|---------|-------------|
| **Unified Backend** | Single Rust codebase serves both desktop and web modes |
| **Multi-Agent** | Support for multiple AI agents (Claude Code, custom agents) |
| **Fine-grained Permissions** | Tool-level permission control |
| **Cross-platform** | Desktop app + remote web access |

## Core Features

### Agent Integration
- **Multi-Agent Support**: Connect to different AI agents (Claude Code, custom agents)
- **ACP Protocol**: Use Agent Client Protocol for standardized communication
- **Agent Switching**: Switch between agents within the same session
- **Agent Configuration**: Configure agent-specific settings
- **Local & Remote Agents**: Support both local agent processes and remote agent connections

### Chat Interface
- **Streaming Responses**: Real-time message streaming from agents
- **Rich Content**: Support for text, code, images, and file references
- **Tool Call Visualization**: Display agent tool calls with status and results
- **Plan Display**: Show agent's execution plan with progress tracking
- **Thought Process**: Optionally display agent's thinking/reasoning
- **Markdown Rendering**: Proper rendering of markdown content with syntax highlighting

### Permission Control
- **Tool-Level Permissions**: Configure permissions per tool type
  - File read/write operations
  - Terminal command execution
  - Web fetch operations
- **Permission Modes**:
  - `default`: Prompt for dangerous operations
  - `acceptEdits`: Auto-accept file edits
  - `plan`: Planning mode, no execution
  - `dontAsk`: Don't prompt, deny if not pre-approved
  - `bypassPermissions`: Trust all operations (non-root only)
- **Permission Rules**: Configurable rules with glob patterns
- **Permission History**: Track and review permission decisions

### Session Management
- **Multiple Sessions**: Create and manage multiple conversation sessions
- **Session Persistence**: Save and restore sessions
- **Session Fork**: Branch from existing sessions
- **Session Resume**: Continue previous sessions
- **Session Export**: Export conversation history

### File Management
- **Project Switching**: Switch between different working directories
- **File Browser**: Navigate project file structure with tree view
- **File Preview**: View file contents with syntax highlighting
- **File Editor**: Basic editing with diff view for agent changes
- **Workspace Scope**: Files scoped to current project, with ability to navigate elsewhere

### Terminal Integration
- **Virtual Terminal**: Embedded xterm.js terminal with full PTY support
- **Agent Terminal View**: Display agent command executions with output
- **Interactive Shell**: User can interact with shell directly
- **Multiple Terminals**: Support multiple terminal instances/tabs
- **Terminal History**: Command history and output logging

### Settings
- **Agent Settings**: Configure connected agents (command, args, environment)
- **Permission Settings**: Default permission rules and patterns
- **UI Settings**: Theme (light/dark), layout preferences, font settings
- **Workspace Settings**: Project-specific configurations
- **Server Settings**: Web server port, authentication settings

## UI/UX Design

### Desktop Layout (VSCode-like)
```
+------------------+----------------------------------+
|   Sidebar        |   Main Content Area              |
|   (resizable)    |   (flexible)                     |
|                  |                                  |
| [Sessions]       | ┌──────────────────────────────┐ |
|  > Session 1     | │  Chat View                   │ |
|    Session 2     | │  ┌────────────────────────┐  │ |
|                  | │  │ Messages               │  │ |
| [Files]          | │  │ - User message         │  │ |
|  > project/      | │  │ - Agent response       │  │ |
|    > src/        | │  │ - [Tool Call Card]     │  │ |
|    > docs/       | │  │ - Agent response       │  │ |
|                  | │  └────────────────────────┘  │ |
| [Agents]         | │  ┌────────────────────────┐  │ |
|  * Claude Code   | │  │ Input Area         [>] │  │ |
|                  | │  └────────────────────────┘  │ |
| [Settings]       | └──────────────────────────────┘ |
|                  | ┌──────────────────────────────┐ |
|                  | │  Terminal (collapsible)      │ |
|                  | │  $ npm run dev               │ |
|                  | └──────────────────────────────┘ |
+------------------+----------------------------------+
|                    Status Bar                       |
| Connected: Claude Code | ~/project | 3 sessions    |
+-----------------------------------------------------+
```

### Mobile Layout
```
+---------------------------+
|  [=] Aero Code    [...]   |  <- Header with hamburger menu
+---------------------------+
|                           |
|   Chat Messages           |
|                           |
|   ┌─────────────────────┐ |
|   │ Agent Response      │ |
|   │ with markdown       │ |
|   └─────────────────────┘ |
|                           |
|   ┌─────────────────────┐ |
|   │ Tool Call Card      │ |
|   │ [Expand/Collapse]   │ |
|   └─────────────────────┘ |
|                           |
+---------------------------+
|  [Message Input]    [>]   |  <- Input area with send button
+---------------------------+
|  [Chat] [Files] [Term]    |  <- Bottom navigation tabs
+---------------------------+
```

### Key UI Components

1. **Permission Dialog**: Modal overlay for permission requests with Allow Once/Always Allow/Deny options
2. **Tool Call Card**: Collapsible card showing tool execution status, input, and output
3. **Diff Viewer**: Side-by-side or unified diff view with accept/reject controls
4. **Terminal Panel**: xterm.js based terminal with multiple tabs support
5. **File Tree**: Expandable/collapsible directories with search/filter

## Security Considerations

### File System Access
- Default to workspace directory restrictions
- Validate all paths to prevent traversal attacks (../)
- Require explicit permission for sensitive files (.env, credentials, keys)

### Command Execution
- All commands require permission by default
- Configurable command allowlist/blocklist
- Timeout for long-running commands

### Web Mode Security
- HTTPS required for production
- Authentication via JWT or session tokens
- Rate limiting and CORS configuration

### Data Privacy
- No telemetry without explicit consent
- Session data stored locally by default
- No external API calls except to configured agents

## Development Phases

### Phase 1: Core Infrastructure (MVP) ✅
- [x] Design PRD and Architecture
- [x] Project setup (Tauri 2.0 + Vite + React + TypeScript + Tailwind + shadcn)
- [x] Rust backend core structure
- [x] ACP client implementation in Rust
- [x] Basic Tauri IPC commands
- [x] Transport abstraction layer (frontend)
- [x] Basic chat interface with streaming messages
- [x] Permission dialog with tool authorization
- [x] Claude Code agent connection (stdio)
- [x] VSCode-like UI with resizable sidebar
- [x] Session management (create, switch, delete)
- [x] Project/directory management with persistence
- [x] Tool Call Cards with expand/collapse

### Phase 2: File & Terminal (In Progress)
- [x] File browser component (FileTree)
- [x] Code viewer with syntax highlighting (Monaco Editor)
- [x] File operations (create, delete, rename via context menu)
- [ ] Terminal integration (xterm.js + PTY)
- [ ] Diff viewer for file changes

### Phase 3: Session Management
- [ ] Multiple sessions support
- [ ] Session persistence (save/restore)
- [ ] Session fork and resume

### Phase 4: Web Server Mode
- [ ] Axum HTTP server embedded in Tauri
- [ ] WebSocket transport implementation
- [ ] Authentication system (JWT)
- [ ] Headless mode (no window)

### Phase 5: Multi-Agent & Polish
- [ ] Multiple agent configuration
- [ ] Agent switching UI
- [ ] Mobile responsive design
- [ ] Theme support (light/dark)

### Phase 6: Advanced Features
- [ ] Remote agent connections
- [ ] MCP server integration
- [ ] Plugin system

## Configuration Examples

### Agent Configuration
```json
{
  "agents": [
    {
      "id": "claude-code",
      "name": "Claude Code",
      "type": "stdio",
      "command": "npx",
      "args": ["@anthropic-ai/claude-code-acp"],
      "env": {}
    }
  ]
}
```

### Permission Rules
```json
{
  "permissionRules": [
    { "tool": "Read", "pathPattern": "**/*.md", "decision": "allow" },
    { "tool": "Write", "pathPattern": "**/.env*", "decision": "deny" },
    { "tool": "Bash", "commandPattern": "npm *", "decision": "ask" }
  ]
}
```

### Server Configuration (Web Mode)
```json
{
  "server": {
    "enabled": true,
    "port": 8080,
    "host": "0.0.0.0",
    "auth": {
      "enabled": true,
      "type": "jwt",
      "secret": "${JWT_SECRET}"
    },
    "cors": {
      "origins": ["https://example.com"]
    }
  }
}
```

## Communication Protocols

### Desktop Mode (Tauri IPC)

```typescript
// Frontend -> Backend (invoke)
await invoke('agent_initialize', { config });
await invoke('agent_list', {});
await invoke('session_create', { agentId, workDir });
await invoke('session_prompt', { sessionId, content });
await invoke('session_cancel', { sessionId });
await invoke('session_set_mode', { sessionId, modeId });
await invoke('file_read', { path });
await invoke('file_write', { path, content });
await invoke('file_list', { path });
await invoke('terminal_create', { sessionId, workDir });
await invoke('terminal_input', { terminalId, data });
await invoke('terminal_resize', { terminalId, cols, rows });
await invoke('terminal_kill', { terminalId });

// Backend -> Frontend (events)
listen('session:update', (event) => { /* handle session update */ });
listen('session:permission_request', (event) => { /* show permission dialog */ });
listen('terminal:output', (event) => { /* update terminal */ });
listen('agent:status', (event) => { /* update connection status */ });
```

### Web Mode (WebSocket)

```typescript
// WebSocket message format
interface WSMessage {
  id: string;          // Request ID for correlation
  type: string;        // Message type
  payload: unknown;    // Message payload
}

// Connect to backend
const ws = new WebSocket('wss://server:port/ws');

// Send request
ws.send(JSON.stringify({
  id: 'req_123',
  type: 'session/prompt',
  payload: { sessionId, content }
}));

// Receive messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'session/update':
      handleSessionUpdate(msg.payload);
      break;
    case 'permission/request':
      handlePermissionRequest(msg.id, msg.payload);
      break;
    case 'terminal/output':
      handleTerminalOutput(msg.payload);
      break;
    case 'response':
      resolveRequest(msg.id, msg.payload);
      break;
    case 'error':
      rejectRequest(msg.id, msg.payload);
      break;
  }
};
```

### ACP Protocol (Backend to Agent)

The Rust backend implements the ACP Client role:
- Spawn agent processes (stdio transport)
- Send JSON-RPC requests to agents
- Handle agent notifications
- Implement client capabilities (fs, terminal)
