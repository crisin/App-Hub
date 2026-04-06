# KMP App Template — Claude Context

> **Auto-maintained.** When you make structural changes to this project (new modules, changed dependencies, new platform targets, architectural shifts), run the `update-claude-md` skill or update this file manually. Keep it accurate — future sessions depend on it.

## Quick Reference

```bash
# Build shared module (iOS + Web, no Android SDK needed)
./gradlew :shared:compileKotlinIosArm64 :shared:compileKotlinIosSimulatorArm64 :shared:compileKotlinIosX64 :shared:compileKotlinJs

# Build iOS framework (for Xcode)
./gradlew :shared:linkDebugFrameworkIosX64          # Intel Mac
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64  # Apple Silicon

# Generate Xcode project
cd iosApp && xcodegen generate && open iosApp.xcodeproj

# Build Android (requires Android SDK)
./gradlew :androidApp:assembleDebug

# Run web dev server
./gradlew :webApp:jsBrowserDevelopmentRun

# Run shared tests
./gradlew :shared:allTests

# Full setup from scratch (macOS)
chmod +x setup.sh && ./setup.sh
```

**Java note:** This project requires JDK 17+. On macOS with Homebrew's keg-only OpenJDK, `JAVA_HOME` must be set explicitly. `setup.sh` handles this — it writes `JAVA_HOME` to both `gradle.properties` AND `~/.zshrc` so it persists across terminal sessions. If `./gradlew` can't find Java, run `source ~/.zshrc` or set `export JAVA_HOME="/usr/local/opt/openjdk@17"` (Intel) / `export JAVA_HOME="/opt/homebrew/opt/openjdk@17"` (Apple Silicon).

**Android SDK is optional.** The build gracefully skips Android targets when no SDK is detected. The detection logic lives in `shared/build.gradle.kts` (checks `local.properties` → `ANDROID_HOME` → `ANDROID_SDK_ROOT`) and `settings.gradle.kts` (conditionally includes `:androidApp`).

---

## Architecture

This is a **Kotlin Multiplatform** project targeting iOS, Android, and Web from a single shared codebase. It follows **Clean Architecture** with shared business logic and platform-specific UI entry points.

### Module Layout

```
kmp-app-template/
├── shared/          # KMP shared module — domain, data, presentation logic for ALL platforms
├── androidApp/      # Android entry point — Jetpack Compose, depends on :shared
├── iosApp/          # iOS entry point — SwiftUI + XcodeGen, consumes shared.framework
├── webApp/          # Web entry point — Compose Multiplatform (Canvas-based), depends on :shared
├── gradle/          # Version catalog (libs.versions.toml) + wrapper
└── setup.sh         # One-command macOS bootstrap
```

### Shared Module Layers (Clean Architecture)

```
shared/src/commonMain/kotlin/com/example/kmpapp/
├── domain/           # Pure Kotlin — no framework dependencies
│   ├── models/       # AppResult<T>, User, AuthState, Location
│   ├── repository/   # Repository interfaces (AuthRepository, LocationRepository, etc.)
│   └── usecase/      # Use cases (LoginUseCase)
├── data/             # Implementation layer
│   ├── api/          # Pluggable API client (see "API Architecture" below)
│   ├── local/        # SQLDelight database, CacheManager, DatabaseDriverFactory (expect)
│   ├── mappers/      # DTO ↔ Domain mappers
│   └── repository/   # Repository implementations
├── presentation/     # Shared ViewModels and navigation
│   ├── viewmodel/    # BaseViewModel with StateFlow
│   └── navigation/   # Route sealed class + Navigator (SharedFlow-based)
├── ui/               # Shared Compose Multiplatform UI (used by all platforms)
│   ├── App.kt        # Root composable with Scaffold + stack navigation
│   ├── theme/        # AppTheme (Material 3 light/dark)
│   └── screen/       # LoginScreen, HomeScreen, SettingsScreen
├── features/         # Feature-specific presentation (auth/LoginViewModel)
├── platform/         # expect declarations for native capabilities
├── di/               # Koin DI modules
└── common/error/     # AppError sealed class hierarchy
```

### The expect/actual Pattern

Platform-specific capabilities use Kotlin's `expect`/`actual` mechanism. All `expect` declarations live in `shared/src/commonMain/kotlin/.../platform/`. Each platform provides `actual` implementations:

<!-- EXPECT_ACTUAL:START -->
| Expect Class | Android (androidMain) | iOS (iosMain) | Web (jsMain) |
|---|---|---|---|
| `PlatformContext` | `typealias Context` | Empty class | Empty class |
| `SecureStorageManager` | EncryptedSharedPreferences | Keychain (SecItem*) | localStorage (kmp_secure_ prefix) |
| `BiometricAuthManager` | AndroidX Biometric | LAContext (Face ID/Touch ID) | WebAuthn (stub) |
| `CameraManager` | CameraX | AVFoundation | getUserMedia |
| `LocationManager` | FusedLocationProvider | CLLocationManager | Geolocation API |
| `NotificationManager` | Firebase Cloud Messaging | APNs | Web Push API |
| `DatabaseDriverFactory` | AndroidSqliteDriver | NativeSqliteDriver | Not available (lazy, throws on use) |
<!-- EXPECT_ACTUAL:END -->

**When adding a new platform capability:** Create the `expect class` in `platform/`, then add `actual class` in each of `androidMain/`, `iosMain/`, `jsMain/` under the same package path. Wire it into the platform's Koin module (`PlatformModule.{platform}.kt`).

### API Architecture (Pluggable REST/GraphQL)

The API layer is designed to swap between REST and GraphQL with a single config change:

```
ApiClient (interface) ← RestApiClient (Ktor) OR GraphqlApiClient (Ktor)
     ↑ selected by                ↑ configured in
ApiBackendConfig (sealed)    KoinModules.kt (line ~32)
```

**To switch backends**, edit the `apiConfig` val in `shared/.../di/KoinModules.kt`:
```kotlin
// REST (default):
val apiConfig = ApiBackendConfig.Rest(baseUrl = "https://api.example.com/v1", timeout = 30_000L, retryCount = 3)
// GraphQL:
val apiConfig = ApiBackendConfig.GraphQL(baseUrl = "https://api.example.com/graphql", timeout = 30_000L)
```

**Interceptor chain** (applied in order): LoggingInterceptor → RetryInterceptor → AuthInterceptor. The AuthInterceptor reads tokens from SecureStorageManager.

### Dependency Injection (Koin)

All DI is in `shared/.../di/KoinModules.kt`. Modules: `networkModule`, `databaseModule`, `repositoryModule`, `useCaseModule`, `viewModelModule`, `navigationModule`. Each platform adds its own `platformModule` (an `expect val` with `actual` in each platform's `di/` folder).

**Initialization:**
- Android: `KmpApp.kt` (Application class) calls `startKoin { modules(sharedModules + platformModule) }`
- iOS: `KoinIosHelper.kt` exposes `initKoinIos()`, called from `KmpAppApp.swift`
- Web: `Main.kt` initializes Koin before `CanvasBasedWindow` (Compose Multiplatform for Web)

### Navigation

Shared `Navigator` emits `NavigationEvent` via `SharedFlow`. Routes are defined in the `Route` sealed class. After login, a **bottom navigation bar** provides tabs for the main screens. Each platform consumes events in its own navigation framework.

**Routes:** Splash, Login, **Home**, **Camera**, **Components**, **Notifications**, Settings, Detail(id).

**Bottom nav tabs:** Home (dashboard), Camera/Photos (image gallery with add/delete), Components (UI kit with all Material 3 controls), Notifications (push notification testing). Settings is accessed from Home's top bar.

**Session restore:** App starts at Splash, checks `authRepository.isLoggedIn()`, then navigates to Home (if session exists) or Login.

### Database (SQLDelight)

Schema in `shared/src/commonMain/sqldelight/.../AppDatabase.sq`. Three tables: `UserEntity`, `CacheEntry` (TTL-based), `AuthToken`. The `CacheManager` wraps this with generic JSON caching using `kotlinx.datetime.Clock` for TTL expiry.

---

## Key Dependencies (libs.versions.toml)

<!-- DEPS:START -->
| Library | Version | Purpose |
|---|---|---|
| Kotlin | 2.1.20 | Language + compiler |
| Compose Multiplatform | 1.8.0 | Shared UI framework (Canvas-based on web) |
| Ktor | 3.1.1 | HTTP client (all platforms) |
| SQLDelight | 2.0.2 | Cross-platform database (not available on web) |
| Koin | 4.0.4 | Dependency injection |
| kotlinx.coroutines | 1.10.1 | Async/concurrency |
| kotlinx.serialization | 1.8.0 | JSON serialization |
| Napier | 2.7.1 | Multiplatform logging |
<!-- DEPS:END -->

---

## Conventions

- **Package:** `com.example.kmpapp` (rename via find-replace when adapting to a new app)
- **Kotlin style:** `kotlin.code.style=official` in gradle.properties
- **Source set hierarchy:** Uses `kotlin.mpp.applyDefaultHierarchyTemplate=true`, so `iosMain` is auto-created as a shared source set for all iOS targets
- **Framework name:** The iOS framework is called `shared` (static framework). Configure in `shared/build.gradle.kts` under `binaries.framework`
- **Error handling:** All operations return `AppResult<T>` (Success/Error), never throw. Use `map`/`flatMap` for chaining.
- **Sealed classes everywhere:** Routes, API config, auth state, errors — all use sealed class hierarchies for exhaustive when-matching

## Architectural Decisions

ADRs are tracked in `docs/adr/`. Read these before proposing alternatives to existing choices — the decision may already have been evaluated.

---

## Common Tasks for Claude

### Adding a new feature
1. Define domain models in `domain/models/`
2. Define repository interface in `domain/repository/`
3. Create use case in `domain/usecase/`
4. Implement repository in `data/repository/`
5. Add DTOs in `data/api/dto/` and mappers in `data/mappers/`
6. Create ViewModel in `features/{feature}/presentation/`
7. Add Route to `Route.kt` sealed class
8. Wire everything in `KoinModules.kt`
9. Build shared UI screen in `presentation/screen/` or `ui/screen/`

### Adding a new platform capability
1. Create `expect class` in `shared/.../platform/`
2. Implement `actual class` in `androidMain/`, `iosMain/`, `jsMain/`
3. Add to each platform's `PlatformModule`
4. Add necessary permissions (AndroidManifest.xml, Info.plist)

### Adapting this template for a new app idea
1. Find-replace `com.example.kmpapp` with your package name
2. Update `apiConfig` in `KoinModules.kt` with your API endpoint
3. Replace domain models, DTOs, and mappers for your data
4. Swap out screens and routes
5. Update app names in AndroidManifest.xml, Info.plist, project.yml

---

## Build Pitfalls & Gotchas

Hard-won lessons from getting this template to actually build and run. Read these before modifying the build system.

### Gradle / Kotlin Multiplatform

- **NEVER put `android.library` in the shared module's `plugins {}` block** — even with `apply false`, it causes AGP to register Android tasks (`extractDebugAnnotations`) during configuration, breaking builds without the Android SDK. The plugin is on the classpath from the root `build.gradle.kts`; apply it conditionally with `apply(plugin = "com.android.library")`.
- **Compose Multiplatform plugin shadows `java.*` in build scripts** — `java.io.File` and `java.util.Properties` won't resolve. Use aliased imports: `import java.io.File as JFile`.
- **`org.gradle.java.home` in gradle.properties does NOT help `gradlew` find Java** — `gradlew` needs `JAVA_HOME` or `java` on PATH to start the JVM before it reads any properties. The setup script writes `JAVA_HOME` to `~/.zshrc` for this reason.
- **Compose MP Canvas for JS is experimental** — requires `org.jetbrains.compose.experimental.jscanvas.enabled=true` in `gradle.properties`.
- **Kotlin/Native iOS compilation requires macOS** — CI must run iOS compile tasks on `macos-latest`, not `ubuntu-latest`. The `build-shared` CI job only builds the JS target on Linux.

### iOS / Xcode

- **Static KMP framework needs `libsqlite3.tbd` linked by the app** — SQLDelight's `NativeSqliteDriver` uses SQLite but the static framework doesn't bundle it. Without this, you get ~20 "Undefined symbol: _sqlite3_*" linker errors. Added via XcodeGen's `dependencies: - sdk: libsqlite3.tbd`.
- **Info.plist must have `CFBundleName`** — physical devices refuse to install the app without it. Simulators are more lenient. Also needs `CFBundleExecutable`, `CFBundlePackageType`, `CFBundleVersion`, `CFBundleShortVersionString`.
- **Xcode pre-build script can't find Java** — Xcode doesn't inherit the user's shell environment (`~/.zshrc`). The pre-build script in `project.yml` auto-detects `JAVA_HOME` from common Homebrew paths (`/opt/homebrew/opt/openjdk@17`, `/usr/local/opt/openjdk@17`).
- **`embedAndSignAppleFrameworkForXcode` output path** — outputs to `shared/build/xcode-frameworks/$(CONFIGURATION)/$(SDK_NAME)/shared.framework`. The `FRAMEWORK_SEARCH_PATHS` build setting must point there, not to `XCFrameworks/`.
- **iOS deployment target must be 17.0+** — `onChange(of:initial:_:)` (two-parameter closure) requires iOS 17. Set in `iosApp/project.yml` under `deploymentTarget`.
- **Kotlin/Native exports `initKoinIos()` as `doInitKoinIos()` in Swift** — the `do` prefix is added to avoid clashing with Obj-C `init*` selector naming. This is correct behavior, not a bug.
- **Swift can't call Kotlin reified generics** — use typed helper functions in `KoinIosHelper.kt` (e.g., `fun loginViewModel(): LoginViewModel = KoinPlatform.getKoin().get()`).
- **Swift can't collect Kotlin StateFlow** — use `FlowObserver<T>` (in `shared/src/iosMain/.../util/FlowHelper.kt`) which wraps collection in a coroutine and calls a Swift callback on each emission.
- **Keychain C interop types** — `SecItemCopyMatching` expects `CFTypeRefVar`, not `ObjCObjectVar`. Needs `@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)`.
- **Keychain queries must use CFDictionary, not Kotlin Map or NSDictionary** — Security framework constants (`kSecClass`, `kSecAttrService`, etc.) are `CFStringRef` pointers. Kotlin's `mapOf()` creates a `HashMap` (not bridgeable to `CFDictionaryRef`). `NSMutableDictionary.setValue(forKey: String)` requires Kotlin `String` keys, but `CFStringRef` can't be cast to `String`. The working approach: `CFDictionaryCreateMutable` + `CFDictionaryAddValue` which accepts raw `COpaquePointer` — no bridging needed for CF constants. Use `CFBridgingRetain()` for Kotlin/NSString values.
- **Info.plist must have `UILaunchScreen` key** — Without `<key>UILaunchScreen</key><dict/>` in Info.plist, iOS renders the app in legacy compatibility mode with visible letterboxing (a ~2cm gap below the tab bar). This is NOT caused by iOS 26 "liquid glass" styling — it's a missing plist key that triggers the old screen-size compatibility layer.
- **`.toggleStyle(.checkbox)` is macOS-only** — Using it in SwiftUI on iOS causes a compile error. Use the default toggle style instead.
- **Keyboard dismiss requires explicit handling** — SwiftUI doesn't dismiss the keyboard when tapping outside a text field by default. Add `.onTapGesture { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }` on the root view in the App struct.

### iOS Camera & Photo Implementation

The Photos tab (`CameraView.swift`) uses real native iOS APIs for image capture and selection:
- **Camera capture:** `CameraCaptureView` wraps `UIImagePickerController` with `.camera` source type. Only available on physical devices — button is disabled on simulator via `isSourceTypeAvailable(.camera)`.
- **Photo picker:** `PhotoPickerView` wraps `PHPickerViewController` (up to 10 images, images filter). Uses `DispatchGroup` to collect async `loadObject` results before calling the completion handler.
- **Local persistence:** `PhotoStore` saves JPEGs (0.8 quality) to `Documents/SavedPhotos/` and tracks metadata in `manifest.json`. On load, it filters out photos whose files no longer exist on disk.
- **Required Info.plist keys:** `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`.

### Web

- **SQLDelight is not available on web** — `DatabaseDriverFactory.js.kt` throws `UnsupportedOperationException`. The `databaseModule` in Koin uses lazy singletons (default), so it only crashes if a feature actually resolves `AppDatabase`. Don't add `createdAtStart = true` to the database module.
- **Web `SecureStorageManager` uses `localStorage` with `kmp_secure_` prefix** — not truly secure (XSS-accessible), but persists across sessions. For real auth, use httpOnly cookies from the backend.
- **Compose MP for Web renders to `<canvas>`** — the `index.html` needs `<canvas id="ComposeTarget">`, not `<div id="root">`. Old Compose HTML DOM files (`LoginContent.kt`, `HomeContent.kt`) are dead code.

### General

- **`setup.sh` shell detection** — uses `$SHELL` (user's login shell) not `$BASH_VERSION` (always set because the script shebang is `#!/bin/bash`). This ensures `JAVA_HOME` goes to `~/.zshrc` on macOS.
- **Android SDK detection is in 3 places** — `settings.gradle.kts`, `shared/build.gradle.kts`, `setup.sh`. They use the same logic (check `local.properties` → `ANDROID_HOME` → `ANDROID_SDK_ROOT`) but can theoretically disagree. Keep them in sync.
- **REST API body serialization** — `HttpRequestData.body` is for interceptor inspection only. The actual HTTP request uses Ktor's `setBody(body)` with `ContentNegotiation`, which handles `@Serializable` classes automatically. Never use `body?.toString()` for JSON.

## Demo Mode

The template ships with a **demo mode** (`useDemoMode = true` in `KoinModules.kt`) that replaces the real `AuthRepositoryImpl` with `DemoAuthRepository`. This lets the full login → home → settings → logout flow work without a backend.

**How it works:**
- `DemoAuthRepository` accepts any email/password, returns a fake `User` after an 800ms simulated delay
- Persists session tokens in `SecureStorageManager` (Keychain on iOS, localStorage on web)
- Biometric login restores the last stored session
- Logout clears all stored tokens and navigates to login

**To switch to a real backend:** Set `useDemoMode = false` in `shared/.../di/KoinModules.kt` and update `apiConfig` with your actual API endpoint.

## Known Limitations & TODOs

- Web platform managers (biometrics, camera, notifications) are mostly stubs
- RetryInterceptor tags requests but retry logic isn't fully wired in RestApiClient
- iOS SecureStorageManager uses Keychain — may need `kSecAttrAccessible` tuning for background access
- No integration tests yet — only `LoginUseCaseTest` in commonTest
- SQLDelight not available on web — database module is lazy, throws if a feature tries to use it
- Web app uses Compose Multiplatform Canvas rendering (not DOM) — requires WebGL support in the browser
- Settings rows are static placeholders — wire up navigation, toggles, or dialogs as needed

---

## Keeping This File Updated

This file is the single source of truth for any Claude session working on this project. Stale context leads to wrong assumptions and wasted iterations.

**Auto-update script:** `python3 scripts/update-claude-md.py --write` scans the codebase and refreshes the dependency table and expect/actual table (sections between `<!-- MARKER:START -->` / `<!-- MARKER:END -->` HTML comments). Safe to run anytime — it only touches marked sections.

**When to update (for Claude):** After completing any of these, update CLAUDE.md before ending the session:
- Adding/removing a Gradle module
- Adding/removing an `expect`/`actual` class
- Bumping dependency versions in `libs.versions.toml`
- Changing the navigation routes
- Adding/modifying a Koin module
- Changing the API architecture or adding interceptors
- Any structural change to the Clean Architecture layers

**How to update:** Either run the script for machine-scannable sections, or directly edit the relevant section of this file. Both are fine. The important thing is that the next Claude session starts with accurate context.
