package com.example.kmpapp.presentation.navigation

/**
 * Shared route definitions used across all platforms.
 *
 * Each platform maps these to its native navigation system:
 * - Android: Navigation Compose NavHost
 * - iOS: NavigationStack
 * - Web: Browser History API
 *
 * Bottom navigation tabs: Home, Camera, Components, Notifications.
 * Settings is accessed from Home's top bar.
 */
sealed class Route(val path: String) {
    data object Splash : Route("/splash")
    data object Login : Route("/login")
    data object Home : Route("/home")
    data object Camera : Route("/camera")
    data object Components : Route("/components")
    data object Notifications : Route("/notifications")
    data object Settings : Route("/settings")
    data class Detail(val id: String) : Route("/detail/$id")

    companion object {
        /** Bottom nav tabs — order determines tab position. */
        val bottomNavTabs = listOf(Home, Camera, Components, Notifications)

        fun fromPath(path: String): Route = when {
            path == "/splash" -> Splash
            path == "/login" -> Login
            path == "/home" -> Home
            path == "/camera" -> Camera
            path == "/components" -> Components
            path == "/notifications" -> Notifications
            path == "/settings" -> Settings
            path.startsWith("/detail/") -> Detail(path.removePrefix("/detail/"))
            else -> Home
        }
    }
}
