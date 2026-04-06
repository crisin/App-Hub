#!/bin/bash
#
# iOS project setup script.
# Generates the Xcode project using xcodegen.
#
# Prerequisites:
#   brew install xcodegen
#
# Usage:
#   cd iosApp && ./setup.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check for xcodegen
if ! command -v xcodegen &>/dev/null; then
    echo "Error: xcodegen is not installed."
    echo "Install it with: brew install xcodegen"
    exit 1
fi

# Detect architecture for correct iOS simulator target
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    FRAMEWORK_TARGET="linkDebugFrameworkIosSimulatorArm64"
else
    FRAMEWORK_TARGET="linkDebugFrameworkIosX64"
fi

# Build the shared framework first so Xcode can find it
echo "Building shared Kotlin framework for $ARCH..."
cd ..
./gradlew :shared:$FRAMEWORK_TARGET
cd "$SCRIPT_DIR"

# Generate Xcode project
echo "Generating Xcode project..."
xcodegen generate

echo ""
echo "Done! Open iosApp.xcodeproj in Xcode."
echo "  open iosApp.xcodeproj"
