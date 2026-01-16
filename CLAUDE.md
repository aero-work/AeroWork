# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aero Work** is a cross-platform AI code agent application built with Tauri (Rust backend) + React (TypeScript frontend). It provides a visual interface for interacting with AI coding agents like Claude Code via the Agent Client Protocol (ACP).

### Current Status

**Phase 1 - Core Features (Completed)**
- ✅ Project setup (Tauri 2.0 + Vite + React + TypeScript + Tailwind v4 + shadcn/ui)
- ✅ ACP client implementation in Rust (JSON-RPC over stdio)
- ✅ Unified transport layer (WebSocket for both desktop and web)
- ✅ VSCode-like UI with resizable panels
- ✅ Chat interface with markdown rendering and syntax highlighting
- ✅ Tool Call Cards with expand/collapse
- ✅ Permission dialog for tool authorization
- ✅ Session management (create, resume, fork, delete)
- ✅ Session history loading with tool calls

**Phase 2 - Extended Features (Completed)**
- ✅ Light/Dark/System theme support (shadcn/ui Slate theme)
- ✅ Plugin management system (marketplaces, install/uninstall)
- ✅ File tree browser with hidden files toggle
- ✅ Settings page with tabs (General, Agents, Models, MCP, Plugins, Permissions)
- ✅ Auto-connect on startup
- ✅ Auto-clean empty sessions option
- ✅ Custom zoom for desktop (Cmd+/-), browser native zoom for web

**Recent Code Review (2026-01-15)**
- Fixed 4 bugs: memory leak in useSessionData, stale closure in CodeEditor, FileTree effect dependencies, permission dialog cleanup
- Verified 5 issues as safe/not bugs
- Documented 4 enhancement suggestions for future

**Known Issues**
- Chinese IME Enter key issue in desktop app (see `.agent/known-issues.md`)
- See `.agent/code-review-issues.md` for full code review results

### Key Architecture Decisions

- **Unified Rust Backend**: Single Tauri backend serves both desktop and web modes
- **WebSocket Transport**: Both desktop and web use WebSocket for communication
- **ACP Protocol**: Agent Client Protocol for standardized agent communication (JSON-RPC over stdio)
- **Agent**: Uses `npx @zed-industries/claude-code-acp` to spawn Claude Code agent
- **State Management**: Backend is the source of truth for session data; frontend subscribes via hooks

## Project Structure

```
aero-work/
├── .agent/              # Project documentation - READ THESE FIRST
│   ├── product.md       # Product requirements, UI/UX design
│   ├── structure.md     # Directory structure, code patterns
│   ├── tech.md          # Technology stack, architecture
│   └── known-issues.md  # Known bugs and issues
├── src-tauri/           # Rust backend (Tauri)
│   └── src/
│       ├── lib.rs       # Tauri app setup
│       ├── acp/         # ACP protocol implementation
│       │   ├── client.rs   # JSON-RPC client over stdio
│       │   └── types.rs    # Protocol types
│       ├── core/        # Business logic
│       │   ├── agent.rs    # AgentManager (spawn, communicate)
│       │   ├── state.rs    # AppState (shared state)
│       │   ├── session_registry.rs  # Session file scanning, history loading
│       │   ├── session_state.rs     # Session state types
│       │   ├── plugins.rs           # Plugin management
│       │   └── terminal.rs          # PTY management
│       └── server/      # WebSocket server
│           └── websocket.rs  # JSON-RPC over WebSocket
└── src/                 # React frontend
    ├── components/
    │   ├── layout/      # MainLayout, Header, Sidebar
    │   ├── chat/        # ChatView, MessageList, ChatInput, ToolCallCard
    │   ├── settings/    # Settings tabs (General, Agents, Plugins, etc.)
    │   ├── common/      # PermissionDialog, ProjectSelector
    │   └── ui/          # shadcn/ui components
    ├── stores/          # Zustand state management
    │   ├── sessionStore.ts   # UI state (activeSessionId, isLoading)
    │   ├── agentStore.ts     # Connection status, agent info
    │   ├── fileStore.ts      # Working directory, recent projects
    │   └── settingsStore.ts  # Settings, theme, preferences
    ├── hooks/           # Custom React hooks
    │   ├── useSessionData.ts # Session data subscription
    │   ├── useTheme.ts       # Theme management
    │   └── useZoom.ts        # Desktop zoom (Cmd+/-)
    ├── services/        # Backend communication
    │   ├── transport/
    │   │   ├── websocket.ts  # WebSocket transport
    │   │   └── types.ts      # Transport interface
    │   └── api.ts            # AgentAPI class
    └── types/
        ├── acp.ts       # ACP protocol types
        └── plugins.ts   # Plugin types
```

## Running the App

```bash
# Install dependencies
bun install

# Development mode (desktop)
bun run tauri dev

# Development mode (web only)
bun run dev

# Production build
bun run tauri build

# Run standalone WebSocket server (for web mode)
cargo run --bin aero-server
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src-tauri/src/acp/client.rs` | ACP JSON-RPC client, message parsing |
| `src-tauri/src/server/websocket.rs` | WebSocket server, JSON-RPC dispatch |
| `src-tauri/src/core/session_registry.rs` | Session history loading |
| `src/hooks/useSessionData.ts` | Frontend session data subscription |
| `src/services/api.ts` | Frontend API for agent communication |
| `src/index.css` | Theme CSS variables (shadcn/ui Slate theme) |

## Important Context

Before making changes, read the documentation in `.agent/`:
- `.agent/product.md` - Product requirements, UI/UX design
- `.agent/structure.md` - Directory structure, code patterns
- `.agent/tech.md` - Technology stack, architecture
- `.agent/known-issues.md` - Known bugs and workarounds
- `.agent/code-review-issues.md` - Code review results and fixes (2026-01-15)
