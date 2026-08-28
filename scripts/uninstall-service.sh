#!/usr/bin/env bash
#
# uninstall-service.sh — Remove the App Hub macOS Launch Agent
#
# Usage: ./scripts/uninstall-service.sh
#

set -euo pipefail

PLIST_NAME="com.apphub.server"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "=== App Hub Service Uninstaller ==="

# 1. Stop and unload
if launchctl list 2>/dev/null | grep -q "$PLIST_NAME"; then
  echo "Stopping service..."
  launchctl bootout "gui/$(id -u)/$PLIST_NAME" 2>/dev/null || true
  echo "Service stopped."
else
  echo "Service not currently loaded."
fi

# 2. Remove plist
if [[ -f "$PLIST_PATH" ]]; then
  rm "$PLIST_PATH"
  echo "Removed: $PLIST_PATH"
else
  echo "Plist not found at $PLIST_PATH"
fi

echo ""
echo "=== App Hub service uninstalled ==="
echo "Log files in logs/ were not removed."
