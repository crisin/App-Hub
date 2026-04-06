# Changelog

## 2026-04-03 — Project Review & Fixes

Comprehensive review and fix pass. All changes are documented inline with code comments
explaining the "why" behind each fix.

### Build System Fixes

- **Fixed: Android plugin leaks into non-Android builds** (`shared/build.gradle.kts`)
  Removed `alias(libs.plugins.android.library) apply false` from the shared module's
  `plugins {}` block. Even with `apply false`, declaring AGP there caused Gradle to
  register Android tasks (like `extractDebugAnnotations`) during configuration — breaking
  builds without the Android SDK. The plugin is already on the classpath from the root
  `build.gradle.kts`; the shared module now applies it conditionally with
  `apply(plugin = "com.android.library")`.

- **Fixed: `./gradlew` fails in new terminals** (`setup.sh`)
  The setup script found Java via Homebrew but only exported `JAVA_HOME` for its own
  process. The `org.gradle.java.home` property in `gradle.properties` doesn't help
  because `gradlew` needs Java on PATH just to start the JVM. Now persists `JAVA_HOME`
  to `~/.zshrc` (or `~/.bashrc`) so it survives across terminal sessions.

- **Fixed: CI workflow assumes Android SDK** (`.github/workflows/ci.yml`)
  `build-shared` job now only builds the JS target on `ubuntu-latest` (iOS requires
  macOS). `build-ios` compiles all three iOS architectures on `macos-latest` and doesn't
  depend on `build-shared`. Each CI job has comments explaining the setup.

- **Added Gradle parallel builds and caching** (`gradle.properties`)

### API Client Fixes

- **Fixed: REST body serialization used `toString()`** (`RestApiClient.kt`)
  `HttpRequestData.body` was set via `body?.toString()` which would produce
  `LoginRequestDto(email=..., password=...)` instead of JSON. The actual HTTP request
  uses Ktor's `setBody(body)` which correctly serializes via ContentNegotiation — the
  `HttpRequestData.body` field is now `null` (used only for interceptor inspection).

- **Fixed: GraphQL client invalid extension property** (`GraphqlApiClient.kt`)
  Replaced invalid class-scope `private val JsonElement.jsonObject` with the proper
  import from `kotlinx.serialization.json.jsonObject`.

### Web Platform — Compose Multiplatform Migration

- **Switched from Compose HTML to Compose Multiplatform for Web** (`webApp/`)
  The web app now uses Canvas-based rendering (`CanvasBasedWindow`) instead of
  DOM-based Compose HTML. This means **UI composables are shared across all platforms**
  rather than writing separate HTML layouts for web.

  - `webApp/build.gradle.kts` — Dependencies changed from `compose.html.core` to
    `compose.runtime`, `compose.foundation`, `compose.material3`, `compose.ui`
  - `webApp/src/jsMain/resources/index.html` — Changed from `<div id="root">` to
    `<canvas id="ComposeTarget">` for Canvas rendering
  - `webApp/src/jsMain/.../Main.kt` — Uses `CanvasBasedWindow` + shared `App()` composable
  - Removed `LoginContent.kt`, `HomeContent.kt` (replaced by shared composables)

- **Fixed: Web DatabaseDriverFactory crashed Koin** (`DatabaseDriverFactory.js.kt`)
  SQLDelight's web-worker-driver needs async init. Previously, `createDriver()` threw
  `NotImplementedError` and Koin's `databaseModule` called it eagerly at startup,
  crashing the web app immediately. Now the module uses lazy singleton creation (Koin's
  default) so it only throws if a feature actually tries to use the database.

- **Upgraded web SecureStorage from sessionStorage to localStorage**
  (`SecureStorageManager.js.kt`) — Tokens now persist across tab closes, matching
  Android/iOS behavior. Added `kmp_secure_` prefix to avoid conflicts.

### iOS Platform Fixes

- **Fixed: SecureStorage used NSUserDefaults (plaintext)** (`SecureStorageManager.ios.kt`)
  Replaced with iOS Keychain implementation using `SecItemAdd`/`SecItemCopyMatching`/
  `SecItemDelete`. Uses `CFTypeRefVar` for correct C interop types. Auth tokens are now
  encrypted at rest by the OS.

- **Fixed: undefined `_sqlite3_*` linker errors** (`iosApp/project.yml`)
  The shared KMP static framework uses SQLite but doesn't bundle it. Added
  `libsqlite3.tbd` as an SDK dependency via XcodeGen's `dependencies` section.

- **Fixed: Xcode pre-build script couldn't find Java** (`iosApp/project.yml`)
  Xcode doesn't inherit the user's shell environment. The pre-build script now
  auto-detects `JAVA_HOME` from common Homebrew paths before running `gradlew`.

- **Fixed: XcodeGen framework dependency path** (`iosApp/project.yml`)
  Replaced direct `shared.xcframework` path (which didn't exist) with
  `FRAMEWORK_SEARCH_PATHS` pointing to `$(SRCROOT)/../shared/build/xcode-frameworks/$(CONFIGURATION)/$(SDK_NAME)` — the actual output path of `embedAndSignAppleFrameworkForXcode`.

- **Added Koin factory helpers for Swift** (`KoinIosHelper.kt`)
  Swift can't use Kotlin's reified generics. Added typed helper functions
  `loginViewModel()` and `navigator()` that call `KoinPlatform.getKoin().get()`.

- **Added FlowObserver for Swift** (`FlowHelper.kt`, new in `iosMain`)
  Bridges Kotlin `StateFlow` to Swift callbacks — collects on `Dispatchers.Main`
  and calls a closure on each emission. Used by SwiftUI views to observe ViewModel state.

- **Wired SwiftUI views to shared ViewModel**:
  - `LoginView.swift` — Takes `LoginViewModel`, calls `onEmailChanged`/`onPasswordChanged`/
    `onLoginClicked`/`onBiometricLoginClicked`, observes state via `FlowObserver`.
  - `ContentView.swift` — Gets ViewModel and Navigator from Koin via typed helpers.
  - `HomeView.swift` — Added `onSettings` callback for Settings navigation.
  - `SettingsView.swift` — Added optional `onBack` callback.

- **Fixed: setup.sh wrote JAVA_HOME to wrong shell profile** (`setup.sh`)
  Used `$SHELL` (user's login shell, typically zsh on macOS) instead of `$BASH_VERSION`
  (always set because the script runs under `#!/bin/bash`).

### Shared UI Composables (New)

Added Compose Multiplatform UI composables in `shared/src/commonMain/.../ui/`:

- `App.kt` — Root composable with Scaffold, TopAppBar, and simple stack navigation
  driven by the shared `Navigator`. Used directly by the web app.
- `screen/LoginScreen.kt` — Material 3 login form bound to `LoginViewModel`
- `screen/HomeScreen.kt` — Placeholder home content
- `screen/SettingsScreen.kt` — Settings list with sign-out action
- `theme/AppTheme.kt` — Shared light/dark Material 3 color schemes

The shared module now applies `compose-multiplatform` and `kotlin-compose-compiler`
plugins and declares Compose dependencies in `commonMain`.

### Dependency Updates

| Library | Old | New |
|---------|-----|-----|
| Kotlin | 2.1.0 | 2.1.20 |
| Compose Multiplatform | 1.7.3 | 1.8.0 |
| AGP | 8.7.3 | 8.8.2 |
| Coroutines | 1.9.0 | 1.10.1 |
| Serialization | 1.7.3 | 1.8.0 |
| Ktor | 3.0.3 | 3.1.1 |
| Koin | 4.0.2 | 4.0.4 |
| DateTime | 0.6.1 | 0.6.2 |
| AndroidX Activity Compose | 1.9.3 | 1.10.0 |
| AndroidX Navigation | 2.8.5 | 2.8.9 |
| AndroidX Compose BOM | 2024.12.01 | 2025.03.00 |
| MockK | 1.13.13 | 1.13.16 |

### Known Limitations

These are documented as TODOs in the code:

- **iOS platform stubs**: Camera, Location, Notifications return errors/empty. Implement
  using AVFoundation, CoreLocation, UserNotifications when needed.
- **Web push notifications**: Not implemented. Needs Service Worker + PushManager.
- **Web biometric auth**: Not implemented. Needs WebAuthn/FIDO2 flow.
- **Web SQLDelight**: Not available. Use localStorage/IndexedDB for offline storage.
- **iOS SwiftUI views**: LoginView is wired to the shared LoginViewModel via
  `FlowObserver`, but the navigation doesn't yet observe the shared `Navigator`
  events — it uses local SwiftUI `@State` routing.
