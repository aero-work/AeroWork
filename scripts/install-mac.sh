#!/bin/bash
# AeroWork macOS Installation Script
# Downloads and installs AeroWork, handling unsigned app permissions automatically.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/anthropics/aerowork/main/scripts/install-mac.sh | bash
#
# Or with a specific version:
#   curl -fsSL https://raw.githubusercontent.com/anthropics/aerowork/main/scripts/install-mac.sh | bash -s -- v1.0.0

set -e

# Configuration
APP_NAME="AeroWork"
GITHUB_REPO="anthropics/aerowork"  # Update this to actual repo
INSTALL_DIR="/Applications"

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

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    error "This script is for macOS only."
fi

# Detect architecture
ARCH=$(uname -m)
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

info "Detected architecture: $ARCH ($DMG_ARCH)"

# Get version (from argument or latest)
VERSION="${1:-latest}"

if [[ "$VERSION" == "latest" ]]; then
    info "Fetching latest release..."
    VERSION=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
    if [[ -z "$VERSION" ]]; then
        error "Failed to fetch latest version. Please specify a version manually."
    fi
fi

info "Installing ${APP_NAME} ${VERSION}..."

# Construct download URL
DMG_NAME="${APP_NAME}_${VERSION#v}_${DMG_ARCH}.dmg"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/${DMG_NAME}"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

DMG_PATH="${TEMP_DIR}/${DMG_NAME}"

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
MOUNT_POINT=$(hdiutil attach "${DMG_PATH}" -nobrowse -noautoopen | grep "/Volumes" | awk '{print $3}')

if [[ -z "$MOUNT_POINT" ]]; then
    error "Failed to mount DMG"
fi

# Find .app in mounted volume
APP_PATH=$(find "${MOUNT_POINT}" -maxdepth 1 -name "*.app" | head -1)

if [[ -z "$APP_PATH" ]]; then
    hdiutil detach "${MOUNT_POINT}" -quiet
    error "No .app found in DMG"
fi

APP_BASENAME=$(basename "${APP_PATH}")

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
