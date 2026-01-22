# AeroWork

[中文](./README.zh-CN.md)

An AI agent for everyone from everywhere.

![Main Window](./assets/main-window.webp)

Inspired by Anthropic's [Cowork](https://claude.com/blog/cowork-research-preview), AeroWork aims to bring AI agent capabilities to everyone - not just developers. While Cowork is macOS-only and requires Claude Max, AeroWork is open-source, cross-platform (Windows, macOS, Linux, Android, Web), and works with any Anthropic-compatible API.

### Design Principles

**Speed** - Built with Tauri + Rust for a lightweight, fast experience. The Rust backend manages all sessions and agent processes efficiently, with minimal memory footprint compared to Electron alternatives.

**Collaboration** - Work from anywhere. Start on desktop, monitor and control from your phone via PWA. Combine with [Tailscale](https://tailscale.com/)/[Headscale](https://github.com/juanfont/headscale) for secure remote access - approve permissions, check task status, and manage your agent from anywhere.

<video src="./assets/desktop-and-mobile-work-together.mp4" autoplay loop muted playsinline width="100%"></video>

**Standardization** - Uses [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) for Claude Code integration. Future plans include support for OpenCode, Gemini CLI, and other ACP-compatible agents.

## Highlights

| | |
|---|---|
| **Agent Chat** | Real-time streaming, tool call visualization, permission prompts |
| **File Browser** | Syntax highlighting, image/PDF preview, remote file management |
| **Terminal** | Full PTY support, works locally and remotely |
| **Session Management** | Create, resume, fork sessions with full history |
| **Yolo Mode** | "You Only Look Once" - auto-approve all tool calls |
| **Permission Rules** | Fine-grained control with regex patterns for tools and paths |
| **Multi-Provider** | Anthropic, Amazon Bedrock, BigModel/Zhipu, MiniMax, Moonshot AI/Kimi, Custom |
| **MCP Servers** | Visual management of Claude Code's MCP servers |
| **Skills** | Enable/disable Claude Code skills through UI |
| **Remote Access** | Everything works via WebSocket (port 9527) - use from phone PWA or Android app |
| **i18n** | English, Chinese |
| **Themes** | Light / Dark / System |

## Quick Start

**Prerequisites:** [Bun](https://bun.sh/), [Rust](https://rustup.rs/), Claude Code (`npm i -g @anthropic-ai/claude-code`)

```bash
# Install
bun install

# Desktop app
bun run tauri dev

# Web app (run both commands)
cargo run --bin aero-server --manifest-path src-tauri/Cargo.toml
bun run dev
# Open http://localhost:5173
```

## Build

```bash
bun run tauri build   # Desktop (Windows, macOS, Linux)
bun run build         # Web
```

### Android Build

Android app is a WebView-only client that connects to a desktop server via WebSocket.

```bash
# First time setup
bun run tauri android init
./scripts/android-post-init.sh  # Configure cleartext traffic

# Build
bun run tauri android build --target aarch64 --debug  # Debug APK
bun run tauri android build --target aarch64          # Release APK
```

On first launch, configure the WebSocket URL to your desktop server (default port: `9527`).

### macOS Unsigned App

The macOS app is not code-signed. On first launch, you may see **"AeroWork is damaged and can't be opened"** or **"Apple cannot check it for malicious software"**.

**Solution:**
```bash
# Remove quarantine attribute
xattr -cr /Applications/AeroWork.app

# Or allow in System Settings:
# System Settings → Privacy & Security → "Open Anyway"
```

## Configuration

Featuring powerful configuration management capabilities, it can manage Claude Code system configurations, configure models/MCP/Plugins - a Claude Code configuration manager that's better than any other tool.

![Settings Page](./assets/setting-page-demo.webp)

Additional config files are stored in `~/.config/aerowork/`:

| File | Purpose |
|------|---------|
| `config.json` | General settings |
| `models.json` | Model provider configuration |
| `mcp.json` | MCP server configuration |
| `permission.json` | Permission configuration |

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand
- **Backend:** Tauri 2.0, Rust, Axum
- **Protocol:** Agent Client Protocol (ACP)
- **Agent:** Claude Agent SDK

## License

MIT
