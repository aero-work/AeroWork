#!/bin/bash
# AeroWork Installation Script (macOS & Linux)
# Downloads and installs AeroWork automatically.
#
# Usage:
#   curl -fsSL https://aerowork.cc/install.sh | bash
#
# Or with a specific version:
#   curl -fsSL https://aerowork.cc/install.sh | bash -s -- v0.1.0
#
# Options:
#   --appimage    Force AppImage installation on Linux (default)
#   --deb         Force .deb installation on Linux (Debian/Ubuntu)
#   --rpm         Force .rpm installation on Linux (Fedora/RHEL)

set -e

# Configuration
APP_NAME="AeroWork"
APP_NAME_LOWER="aerowork"
GITHUB_REPO="aero-work/aero-work"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}==>${NC} $1"
}

success() {
    echo -e "${GREEN}==>${NC} $1"
}

warn() {
    echo -e "${YELLOW}==>${NC} $1"
}

error() {
    echo -e "${RED}==>${NC} $1"
    exit 1
}

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

# Parse arguments
VERSION=""
FORCE_FORMAT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --appimage)
            FORCE_FORMAT="appimage"
            shift
            ;;
        --deb)
            FORCE_FORMAT="deb"
            shift
            ;;
        --rpm)
            FORCE_FORMAT="rpm"
            shift
            ;;
        v*)
            VERSION="$1"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Get version if not specified
if [[ -z "$VERSION" ]]; then
    info "Fetching latest release..."
    # Try latest first, then fall back to all releases (for prerelease)
    VERSION=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
    if [[ -z "$VERSION" ]]; then
        # Fallback: get first release (including prerelease)
        VERSION=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases" 2>/dev/null | grep '"tag_name"' | head -1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
    fi
    if [[ -z "$VERSION" ]]; then
        error "Failed to fetch latest version. Please specify a version manually (e.g., v0.1.0)"
    fi
fi

info "Installing ${APP_NAME} ${VERSION}..."

# ============================================================================
# macOS Installation
# ============================================================================
install_macos() {
    local DMG_ARCH
    case "$ARCH" in
        x86_64)
            DMG_ARCH="x64"
            ;;
        arm64)
            DMG_ARCH="aarch64"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            ;;
    esac

    info "Detected: macOS $ARCH ($DMG_ARCH)"

    local INSTALL_DIR="/Applications"
    local DMG_NAME="${APP_NAME}_${VERSION#v}_${DMG_ARCH}.dmg"
    local DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/${DMG_NAME}"

    # Create temp directory
    local TEMP_DIR=$(mktemp -d)
    trap "rm -rf ${TEMP_DIR}" EXIT

    local DMG_PATH="${TEMP_DIR}/${DMG_NAME}"

    # Download DMG
    info "Downloading ${DMG_NAME}..."
    if ! curl -fSL --progress-bar -o "${DMG_PATH}" "${DOWNLOAD_URL}"; then
        error "Failed to download ${DOWNLOAD_URL}"
    fi

    success "Download complete!"

    # Check if app is running
    if pgrep -x "${APP_NAME}" > /dev/null; then
        warn "${APP_NAME} is currently running. Please close it before continuing."
        read -p "Press Enter to continue after closing ${APP_NAME}, or Ctrl+C to cancel..."
    fi

    # Mount DMG
    info "Mounting disk image..."
    local MOUNT_POINT=$(hdiutil attach "${DMG_PATH}" -nobrowse -noautoopen | grep "/Volumes" | awk '{print $3}')

    if [[ -z "$MOUNT_POINT" ]]; then
        error "Failed to mount DMG"
    fi

    # Find .app in mounted volume
    local APP_PATH=$(find "${MOUNT_POINT}" -maxdepth 1 -name "*.app" | head -1)

    if [[ -z "$APP_PATH" ]]; then
        hdiutil detach "${MOUNT_POINT}" -quiet
        error "No .app found in DMG"
    fi

    local APP_BASENAME=$(basename "${APP_PATH}")

    # Remove existing installation
    if [[ -d "${INSTALL_DIR}/${APP_BASENAME}" ]]; then
        info "Removing existing installation..."
        rm -rf "${INSTALL_DIR}/${APP_BASENAME}"
    fi

    # Copy app to Applications
    info "Installing to ${INSTALL_DIR}..."
    cp -R "${APP_PATH}" "${INSTALL_DIR}/"

    # Unmount DMG
    info "Cleaning up..."
    hdiutil detach "${MOUNT_POINT}" -quiet

    # Remove quarantine attribute (handles unsigned app)
    info "Removing quarantine attribute..."
    xattr -cr "${INSTALL_DIR}/${APP_BASENAME}" 2>/dev/null || true

    # Verify installation
    if [[ -d "${INSTALL_DIR}/${APP_BASENAME}" ]]; then
        success "${APP_NAME} ${VERSION} installed successfully!"
        echo ""
        echo "You can now launch ${APP_NAME} from:"
        echo "  - Spotlight: Press Cmd+Space and type '${APP_NAME}'"
        echo "  - Applications folder: open ${INSTALL_DIR}/${APP_BASENAME}"
        echo ""

        # Ask to launch
        read -p "Would you like to launch ${APP_NAME} now? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open "${INSTALL_DIR}/${APP_BASENAME}"
        fi
    else
        error "Installation failed!"
    fi
}

# ============================================================================
# Linux Installation
# ============================================================================
install_linux() {
    local PKG_ARCH
    case "$ARCH" in
        x86_64|amd64)
            PKG_ARCH="amd64"
            ;;
        aarch64|arm64)
            PKG_ARCH="aarch64"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            ;;
    esac

    info "Detected: Linux $ARCH ($PKG_ARCH)"

    # Detect package format
    local PKG_FORMAT="$FORCE_FORMAT"
    if [[ -z "$PKG_FORMAT" ]]; then
        if command -v dpkg &> /dev/null && [[ -f /etc/debian_version ]]; then
            PKG_FORMAT="deb"
        elif command -v rpm &> /dev/null && [[ -f /etc/redhat-release || -f /etc/fedora-release ]]; then
            PKG_FORMAT="rpm"
        else
            PKG_FORMAT="appimage"
        fi
    fi

    info "Using package format: ${PKG_FORMAT}"

    local PKG_NAME
    local DOWNLOAD_URL

    case "$PKG_FORMAT" in
        deb)
            PKG_NAME="${APP_NAME}_${VERSION#v}_${PKG_ARCH}.deb"
            ;;
        rpm)
            PKG_NAME="${APP_NAME}-${VERSION#v}-1.x86_64.rpm"
            ;;
        appimage)
            PKG_NAME="${APP_NAME}_${VERSION#v}_${PKG_ARCH}.AppImage"
            ;;
        *)
            error "Unknown package format: $PKG_FORMAT"
            ;;
    esac

    DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/${PKG_NAME}"

    # Create temp directory
    local TEMP_DIR=$(mktemp -d)
    trap "rm -rf ${TEMP_DIR}" EXIT

    local PKG_PATH="${TEMP_DIR}/${PKG_NAME}"

    # Download package
    info "Downloading ${PKG_NAME}..."
    if ! curl -fSL --progress-bar -o "${PKG_PATH}" "${DOWNLOAD_URL}"; then
        error "Failed to download ${DOWNLOAD_URL}"
    fi

    success "Download complete!"

    # Install based on format
    case "$PKG_FORMAT" in
        deb)
            info "Installing .deb package..."
            if command -v sudo &> /dev/null; then
                sudo dpkg -i "${PKG_PATH}" || sudo apt-get install -f -y
            else
                dpkg -i "${PKG_PATH}" || apt-get install -f -y
            fi
            success "${APP_NAME} ${VERSION} installed successfully!"
            echo ""
            echo "You can now launch ${APP_NAME} from your application menu or run: ${APP_NAME_LOWER}"
            ;;
        rpm)
            info "Installing .rpm package..."
            if command -v sudo &> /dev/null; then
                sudo rpm -U "${PKG_PATH}" || sudo dnf install -y "${PKG_PATH}" || sudo yum install -y "${PKG_PATH}"
            else
                rpm -U "${PKG_PATH}" || dnf install -y "${PKG_PATH}" || yum install -y "${PKG_PATH}"
            fi
            success "${APP_NAME} ${VERSION} installed successfully!"
            echo ""
            echo "You can now launch ${APP_NAME} from your application menu or run: ${APP_NAME_LOWER}"
            ;;
        appimage)
            local INSTALL_DIR="${HOME}/.local/bin"
            local APPIMAGE_PATH="${INSTALL_DIR}/${APP_NAME}.AppImage"

            # Create install directory
            mkdir -p "${INSTALL_DIR}"

            # Move AppImage
            mv "${PKG_PATH}" "${APPIMAGE_PATH}"
            chmod +x "${APPIMAGE_PATH}"

            success "${APP_NAME} ${VERSION} installed successfully!"
            echo ""
            echo "AppImage installed to: ${APPIMAGE_PATH}"
            echo ""
            echo "To run: ${APPIMAGE_PATH}"
            echo ""

            # Check if ~/.local/bin is in PATH
            if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
                warn "Note: ${INSTALL_DIR} is not in your PATH."
                echo "Add it to your shell profile:"
                echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
            fi

            # Create desktop entry
            local DESKTOP_DIR="${HOME}/.local/share/applications"
            mkdir -p "${DESKTOP_DIR}"
            cat > "${DESKTOP_DIR}/${APP_NAME_LOWER}.desktop" << EOF
[Desktop Entry]
Name=${APP_NAME}
Exec=${APPIMAGE_PATH}
Icon=${APP_NAME_LOWER}
Type=Application
Categories=Development;
Comment=AI Code Agent Application
EOF
            info "Desktop entry created at ${DESKTOP_DIR}/${APP_NAME_LOWER}.desktop"
            ;;
    esac
}

# ============================================================================
# Main
# ============================================================================
case "$OS" in
    Darwin)
        install_macos
        ;;
    Linux)
        install_linux
        ;;
    *)
        error "Unsupported operating system: $OS"
        ;;
esac
