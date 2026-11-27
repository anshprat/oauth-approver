#!/bin/bash

# Packaging script for the Chrome Web Store and Firefox Add-ons (AMO).
#
#   ./package.sh            # build both zips
#   ./package.sh chrome     # Chrome zip only
#   ./package.sh firefox    # Firefox zip only
#
# Chrome loads the repo root as is. Firefox needs a different manifest, so the
# Firefox build copies the shared files to build/firefox/ and writes a manifest
# made from manifest.json plus firefox/manifest.overrides.json.
# Load build/firefox/ in about:debugging to test the Firefox build unpacked.

set -e

cd "$(dirname "$0")"

TARGET="${1:-all}"

VERSION=$(jq -r '.version' manifest.json)
NAME=$(jq -r '.name' manifest.json | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

# Files that make up the extension, the same for both browsers
FILES=(background.js content.js popup.html popup.js styles.css icons)

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

package_chrome() {
    local zip_name="${NAME}-chrome-v${VERSION}.zip"
    echo -e "${BLUE}Packaging ${NAME} v${VERSION} for Chrome...${NC}"
    rm -f "$zip_name"
    zip -r "$zip_name" manifest.json "${FILES[@]}" -x "*.DS_Store"
    echo -e "${GREEN}Package created: ${zip_name}${NC}"
    echo -e "${BLUE}Upload at: https://chrome.google.com/webstore/devconsole${NC}"
}

build_firefox() {
    local out="build/firefox"
    rm -rf "$out"
    mkdir -p "$out"
    cp -R "${FILES[@]}" "$out/"
    # Firefox MV3 has no background service worker: use an event page instead
    jq -s '.[0] * .[1] | del(.background.service_worker)' \
        manifest.json firefox/manifest.overrides.json > "$out/manifest.json"
    find "$out" -name ".DS_Store" -delete
}

package_firefox() {
    local zip_name="${NAME}-firefox-v${VERSION}.zip"
    echo -e "${BLUE}Packaging ${NAME} v${VERSION} for Firefox...${NC}"
    build_firefox
    rm -f "$zip_name"
    # The manifest must be at the zip root, so zip from inside the build folder
    (cd build/firefox && zip -r "../../$zip_name" .)
    echo -e "${GREEN}Package created: ${zip_name}${NC}"
    echo -e "${BLUE}Upload at: https://addons.mozilla.org/developers/addon/submit/${NC}"
}

case "$TARGET" in
    chrome)  package_chrome ;;
    firefox) package_firefox ;;
    all)     package_chrome; package_firefox ;;
    *)       echo "Usage: $0 [chrome|firefox|all]" >&2; exit 1 ;;
esac
