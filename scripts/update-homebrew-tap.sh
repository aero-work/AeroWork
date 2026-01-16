#!/bin/bash
# Update Homebrew tap with new release
# Usage: ./scripts/update-homebrew-tap.sh <version> [tap-repo-path]
#
# Example:
#   ./scripts/update-homebrew-tap.sh 0.1.0
#   ./scripts/update-homebrew-tap.sh 0.1.0 ../homebrew-tap

set -e

VERSION=$1
TAP_PATH=${2:-"../homebrew-tap"}

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [tap-repo-path]"
  echo "Example: $0 0.1.0 ../homebrew-tap"
  exit 1
fi

if [ ! -d "$TAP_PATH" ]; then
  echo "Error: Tap repository not found at $TAP_PATH"
  echo "Clone it first: git clone git@github.com:aero-work/homebrew-tap.git $TAP_PATH"
  exit 1
fi

CASK_FILE="$TAP_PATH/Casks/aerowork.rb"

if [ ! -f "$CASK_FILE" ]; then
  echo "Error: Cask file not found at $CASK_FILE"
  exit 1
fi

echo "Updating AeroWork Homebrew Cask to version $VERSION..."

# Update version in cask file
sed -i.bak "s/version \".*\"/version \"$VERSION\"/" "$CASK_FILE"
rm -f "$CASK_FILE.bak"

echo "Updated $CASK_FILE"
echo ""
echo "Next steps:"
echo "1. Build releases for both architectures:"
echo "   - Apple Silicon: bun run tauri build (on M1/M2 Mac)"
echo "   - Intel: bun run tauri build (on Intel Mac or with --target x86_64-apple-darwin)"
echo ""
echo "2. Create GitHub Release v$VERSION and upload:"
echo "   - AeroWork_${VERSION}_aarch64.dmg"
echo "   - AeroWork_${VERSION}_x64.dmg"
echo ""
echo "3. Commit and push the tap:"
echo "   cd $TAP_PATH"
echo "   git add ."
echo "   git commit -m \"Update aerowork to $VERSION\""
echo "   git push"
echo ""
echo "4. Test installation:"
echo "   brew tap aero-work/tap"
echo "   brew install --cask aerowork"
