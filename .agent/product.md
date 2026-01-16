# Aero Work - Product Overview

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
- **Multi-Type File Preview**:
  - Text files: Syntax highlighting (Monaco for desktop, Prism for mobile)
  - Images (PNG, JPG, GIF, SVG, WebP, etc.): Inline preview with download
  - PDF: Embedded PDF viewer
  - Binary/Unknown: File metadata display with "Force Edit" option
- **File Editor**: Basic editing with diff view for agent changes
- **File Upload**: Upload files directly to current working directory
- **Workspace Scope**: Files scoped to current project, with ability to navigate elsewhere

### Terminal Integration
- **Virtual Terminal**: Embedded xterm.js terminal with full PTY support
- **Agent Terminal View**: Display agent command executions with output
- **Interactive Shell**: User can interact with shell directly
- **Multiple Terminals**: Support multiple terminal instances/tabs
- **Terminal History**: Command history and output logging

### Settings
- **Agent Settings**: Configure connected agents (command, args, environment)
- **Model Provider Settings**: Configure AI model provider (Anthropic, Bedrock, BigModel, MiniMax, Moonshot, Custom)
- **Permission Settings**: Default permission rules and patterns
- **UI Settings**: Theme (light/dark), layout preferences, font settings, language selection
- **Workspace Settings**: Project-specific configurations
- **Server Settings**: Web server port, authentication settings

### Model Provider Configuration
- **Provider Selection**: Choose from built-in providers or create custom providers
- **Built-in Providers**:
  - Default: Uses system environment variables
  - Anthropic: Direct API with model selection (Opus/Sonnet/Haiku)
  - Amazon Bedrock: AWS integration with region selection
  - BigModel/Zhipu: Chinese AI provider
  - MiniMax: Chinese AI provider with model selection
  - Moonshot AI/Kimi: Chinese AI provider with model selection
- **Custom Providers**: Configure any Anthropic-compatible API endpoint
- **Environment Variables**: Automatically passed to agent process at startup
- **Config Persistence**: Stored in `~/.config/aerowork/models.json`

### Internationalization (i18n)
- **Multi-language Support**: UI elements support different languages (English, Chinese)
- **Common Terms in English**: Technical terms like "Terminal", "Session", "Agent" remain in English
- **System Language Detection**: Default to system language, fallback to English
- **Language Setting**: Configurable in General settings
- **Easy Extension**: Adding a new language = translating a single JSON file

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

### Mobile Layout (WeChat/WhatsApp Style)

The mobile UI follows a WeChat/WhatsApp-style navigation pattern with bottom tabs and slide-in conversation views.

```
Main Structure:
┌────────────────────────────────────┐
│           Header Area              │  <- Context-dependent header
├────────────────────────────────────┤
│                                    │
│         Content Area               │  <- Tab content or conversation
│                                    │
├────────────────────────────────────┤
│  [Chat] [Files] [Terminal] [⚙️]   │  <- Bottom tab bar
└────────────────────────────────────┘

Chat Tab (Session List):
┌────────────────────────────────────┐
│  Aero Work            [Connect] ⚡  │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │  [+] New Conversation        │  │  <- New chat button
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 📁 ~/project                 │  │  <- Session cards
│  │ Last message preview...       │  │
│  │                    10:30 AM   │  │
│  └──────────────────────────────┘  │
│  ...more sessions...               │
├────────────────────────────────────┤
│  [💬*] [📁]  [>_]  [⚙️]           │
└────────────────────────────────────┘

Conversation View (slide-in from right, no tab bar):
┌────────────────────────────────────┐
│  [←]  ~/project        [···]       │  <- Back + project name + menu
├────────────────────────────────────┤
│  ┌────────────────────────────┐    │
│  │ User message               │    │
│  └────────────────────────────┘    │
│       ┌────────────────────────┐   │
│       │ Agent response         │   │
│       └────────────────────────┘   │
├────────────────────────────────────┤
│  [📎]  Type a message...    [>]   │  <- Input area (keyboard-aware)
└────────────────────────────────────┘
```

Navigation Rules:
- Tab bar visible: Session list, Files, Terminal, Settings
- Tab bar hidden: Conversation view, File viewer
- Back navigation: Tap back button or swipe from left edge
- Keyboard handling: View compresses, input stays above keyboard

See `.agent/mobile-redesign.md` for full design specification.

### Key UI Components

1. **Permission Dialog**: Modal overlay for permission requests with Allow Once/Always Allow/Deny options
2. **Tool Call Card**: Collapsible card showing tool execution status, input, and output
3. **Diff Viewer**: Side-by-side or unified diff view with accept/reject controls
4. **Terminal Panel**: xterm.js based terminal with multiple tabs support
5. **File Tree**: Expandable/collapsible directories with context menu (new file/folder, rename, delete)
6. **File Viewer**: Multi-type viewer supporting text (syntax highlighted), images, PDFs, and binary file info
7. **Mobile Navigation**: Bottom tab bar + slide-out sidebar for mobile layouts

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

### Phase 2: File & Terminal (Complete)
- [x] File browser component (FileTree)
- [x] Code viewer with syntax highlighting (Monaco Editor)
- [x] File operations (create, delete, rename via context menu)
- [x] Terminal integration (xterm.js + PTY)
- [x] Multi-type file viewer (text, image, PDF, binary)
- [x] File upload to working directory
- [ ] Diff viewer for file changes

### Phase 3: Session Management
- [ ] Multiple sessions support
- [ ] Session persistence (save/restore)
- [ ] Session fork and resume

### Phase 4: Web Server Mode (In Progress)
- [x] Axum HTTP server embedded in Tauri
- [x] WebSocket transport implementation
- [ ] Authentication system (JWT)
- [ ] Headless mode (no window)

### Phase 5: Multi-Agent & Polish
- [ ] Multiple agent configuration
- [ ] Agent switching UI
- [x] Mobile responsive design (complete mobile UI with navigation)
- [x] Theme support (light/dark with system detection)
- [x] Internationalization (i18n) support with react-i18next (English, Chinese)

### Phase 6: Advanced Features ✅
- [ ] Remote agent connections
- [x] MCP server integration (dual-config with enable/disable)
- [x] Plugin system (marketplaces, install/uninstall)
- [x] Settings page responsive design (360px minimum width)
- [x] Model provider configuration (Anthropic, Bedrock, BigModel, MiniMax, Moonshot, Custom)
- [x] PWA support for web mode

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
      "args": ["@zed-industries/claude-code-acp"],
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
