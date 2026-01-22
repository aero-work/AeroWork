#!/bin/bash
# AeroWork macOS Local Installation Script
# Installs AeroWork from a local DMG file, handling unsigned app permissions automatically.
#
# Usage:
#   ./install-local-mac.sh /path/to/AeroWork.dmg

set -e

# Configuration
APP_NAME="AeroWork"
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

# Check arguments
DMG_PATH="$1"

if [[ -z "$DMG_PATH" ]]; then
    echo "Usage: $0 /path/to/AeroWork.dmg"
    exit 1
fi

if [[ ! -f "$DMG_PATH" ]]; then
    error "DMG file not found: $DMG_PATH"
fi

info "Installing ${APP_NAME} from ${DMG_PATH}..."

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

# Ensure cleanup on exit
cleanup() {
    if [[ -n "$MOUNT_POINT" ]]; then
        hdiutil detach "${MOUNT_POINT}" -quiet 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Find .app in mounted volume
APP_PATH=$(find "${MOUNT_POINT}" -maxdepth 1 -name "*.app" | head -1)

if [[ -z "$APP_PATH" ]]; then
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
MOUNT_POINT=""

# Remove quarantine attribute (handles unsigned app)
info "Removing quarantine attribute..."
xattr -cr "${INSTALL_DIR}/${APP_BASENAME}" 2>/dev/null || true

# Verify installation
if [[ -d "${INSTALL_DIR}/${APP_BASENAME}" ]]; then
    success "${APP_NAME} installed successfully!"
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
