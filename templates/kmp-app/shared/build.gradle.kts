import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File as JFile
import java.util.Properties as JProperties

// Detect if Android SDK is available.
// Uses aliased imports because the Compose Multiplatform plugin
// shadows the `java` package namespace in build scripts.
val androidSdkAvailable: Boolean = run {
    val localProps = rootProject.file("local.properties")
    if (localProps.exists()) {
        val props = JProperties()
        localProps.inputStream().use { props.load(it) }
        val sdkDir = props.getProperty("sdk.dir")
        sdkDir != null && JFile(sdkDir).exists()
    } else {
        val androidHome = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
        androidHome != null && JFile(androidHome).exists()
    }
}

if (androidSdkAvailable) {
    logger.lifecycle("Android SDK detected — enabling Android target")
} else {
    logger.lifecycle("Android SDK not found — Android target disabled (iOS + Web only)")
}

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose.compiler)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.sqldelight)
    // NOTE: android.library is NOT declared here — it's on the classpath via root build.gradle.kts.
    // Declaring it here (even with apply false) causes AGP to register Android tasks
    // before the SDK-availability check can prevent it, breaking builds without Android SDK.
}

// Conditionally apply the Android library plugin only when the SDK is present.
// The plugin is already on the classpath from the root project's plugins block.
if (androidSdkAvailable) {
    apply(plugin = "com.android.library")
}

kotlin {
    if (androidSdkAvailable) {
        androidTarget {
            compilerOptions {
                jvmTarget.set(JvmTarget.JVM_17)
            }
        }
    }

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach {
        it.binaries.framework {
            baseName = "shared"
            isStatic = true
        }
    }

    // Kotlin/JS target for Compose Multiplatform for Web (Canvas-based).
    // Uses wasmJs for future Wasm migration readiness, but currently compiles to JS.
    js(IR) {
        browser()
    }

    sourceSets {
        commonMain.dependencies {
            // Compose Multiplatform — shared UI composables across all platforms
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)

            // Coroutines
            implementation(libs.kotlinx.coroutines.core)

            // Serialization
            implementation(libs.kotlinx.serialization.json)

            // DateTime
            implementation(libs.kotlinx.datetime)

            // Ktor
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.client.serialization)
            implementation(libs.ktor.client.logging)

            // SQLDelight
            implementation(libs.sqldelight.runtime)
            implementation(libs.sqldelight.coroutines)

            // Koin
            implementation(libs.koin.core)

            // Logging
            implementation(libs.napier)
        }

        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
            implementation(libs.koin.test)
            implementation(libs.turbine)
        }

        if (androidSdkAvailable) {
            androidMain.dependencies {
                implementation(libs.ktor.client.android)
                implementation(libs.sqldelight.android.driver)
                implementation(libs.koin.android)
                implementation(libs.kotlinx.coroutines.android)

                // Native features
                implementation(libs.androidx.biometric)
                implementation(libs.androidx.security.crypto)
                implementation(libs.androidx.camera.core)
                implementation(libs.androidx.camera.camera2)
                implementation(libs.androidx.camera.lifecycle)
                implementation(libs.androidx.camera.view)
                implementation(libs.play.services.location)
                implementation(libs.firebase.messaging)
            }
        }

        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
            implementation(libs.sqldelight.native.driver)
        }

        jsMain.dependencies {
            implementation(libs.ktor.client.js)
            implementation(libs.sqldelight.js.driver)
        }
    }
}

if (androidSdkAvailable) {
    extensions.configure<com.android.build.gradle.LibraryExtension> {
        namespace = "com.example.kmpapp.shared"
        compileSdk = 35

        defaultConfig {
            minSdk = 26
        }

        compileOptions {
            sourceCompatibility = JavaVersion.VERSION_17
            targetCompatibility = JavaVersion.VERSION_17
        }
    }
}

sqldelight {
    databases {
        create("AppDatabase") {
            packageName.set("com.example.kmpapp.data.local")
        }
    }
}
