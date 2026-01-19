#!/bin/bash
set -e

# Deploy AeroWork frontend to Cloudflare Pages
# Usage: ./scripts/deploy-cloudflare.sh [project-name] [--production]
#
# Prerequisites:
#   - Install wrangler: bun add -g wrangler
#   - Login to Cloudflare: wrangler login
#
# First time setup:
#   The script will create a new Cloudflare Pages project if it doesn't exist.

PROJECT_NAME="${1:-aero-work}"
DEPLOY_ENV="preview"

# Check for production flag
if [[ "$2" == "--production" ]] || [[ "$1" == "--production" ]]; then
    DEPLOY_ENV="production"
    if [[ "$1" == "--production" ]]; then
        PROJECT_NAME="aero-work"
    fi
fi

echo "==================================="
echo "Deploying to Cloudflare Pages"
echo "Project: $PROJECT_NAME"
echo "Environment: $DEPLOY_ENV"
echo "==================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed."
    echo "Install it with: bun add -g wrangler"
    echo "Then login with: wrangler login"
    exit 1
fi

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Clean previous build
echo ""
echo "Cleaning previous build..."
rm -rf dist

# Build the frontend
echo ""
echo "Building frontend..."
bun run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

echo ""
echo "Build complete. Output directory: dist"
echo "Files:"
ls -la dist/

# Deploy to Cloudflare Pages
echo ""
echo "Deploying to Cloudflare Pages..."

if [ "$DEPLOY_ENV" == "production" ]; then
    wrangler pages deploy dist --project-name "$PROJECT_NAME" --branch main
else
    # Preview deployment (uses a unique URL)
    wrangler pages deploy dist --project-name "$PROJECT_NAME"
fi

echo ""
echo "==================================="
echo "Deployment complete!"
echo "==================================="
