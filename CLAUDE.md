# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aero Work** is a cross-platform AI code agent application built with Tauri 2.0 (Rust backend) + React 19 (TypeScript frontend). It provides a visual interface for interacting with AI coding agents like Claude Code via the Agent Client Protocol (ACP).

**GitHub**: https://github.com/aero-work/aero-work

## Development Commands

```bash
# Install dependencies
bun install

# Desktop app development (Tauri + Vite hot reload)
bun run tauri dev

# Web-only development (frontend only)
bun run dev

# Headless mode (web frontend + WebSocket server concurrently)
bun run headless

# Build production
bun run tauri build        # Desktop app (Windows, macOS, Linux)
bun run build              # Web app only
bun run headless:build     # Web + server

# Run standalone WebSocket server (for web/PWA mode)
cargo run --bin aero-server --manifest-path src-tauri/Cargo.toml

# Rust checks
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml

# TypeScript checks
bunx tsc --noEmit
```

### Android Build (WebView-only client)

```bash
# First time setup
bun run tauri android init
./scripts/android-post-init.sh    # Configure cleartext traffic & signing

# Build
bun run tauri android build --target aarch64 --debug   # Debug APK
bun run tauri android build --target aarch64           # Release APK

# Release signing (optional - uses debug keystore by default)
ANDROID_KEYSTORE_PATH=~/keys/app.keystore \
ANDROID_KEYSTORE_PASSWORD=secret \
ANDROID_KEY_ALIAS=aerowork \
ANDROID_KEY_PASSWORD=secret \
bun run tauri android build --target aarch64
```

### macOS Installation

```bash
# One-line install from releases
curl -fsSL https://raw.githubusercontent.com/aero-work/aero-work/main/scripts/install-mac.sh | bash

# Or install from local DMG
./scripts/install-local-mac.sh /path/to/AeroWork.dmg
```

## Architecture

### Key Design Decisions

- **Unified Rust Backend**: Single Tauri backend serves both desktop (IPC) and web (WebSocket) modes
- **WebSocket-First**: Both desktop and web use WebSocket for agent communication; desktop IPC is only used for window management
- **ACP Protocol**: JSON-RPC 2.0 over stdio to spawn Claude Code agent (`npx @zed-industries/claude-code-acp`)
- **Backend is Source of Truth**: Session state lives in Rust; frontend subscribes via hooks

### Data Flow

```
Frontend (React)
    ↓
Zustand stores → api.ts → WebSocketTransport
    ↓
WebSocket Server (axum, port 9527)
    ↓
Core Services (AgentManager, SessionRegistry)
    ↓
ACP Client → Agent Process (stdio)
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src-tauri/src/acp/` | ACP protocol: `client.rs` (JSON-RPC over stdio), `types.rs` |
| `src-tauri/src/core/` | Business logic: agent, session, config, terminal managers |
| `src-tauri/src/server/` | WebSocket server: `websocket.rs` (JSON-RPC dispatch) |
| `src/stores/` | Zustand stores: session, agent, file, settings, terminal |
| `src/services/` | Backend API: `api.ts`, `transport/websocket.ts` |
| `src/hooks/` | React hooks: `useSessionData.ts` (key subscription hook) |
| `src/components/chat/` | Chat UI: MessageList, ToolCallCard, ChatInput |
| `scripts/` | Build and install scripts |

### Critical Files

- `src-tauri/src/server/websocket.rs` - All JSON-RPC method handlers
- `src-tauri/src/acp/client.rs` - Agent process spawn, message parsing
- `src-tauri/src/core/session_state_manager.rs` - Session state sync
- `src/hooks/useSessionData.ts` - Frontend session subscription
- `src/services/transport/websocket.ts` - WebSocket transport layer
- `src/services/api.ts` - High-level API with connection management
- `src/main.tsx` - Must call `enableMapSet()` from immer for Set/Map support
- `src/components/layout/MobileLayout.tsx` - Mobile layout with Android keyboard handling
- `src-tauri/gen/android/app/src/main/java/com/aerowork/dev/MainActivity.kt` - Android native keyboard detection (manually edited, preserved across rebuilds)

## Configuration

User config files are stored in `~/.config/aerowork/`:
- `config.json` - General settings
- `models.json` - Model provider configuration (Anthropic, Bedrock, etc.)
- `mcp.json` - MCP servers with enable/disable (syncs to `~/.claude.json`)
- `permission.json` - Permission rules

## Important Notes

### Frontend
- Uses Tailwind CSS v4 with oklch colors and shadcn/ui (Slate theme)
- Responsive: mobile layout (`<768px`) uses WeChat-style navigation
- i18n via react-i18next: translations in `src/i18n/locales/`
- First launch shows welcome screen (controlled by `hasLaunchedBefore` flag)

### Backend
- WebSocket server runs on port 9527 by default
- Agent spawned via: `npx @zed-industries/claude-code-acp`
- PTY support via `portable-pty` for terminal feature
- Desktop app auto-detects local server if connection fails

### Android
- Android app is WebView-only client (no backend, connects to desktop server via WebSocket)
- Requires manual WebSocket URL configuration on first launch
- Uses conditional compilation: `#[cfg(not(target_os = "android"))]` for desktop-only modules
- Run `./scripts/android-post-init.sh` after `tauri android init` to configure:
  - Cleartext traffic (ws://) support via network_security_config.xml
  - Release signing with debug fallback
- **Keyboard handling**: Standard `adjustResize` doesn't work with `enableEdgeToEdge()`. Solution:
  - `MainActivity.kt` uses WindowInsets API to detect keyboard height
  - Sends height to WebView via `evaluateJavascript` custom event (`androidKeyboardHeight`)
  - `MobileLayout.tsx` listens for event and adjusts container height
  - Physical pixels converted to CSS pixels via `devicePixelRatio`

### macOS
- App is not code-signed; install scripts auto-remove quarantine attribute
- Manual fix if needed: `xattr -cr /Applications/AeroWork.app`

### Known Issues
- Chinese IME Enter key issue in desktop Tauri WebView (see `.agent/known-issues.md`)

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/install-mac.sh` | One-line macOS installation from GitHub releases |
| `scripts/install-local-mac.sh` | Install macOS app from local DMG |
| `scripts/android-post-init.sh` | Configure Android after `tauri android init` |

## Detailed Documentation

Read `.agent/` directory for comprehensive docs:
- `.agent/product.md` - Product requirements, UI/UX
- `.agent/structure.md` - Full directory structure, code patterns, interfaces
- `.agent/tech.md` - Technology stack, architecture diagrams, protocols
- `.agent/known-issues.md` - Known bugs and workarounds
