# Developer Setup Guide

This guide walks you through setting up the KMP App Template on your local machine and running it on each platform.

## Prerequisites

**Required for all platforms:**
- JDK 17+ (recommended: [Temurin](https://adoptium.net/) or Homebrew `openjdk@17`)

**For Android (optional):**
- Android Studio 2024.2+ (Ladybug or newer) with Kotlin Multiplatform plugin
- Android SDK (API 35)
- Android Emulator or physical device (API 26+)

**For iOS (macOS only):**
- Xcode 15+
- [xcodegen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`
- iOS Simulator or physical device (iOS 17+)

**For Web:**
- A modern browser (Chrome, Firefox, Safari)

> **Note:** Android SDK is optional. The build system auto-detects its availability and
> disables Android targets when not found. iOS + Web work without it.

## Quick Start

```bash
chmod +x setup.sh && ./setup.sh
```

This script:
1. Finds or sets up Java (persists `JAVA_HOME` to your shell profile)
2. Detects which platforms you can build (Android, iOS, Web)
3. Bootstraps the Gradle wrapper
4. Builds the shared module
5. Launches the web app in your browser

## Running on iOS (macOS only)

### First-time setup

```bash
cd iosApp
chmod +x setup.sh
./setup.sh
```

This builds the shared Kotlin framework and generates the Xcode project.

### From Xcode

```bash
open iosApp/iosApp.xcodeproj
```

1. Select the `iosApp` scheme
2. Choose an iOS Simulator (e.g. iPhone 12 mini)
3. Click Run (`Cmd+R`)

Xcode's pre-build script automatically rebuilds the Kotlin framework when shared code changes.

### Running on a physical iPhone/iPad

1. Connect your device via USB cable
2. In Xcode, select your device from the scheme toolbar (top center)
3. Go to **Signing & Capabilities** tab and select your **Development Team** (your Apple ID works — no paid account needed)
4. If prompted on your device, tap **Trust** and enter your passcode
5. Enable **Developer Mode** on your device: Settings → Privacy & Security → Developer Mode
6. Click Run (`Cmd+R`)

The first build takes longer because Gradle compiles the shared framework for arm64 (physical device architecture).

## Running on Web

```bash
# Development server with hot reload
./gradlew :webApp:jsBrowserDevelopmentRun

# Production build
./gradlew :webApp:jsBrowserProductionWebpack
```

Dev server runs at `http://localhost:8080`. The web app uses **Compose Multiplatform for Web**
(Canvas-based), sharing the same UI composables as iOS and Android.

## Running on Android

### From Android Studio (recommended)

1. Open the project in Android Studio
2. Select the `androidApp` run configuration
3. Choose an emulator or connected device
4. Click Run (`Shift+F10`)

### From the command line

```bash
./gradlew :androidApp:assembleDebug
./gradlew :androidApp:installDebug
```

## Architecture

```
kmp-app-template/
├── shared/                  # KMP shared module (all platforms)
│   ├── src/commonMain/      #   Shared code: domain, data, DI, UI composables
│   │   └── .../ui/          #   ← Shared Compose Multiplatform screens
│   ├── src/androidMain/     #   Android-specific implementations
│   ├── src/iosMain/         #   iOS-specific implementations
│   └── src/jsMain/          #   Web-specific implementations
├── androidApp/              # Android app (Jetpack Compose, wraps shared UI)
├── iosApp/                  # iOS app (SwiftUI, embeds shared framework)
└── webApp/                  # Web app (Compose MP Canvas, uses shared UI directly)
```

### Shared UI

UI composables live in `shared/src/commonMain/.../ui/` and are used by all platforms:

- `App.kt` — Root composable with navigation
- `screen/LoginScreen.kt` — Login form bound to `LoginViewModel`
- `screen/HomeScreen.kt` — Main content screen
- `screen/SettingsScreen.kt` — Settings with sign-out
- `theme/AppTheme.kt` — Shared Material 3 theme

### Platform integration

- **Web**: Uses shared `App()` composable directly via `CanvasBasedWindow`
- **Android**: Can use shared composables or platform-native Jetpack Compose
- **iOS**: SwiftUI views that embed the shared Kotlin framework

## Configuring Your API

Edit `shared/src/commonMain/kotlin/com/example/kmpapp/di/KoinModules.kt`:

```kotlin
val apiConfig: ApiBackendConfig = ApiBackendConfig.Rest(
    baseUrl = "https://your-api.com/v1"
)
```

Switch to GraphQL:
```kotlin
val apiConfig: ApiBackendConfig = ApiBackendConfig.GraphQL(
    baseUrl = "https://your-api.com/graphql"
)
```

## Renaming the Package

1. Replace `com.example.kmpapp` with your package name globally
2. Rename directory structure under `shared/src/*/kotlin/` to match
3. Update `androidApp/build.gradle.kts` → `applicationId`
4. Update `iosApp/project.yml` → `bundleIdPrefix` and `PRODUCT_BUNDLE_IDENTIFIER`
5. Update `androidApp/src/main/res/values/strings.xml` → `app_name`

## Platform Notes

### Web: No SQLDelight

SQLDelight's JS driver requires async initialization that doesn't fit the synchronous
`createDriver()` API. On web, the database module is registered lazily — it only throws
if a feature actually tries to use it. For offline caching on web, use `localStorage`
or `IndexedDB` directly.

### iOS: Keychain Storage

Auth tokens are stored in the iOS Keychain (encrypted at rest).
Previous versions used `NSUserDefaults` (plaintext) — this has been fixed.

### Web: localStorage Storage

Auth tokens use `localStorage` with a `kmp_secure_` prefix. For production apps,
consider HttpOnly cookies set by your backend (not accessible to JS).

## Running Tests

```bash
./gradlew :shared:jsTest          # Shared tests (JS target)
./gradlew :shared:allTests        # All targets
./gradlew :androidApp:testDebugUnitTest  # Android unit tests
./gradlew :androidApp:lintDebug         # Android lint
```

## Common Issues

**`./gradlew` says "Unable to locate a Java Runtime":**
Run `source ~/.zshrc` to pick up JAVA_HOME, or re-run `./setup.sh`.

**Build fails with "SDK location not found":**
The Android SDK wasn't detected. This is fine — iOS and Web build without it.
If you want Android, install Android Studio and set `ANDROID_HOME`.

**iOS build fails with "framework not found shared":**
Run `cd iosApp && ./setup.sh` to build the framework and generate the Xcode project.

**Web app shows blank page:**
Check browser console for errors. The web app uses Canvas-based rendering — ensure
your browser supports WebGL.
