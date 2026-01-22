# AeroWork

随时随地，人人可用的 AI Agent。

![主界面](./assets/main-window.webp)

灵感来源于 Anthropic 发布的 [Cowork](https://claude.com/blog/cowork-research-preview)，AeroWork 致力于让每个人都能使用 AI Agent 能力，而不仅仅是开发者。Cowork 仅支持 macOS 且需要 Claude Max 订阅，而 AeroWork 是开源的、全平台支持 (Windows, macOS, Linux, Android, Web)，兼容任何 Anthropic 兼容 API。

### 设计原则

**速度** - 基于 Tauri + Rust 构建，轻量快速。Rust 后端高效管理所有会话和 Agent 进程，内存占用远低于 Electron 方案。

**协同** - 随时随地工作。桌面端启动，手机 PWA 远程监控。配合 [Tailscale](https://tailscale.com/) 实现安全远程访问 - 随时随地确认权限、查看任务状态、管理 Agent。

<video src="./assets/desktop-and-mobile-work-together.mp4" autoplay loop muted playsinline width="100%"></video>

**标准化** - 使用 [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) 接入 Claude Code。未来计划支持 OpenCode、Gemini CLI 等更多 ACP 兼容的 Agent。

## 功能亮点

| | |
|---|---|
| **Agent 对话** | 实时流式响应、工具调用可视化、权限确认弹窗 |
| **文件浏览器** | 语法高亮、图片/PDF 预览、远程文件管理 |
| **终端** | 完整 PTY 支持，本地远程均可用 |
| **会话管理** | 创建、恢复、分支会话，完整历史记录 |
| **Yolo 模式** | "You Only Look Once" - 自动通过所有工具调用 |
| **权限规则** | 精细化控制，正则匹配工具和路径 |
| **多提供商** | Anthropic、Amazon Bedrock、BigModel/智谱、MiniMax、Moonshot AI/Kimi、自定义 |
| **MCP 服务器** | 可视化管理 Claude Code 的 MCP 服务器 |
| **Skills** | 通过界面启用/禁用 Claude Code Skills |
| **远程访问** | 全部功能通过 WebSocket (端口 9527) 远程可用，手机 PWA 或 Android 应用随时访问 |
| **多语言** | 中文、英文 |
| **主题** | 亮色 / 暗色 / 跟随系统 |

## 快速开始

**前置条件:** [Bun](https://bun.sh/), [Rust](https://rustup.rs/), Claude Code (`npm i -g @anthropic-ai/claude-code`)

```bash
# 安装依赖
bun install

# 运行桌面端
bun run tauri dev

# 运行网页端 (需要同时运行两个命令)
cargo run --bin aero-server --manifest-path src-tauri/Cargo.toml
bun run dev
# 打开 http://localhost:5173
```

## 构建

```bash
bun run tauri build   # 桌面端 (Windows, macOS, Linux)
bun run build         # 网页端
```

### Android 构建

Android 应用是纯 WebView 客户端，通过 WebSocket 连接桌面端服务器。

```bash
# 首次初始化
bun run tauri android init
./scripts/android-post-init.sh  # 配置明文流量

# 构建
bun run tauri android build --target aarch64 --debug  # Debug APK
bun run tauri android build --target aarch64          # Release APK
```

首次启动需要配置 WebSocket 地址指向桌面端服务器 (默认端口: `9527`)。

## 配置管理

强大的配置管理功能，可以管理 Claude Code 系统配置，配置模型/MCP/插件 - 比任何其他工具都好用的 Claude Code 配置管理器。

![设置页面](./assets/setting-page-demo.webp)

配置文件存储在 `~/.config/aerowork/`:

| 文件 | 用途 |
|------|------|
| `config.json` | 通用设置 |
| `models.json` | 模型提供商配置 |
| `mcp.json` | MCP 服务器配置 |
| `permission.json` | 权限配置 |

## 技术栈

- **前端:** React, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand
- **后端:** Tauri 2.0, Rust, Axum
- **协议:** Agent Client Protocol (ACP)
- **Agent:** Claude Agent SDK

## 许可证

MIT
