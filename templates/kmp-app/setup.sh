#!/bin/bash
#
# KMP App Template — One-command setup for macOS
#
# This script:
#   1. Checks prerequisites (JDK, Android SDK, etc.)
#   2. Bootstraps the Gradle wrapper
#   3. Builds what it can based on what's installed
#   4. Launches the web app in your browser
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; }
header()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ARCH=$(uname -m)
CAN_BUILD_ANDROID=false
CAN_BUILD_IOS=false
CAN_BUILD_WEB=false

header "KMP App Template — Setup"
echo "Detected: macOS $(sw_vers -productVersion 2>/dev/null || echo 'unknown'), $ARCH"
echo ""

# ─── Step 1: Check Java ────────────────────────────────────────
header "Checking prerequisites"

# Homebrew installs OpenJDK as "keg-only" — it won't be on PATH or visible
# to /usr/libexec/java_home unless we explicitly set JAVA_HOME.
# Check common Homebrew locations first.
BREW_JDK_PATHS=(
    "/usr/local/opt/openjdk@17"           # Intel Mac (Homebrew)
    "/opt/homebrew/opt/openjdk@17"         # Apple Silicon (Homebrew)
    "/usr/local/opt/openjdk"              # Intel Mac (latest)
    "/opt/homebrew/opt/openjdk"           # Apple Silicon (latest)
    "/usr/local/opt/openjdk@21"           # Intel Mac (21)
    "/opt/homebrew/opt/openjdk@21"        # Apple Silicon (21)
)

find_brew_java() {
    for jdk_path in "${BREW_JDK_PATHS[@]}"; do
        # Homebrew OpenJDK may have java at either:
        #   $jdk_path/bin/java  OR  $jdk_path/libexec/openjdk.jdk/Contents/Home/bin/java
        local java_bin=""
        local java_home_path=""
        if [ -f "$jdk_path/bin/java" ]; then
            java_bin="$jdk_path/bin/java"
            java_home_path="$jdk_path"
        elif [ -f "$jdk_path/libexec/openjdk.jdk/Contents/Home/bin/java" ]; then
            java_bin="$jdk_path/libexec/openjdk.jdk/Contents/Home/bin/java"
            java_home_path="$jdk_path/libexec/openjdk.jdk/Contents/Home"
        fi
        if [ -n "$java_bin" ]; then
            local ver
            ver=$("$java_bin" -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d. -f1)
            if [ -n "$ver" ] && [ "$ver" -ge 17 ] 2>/dev/null; then
                echo "$java_home_path"
                return 0
            fi
        fi
    done
    return 1
}

JAVA_FOUND=false

# First: check if java is already on PATH and is 17+
if java -version 2>&1 | grep -qE 'version "(1[7-9]|2[0-9])'; then
    JAVA_VER=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}')
    success "Java $JAVA_VER found on PATH"
    JAVA_FOUND=true
fi

# Second: check /usr/libexec/java_home (macOS native)
if [ "$JAVA_FOUND" = false ] && /usr/libexec/java_home -v 17+ &>/dev/null 2>&1; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 17+)
    export PATH="$JAVA_HOME/bin:$PATH"
    JAVA_VER=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}')
    success "Java $JAVA_VER found at $JAVA_HOME"
    JAVA_FOUND=true
fi

# Third: check Homebrew keg-only installs
if [ "$JAVA_FOUND" = false ]; then
    BREW_JDK=$(find_brew_java)
    if [ -n "$BREW_JDK" ]; then
        export JAVA_HOME="$BREW_JDK"
        export PATH="$JAVA_HOME/bin:$PATH"
        JAVA_VER=$("$JAVA_HOME/bin/java" -version 2>&1 | head -1 | awk -F '"' '{print $2}')
        success "Java $JAVA_VER found at $JAVA_HOME (Homebrew)"
        info "Tip: to make this permanent, add to your ~/.zshrc:"
        echo "  export JAVA_HOME=\"$JAVA_HOME\""
        echo "  export PATH=\"\$JAVA_HOME/bin:\$PATH\""
        JAVA_FOUND=true
    fi
fi

# Persist JAVA_HOME into gradle.properties so Gradle finds the JVM,
# AND into the user's shell profile so ./gradlew works in new terminals.
if [ "$JAVA_FOUND" = true ] && [ -n "${JAVA_HOME:-}" ]; then
    # gradle.properties — used by the Gradle daemon after startup
    if [ -f "gradle.properties" ]; then
        grep -v "^org.gradle.java.home=" gradle.properties > gradle.properties.tmp || true
        mv gradle.properties.tmp gradle.properties
    fi
    echo "org.gradle.java.home=$JAVA_HOME" >> gradle.properties
    success "Saved JAVA_HOME to gradle.properties"

    # Shell profile — needed so ./gradlew can START the JVM in new terminals.
    # gradle.properties alone isn't enough: gradlew needs java on PATH to launch.
    # Detect the user's LOGIN shell (not the script's shell — this runs under bash
    # due to the shebang, but the user likely uses zsh on macOS).
    USER_SHELL="$(basename "$SHELL")"
    if [ "$USER_SHELL" = "zsh" ]; then
        SHELL_RC="$HOME/.zshrc"
    else
        SHELL_RC="$HOME/.bashrc"
    fi
    MARKER="# KMP App Template — JAVA_HOME"
    if ! grep -q "$MARKER" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "$MARKER" >> "$SHELL_RC"
        echo "export JAVA_HOME=\"$JAVA_HOME\"" >> "$SHELL_RC"
        echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\"" >> "$SHELL_RC"
        success "Added JAVA_HOME to $SHELL_RC (takes effect in new terminals)"
    fi
fi

if [ "$JAVA_FOUND" = false ]; then
    error "Java 17+ is required but not found."
    echo ""
    echo "  If you just installed via Homebrew, it's keg-only."
    echo "  Try running this first, then re-run setup.sh:"
    echo ""
    echo "    export JAVA_HOME=/usr/local/opt/openjdk@17"
    echo "    export PATH=\"\$JAVA_HOME/bin:\$PATH\""
    echo ""
    echo "  Or install from: https://adoptium.net/"
    exit 1
fi

# ─── Step 2: Check Android SDK ─────────────────────────────────
if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
    success "Android SDK found at $ANDROID_HOME"
    CAN_BUILD_ANDROID=true
elif [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
    success "Android SDK found at $ANDROID_HOME"
    CAN_BUILD_ANDROID=true
elif [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    success "Android SDK found at $ANDROID_HOME (default location)"
    CAN_BUILD_ANDROID=true
else
    warn "Android SDK not found — skipping Android build"
    echo "  Install Android Studio to get the SDK, or set ANDROID_HOME"
fi

# Create local.properties for Android SDK path
if [ "$CAN_BUILD_ANDROID" = true ]; then
    echo "sdk.dir=$ANDROID_HOME" > local.properties
    success "Created local.properties with Android SDK path"
fi

# ─── Step 3: Check Xcode ───────────────────────────────────────
if command -v xcodebuild &>/dev/null; then
    XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1 || echo "unknown")
    success "$XCODE_VER found"
    if command -v xcodegen &>/dev/null; then
        success "xcodegen found"
        CAN_BUILD_IOS=true
    else
        warn "xcodegen not found — skipping iOS project generation"
        echo "  Install with: brew install xcodegen"
    fi
else
    warn "Xcode not found — skipping iOS build"
fi

# ─── Step 4: Web always works if Java works ─────────────────────
CAN_BUILD_WEB=true
success "Web build: ready (runs in browser)"

# ─── Summary ────────────────────────────────────────────────────
header "Build targets"
[ "$CAN_BUILD_ANDROID" = true ] && success "Android: ready" || warn "Android: skipped"
[ "$CAN_BUILD_IOS" = true ]     && success "iOS: ready"     || warn "iOS: skipped"
[ "$CAN_BUILD_WEB" = true ]     && success "Web: ready"     || warn "Web: skipped"

echo ""
read -p "Press Enter to start building, or Ctrl+C to cancel... "

# ─── Step 5: Bootstrap Gradle ───────────────────────────────────
header "Bootstrapping Gradle"

if [ ! -f "gradle/wrapper/gradle-wrapper.jar" ] || [ ! -s "gradle/wrapper/gradle-wrapper.jar" ]; then
    info "Bootstrapping Gradle wrapper..."

    WRAPPER_BOOTSTRAPPED=false

    # Strategy 1: Use system gradle if available
    if command -v gradle &>/dev/null; then
        info "Using system Gradle to generate wrapper..."
        gradle wrapper --gradle-version 8.11.1 && WRAPPER_BOOTSTRAPPED=true
    fi

    # Strategy 2: Install gradle via Homebrew (macOS)
    if [ "$WRAPPER_BOOTSTRAPPED" = false ] && command -v brew &>/dev/null; then
        info "Installing Gradle via Homebrew..."
        brew install gradle 2>/dev/null
        if command -v gradle &>/dev/null; then
            gradle wrapper --gradle-version 8.11.1 && WRAPPER_BOOTSTRAPPED=true
        fi
    fi

    # Strategy 3: Download full Gradle distribution
    if [ "$WRAPPER_BOOTSTRAPPED" = false ]; then
        info "Downloading Gradle 8.11.1 distribution..."
        TEMP_DIR=$(mktemp -d)
        curl -fSL -o "$TEMP_DIR/gradle.zip" "https://services.gradle.org/distributions/gradle-8.11.1-bin.zip"
        info "Extracting Gradle distribution..."
        unzip -q "$TEMP_DIR/gradle.zip" -d "$TEMP_DIR"
        # Debug: show what was extracted
        ls "$TEMP_DIR/gradle-8.11.1/bin/" 2>/dev/null || echo "  ⚠ bin/ directory not found, listing temp dir:" && ls "$TEMP_DIR/"
        if [ -f "$TEMP_DIR/gradle-8.11.1/bin/gradle" ]; then
            chmod +x "$TEMP_DIR/gradle-8.11.1/bin/gradle"
            "$TEMP_DIR/gradle-8.11.1/bin/gradle" wrapper --gradle-version 8.11.1 --project-dir "$SCRIPT_DIR" && WRAPPER_BOOTSTRAPPED=true
        fi
        rm -rf "$TEMP_DIR"
    fi

    if [ "$WRAPPER_BOOTSTRAPPED" = true ]; then
        success "Gradle wrapper generated"
    else
        error "Failed to bootstrap Gradle wrapper."
        echo "  Please run manually:"
        echo "    brew install gradle"
        echo "    cd $SCRIPT_DIR && gradle wrapper --gradle-version 8.11.1"
        exit 1
    fi
else
    success "Gradle wrapper jar already present"
fi

# Make gradlew executable
chmod +x gradlew

# ─── Step 6: Build shared module ────────────────────────────────
header "Building shared module"
info "This may take a few minutes on first run (downloading dependencies)..."

# Build only the targets we can actually build.
# Each compile task is listed explicitly so Gradle doesn't try to
# resolve Android tasks when the SDK isn't available.
SHARED_TASKS=":shared:compileKotlinJs"
if [ "$CAN_BUILD_IOS" = true ]; then
    if [ "$ARCH" = "arm64" ]; then
        SHARED_TASKS="$SHARED_TASKS :shared:compileKotlinIosSimulatorArm64 :shared:compileKotlinIosArm64"
    else
        SHARED_TASKS="$SHARED_TASKS :shared:compileKotlinIosX64 :shared:compileKotlinIosArm64"
    fi
fi
if [ "$CAN_BUILD_ANDROID" = true ]; then
    SHARED_TASKS="$SHARED_TASKS :shared:compileKotlinAndroid"
fi

if ./gradlew $SHARED_TASKS --no-daemon; then
    success "Shared module built"
else
    error "Shared module build failed. Run './gradlew $SHARED_TASKS --stacktrace' for details."
    exit 1
fi

# ─── Step 7: Build Android (if available) ───────────────────────
if [ "$CAN_BUILD_ANDROID" = true ]; then
    header "Building Android app"
    ./gradlew :androidApp:assembleDebug --no-daemon 2>&1 | tail -5
    APK_PATH="androidApp/build/outputs/apk/debug/androidApp-debug.apk"
    if [ -f "$APK_PATH" ]; then
        success "Android APK built: $APK_PATH"
    else
        warn "Android build completed but APK not found at expected path"
    fi
fi

# ─── Step 8: Build and run Web ──────────────────────────────────
if [ "$CAN_BUILD_WEB" = true ]; then
    header "Building and launching Web app"
    info "Building web app..."
    ./gradlew :webApp:jsBrowserDevelopmentRun --no-daemon &
    WEB_PID=$!

    # Wait for dev server to start
    info "Waiting for dev server to start..."
    for i in $(seq 1 60); do
        if curl -s http://localhost:8080 >/dev/null 2>&1; then
            success "Web app running at http://localhost:8080"
            # Open in browser
            open "http://localhost:8080"
            break
        fi
        sleep 2
    done

    echo ""
    header "Setup Complete!"
    echo ""
    [ "$CAN_BUILD_ANDROID" = true ] && success "Android APK: androidApp/build/outputs/apk/debug/"
    [ "$CAN_BUILD_IOS" = true ]     && info "iOS: run 'cd iosApp && ./setup.sh' then open in Xcode"
    success "Web: running at http://localhost:8080"
    echo ""
    info "Press Ctrl+C to stop the web dev server"

    # Keep script alive while web server runs
    wait $WEB_PID 2>/dev/null || true
else
    header "Setup Complete!"
fi
