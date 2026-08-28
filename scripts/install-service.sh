#!/usr/bin/env bash
#
# install-service.sh — Install App Hub as a macOS Launch Agent
#
# This creates a launchd plist so App Hub starts on login and restarts on crash.
# Usage: ./scripts/install-service.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPHUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_NAME="com.apphub.server"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$APPHUB_ROOT/logs"

echo "=== App Hub Service Installer ==="
echo ""
echo "Root:  $APPHUB_ROOT"

# 1. Find node binary
NODE_BIN="$(which node 2>/dev/null || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Error: node not found in PATH. Install Node.js >= 20 first."
  exit 1
fi
NODE_VERSION="$($NODE_BIN --version)"
echo "Node:  $NODE_BIN ($NODE_VERSION)"

# 2. Build the project
echo ""
echo "Building App Hub..."
cd "$APPHUB_ROOT"
npm run build
echo "Build complete."

# 3. Verify build output exists
BUILD_DIR="$APPHUB_ROOT/packages/hub/build"
if [[ ! -d "$BUILD_DIR" ]]; then
  echo "Error: Build output not found at $BUILD_DIR"
  exit 1
fi

# 4. Create log directory
mkdir -p "$LOG_DIR"

# 5. Stop existing service if running
if launchctl list 2>/dev/null | grep -q "$PLIST_NAME"; then
  echo "Stopping existing service..."
  launchctl bootout "gui/$(id -u)/$PLIST_NAME" 2>/dev/null || true
  sleep 1
fi

# 6. Generate the plist
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>

    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$BUILD_DIR</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$APPHUB_ROOT/packages/hub</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>APPHUB_PORT</key>
        <string>5174</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/hub.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/hub-error.log</string>
</dict>
</plist>
EOF

echo "Plist written to: $PLIST_PATH"

# 7. Load the service
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
echo ""
echo "=== App Hub service installed and started ==="
echo ""
echo "Commands:"
echo "  Start:   launchctl kickstart gui/$(id -u)/$PLIST_NAME"
echo "  Stop:    launchctl kill SIGTERM gui/$(id -u)/$PLIST_NAME"
echo "  Remove:  ./scripts/uninstall-service.sh"
echo "  Logs:    tail -f $LOG_DIR/hub.log"
echo "  Health:  curl -s http://localhost:5174/api/health | jq"
