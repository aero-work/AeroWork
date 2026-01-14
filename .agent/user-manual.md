# Aero Code - User Manual

## Overview

Aero Code is a cross-platform AI code agent application that provides a visual interface for interacting with AI coding agents like Claude Code via the Agent Client Protocol (ACP).

## Getting Started

### Prerequisites

- Node.js 18+ (for the agent process)
- Anthropic API key (set as `ANTHROPIC_API_KEY` environment variable)

### Installation

```bash
# Install dependencies
bun install

# Development mode (desktop)
bun run tauri dev

# Development mode (web only)
bun run dev

# Production build
bun run tauri build
```

### First Launch

1. Launch the application
2. The app will auto-connect to the backend (if enabled in settings)
3. Click "Connect" in the header if not auto-connected
4. Select or create a project directory
5. Start a new session

---

## Main Interface

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                        Header                                │
│  [Connect/Disconnect]        [Status]        [Settings]      │
├─────────────┬───────────────────────────────────────────────┤
│             │                                               │
│   Sidebar   │              Main Content Area                │
│             │           (Chat / Editor / Settings)          │
│  - Sessions │                                               │
│  - Files    │                                               │
│  - Agents   │                                               │
│             │                                               │
├─────────────┴───────────────────────────────────────────────┤
│                       Status Bar                             │
└─────────────────────────────────────────────────────────────┘
```

### Sidebar Sections

#### Sessions
- View all sessions in the current project
- Click a session to switch to it
- Sessions show summary and last activity time
- Use the `+` button to create a new session
- Use the trash icon to delete a session

#### Files
- Browse files in the current project
- Click a file to open in the editor
- Toggle hidden files visibility with the eye icon
- Context menu (right-click) for:
  - New File
  - New Folder
  - Rename
  - Delete

#### Agents
- View connected agent status
- Shows agent name and version

---

## Working with Projects

### Opening a Project

1. Click the project selector button (shows current project name or "Open Project")
2. Use one of two methods:

**Recent Tab:**
- Enter a path directly in the input field
- Or click a recent project from the list

**Browse Tab:**
- Navigate directories like a file explorer
- Use ↑ to go to parent directory
- Use 🏠 to go to root
- Click folders to navigate into them
- Click "Open This Folder" to select

### File Browser

- Double-click folders to expand/collapse
- Single-click files to open in editor
- Supports text files, images, PDFs
- Binary files show metadata only

---

## Chat Interface

### Sending Messages

1. Type your message in the input area at the bottom
2. Press Enter or click Send
3. Wait for the agent's response

### Tool Calls

When the agent uses tools (reading files, running commands, etc.):
- Tool calls appear as expandable cards
- Click to expand/collapse details
- Shows tool input and output
- Status: pending → in_progress → completed/failed

### Permissions

When the agent needs permission for sensitive operations:
- A dialog appears with the tool request
- Options typically include:
  - Allow Once
  - Allow Always
  - Reject

---

## Settings

Access settings via the gear icon in the header.

### General Settings

| Setting | Description |
|---------|-------------|
| Auto Connect | Automatically connect to backend on startup |
| Show Hidden Files | Display hidden files (starting with `.`) in file tree |
| Auto Clean Empty Sessions | Remove sessions with no messages when loading |
| Theme | Light / Dark / System |

### Agent Settings

- View connected agent information
- Agent name, version, capabilities

### Model Settings

- View available AI models from the agent
- Switch between models for the current session
- Current model is marked with a star

### MCP Settings

Configure Model Context Protocol servers to extend agent capabilities:

1. Click "Add MCP Server"
2. Fill in:
   - **Server Name**: Display name (e.g., "filesystem")
   - **Command**: Executable (e.g., "npx")
   - **Arguments**: Space-separated args (e.g., "-y @modelcontextprotocol/server-filesystem /path")
   - **Environment Variables**: KEY=VALUE format, one per line
3. Enable/disable servers with the toggle
4. Delete servers with the trash icon

**Note:** MCP changes take effect on the next new session.

### Plugin Settings

View and manage plugins (marketplace integration).

### Permission Settings

Configure default permission rules for tools:
- Allow: Auto-approve matching tools
- Ask: Prompt for permission
- Deny: Block matching tools

---

## Keyboard Shortcuts

### Desktop Only

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + Plus | Zoom in |
| Cmd/Ctrl + Minus | Zoom out |
| Cmd/Ctrl + 0 | Reset zoom |
| Cmd/Ctrl + S | Save current file |

### Editor

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + S | Save file |

---

## Mobile Interface

On screens < 768px, the interface switches to a mobile-optimized layout:

### Bottom Navigation
- Chat: Main chat interface
- Files: File browser
- Terminal: Terminal panel
- Settings: Settings page

### Mobile Header
- Hamburger menu: Opens sidebar with sessions and project selector
- Connection status indicator

### File Viewer
- Read-only syntax-highlighted view
- Swipe back to return to file list

---

## Troubleshooting

### Connection Issues

1. Check if the backend is running
2. Verify WebSocket URL (default: `ws://localhost:3000/ws`)
3. Check browser console for errors
4. Try manual reconnect via Connect button

### Session Not Loading

1. Ensure you have a project selected
2. Check if the agent is connected (green status)
3. Try refreshing the session list
4. Create a new session if needed

### MCP Server Not Working

1. Verify the command is correct
2. Check that required environment variables are set
3. Ensure the MCP server package is installed
4. Check backend logs for errors

### File Operations Failing

1. Verify you have permissions for the directory
2. Check if the path exists
3. Ensure the backend is connected

---

## Configuration Files

Settings are persisted to browser localStorage:
- `aero-code-settings`: App settings, MCP servers, permission rules
- `aero-code-files`: Recent projects, working directory

For desktop Tauri builds, data is stored in platform-specific locations.
