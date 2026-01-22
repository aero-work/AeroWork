# Installation Guide

## Quick Install

### macOS & Linux

```bash
curl -fsSL https://aerowork.cc/install.sh | bash
```

### Specific Version

```bash
curl -fsSL https://aerowork.cc/install.sh | bash -s -- v0.1.0
```

## Platform-Specific Options

### macOS

The script automatically:
- Detects architecture (Intel x64 / Apple Silicon aarch64)
- Downloads and mounts the DMG
- Installs to `/Applications`
- Removes quarantine attribute for unsigned app

**Manual fix if needed:**
```bash
xattr -cr /Applications/AeroWork.app
```

### Linux

The script auto-detects your distribution and installs the appropriate format:

| Distribution | Format | Package Manager |
|--------------|--------|-----------------|
| Debian/Ubuntu | .deb | dpkg/apt |
| Fedora/RHEL | .rpm | rpm/dnf/yum |
| Other | AppImage | ~/.local/bin |

**Force a specific format:**

```bash
# AppImage (universal, no root required)
curl -fsSL https://aerowork.cc/install.sh | bash -s -- --appimage

# Debian/Ubuntu
curl -fsSL https://aerowork.cc/install.sh | bash -s -- --deb

# Fedora/RHEL
curl -fsSL https://aerowork.cc/install.sh | bash -s -- --rpm
```

### Android

Download the APK from [GitHub Releases](https://github.com/aero-work/aero-work/releases) and install manually.

On first launch, configure the WebSocket URL to your desktop server (default port: `9527`).

## Building from Source

**Prerequisites:**
- [Bun](https://bun.sh/)
- [Rust](https://rustup.rs/)
- Claude Code: `npm i -g @anthropic-ai/claude-code`

```bash
# Clone repository
git clone https://github.com/aero-work/aero-work.git
cd aero-work

# Install dependencies
bun install

# Development
bun run tauri dev

# Build
bun run tauri build
```

## Uninstall

### macOS
```bash
rm -rf /Applications/AeroWork.app
```

### Linux (deb)
```bash
sudo dpkg -r aerowork
```

### Linux (rpm)
```bash
sudo rpm -e aerowork
```

### Linux (AppImage)
```bash
rm ~/.local/bin/AeroWork.AppImage
rm ~/.local/share/applications/aerowork.desktop
```
