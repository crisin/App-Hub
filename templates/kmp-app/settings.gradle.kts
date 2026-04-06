rootProject.name = "kmp-app-template"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":shared")
include(":webApp")

// Only include androidApp if Android SDK is available
val localProps = file("local.properties")
val androidSdkAvailable = if (localProps.exists()) {
    val props = java.util.Properties().apply { localProps.inputStream().use { load(it) } }
    val sdkDir = props.getProperty("sdk.dir")
    sdkDir != null && java.io.File(sdkDir).exists()
} else {
    val androidHome = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
    androidHome != null && java.io.File(androidHome).exists()
}

if (androidSdkAvailable) {
    include(":androidApp")
}
