package com.example.kmpapp.ui

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.features.auth.presentation.LoginViewModel
import com.example.kmpapp.presentation.navigation.NavigationEvent
import com.example.kmpapp.presentation.navigation.Navigator
import com.example.kmpapp.presentation.navigation.Route
import com.example.kmpapp.ui.screen.CameraScreen
import com.example.kmpapp.ui.screen.ComponentsScreen
import com.example.kmpapp.ui.screen.HomeScreen
import com.example.kmpapp.ui.screen.LoginScreen
import com.example.kmpapp.ui.screen.NotificationsScreen
import com.example.kmpapp.ui.screen.SettingsScreen
import com.example.kmpapp.ui.screen.SplashScreen
import com.example.kmpapp.ui.theme.AppTheme
import kotlinx.coroutines.launch

/**
 * Shared root composable for the entire app — used by Web directly
 * and optionally by Android/iOS for a fully shared UI.
 *
 * After login, shows a bottom navigation bar with tabs:
 * Home, Camera, Components, Notifications.
 * Settings is accessed from Home's top bar action.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(
    loginViewModel: LoginViewModel,
    navigator: Navigator,
    authRepository: AuthRepository,
    darkTheme: Boolean = false
) {
    AppTheme(darkTheme = darkTheme) {
        val backStack = remember { mutableStateListOf<Route>(Route.Splash) }
        var currentRoute by remember { mutableStateOf<Route>(Route.Splash) }
        val coroutineScope = rememberCoroutineScope()

        // Session check on startup
        LaunchedEffect(Unit) {
            val loggedIn = authRepository.isLoggedIn()
            val target = if (loggedIn) Route.Home else Route.Login
            backStack.clear()
            backStack.add(target)
            currentRoute = target
        }

        // Observe navigation events from the shared Navigator
        LaunchedEffect(navigator) {
            navigator.navigationEvents.collect { event ->
                when (event) {
                    is NavigationEvent.NavigateTo -> {
                        backStack.add(event.route)
                        currentRoute = event.route
                    }
                    is NavigationEvent.GoBack -> {
                        if (backStack.size > 1) {
                            backStack.removeLastOrNull()
                            currentRoute = backStack.last()
                        }
                    }
                    is NavigationEvent.PopToRoot -> {
                        backStack.clear()
                        backStack.add(Route.Login)
                        currentRoute = Route.Login
                    }
                }
            }
        }

        // Whether the current route is a logged-in screen (shows bottom nav + top bar)
        val isAuthenticated = currentRoute != Route.Splash && currentRoute != Route.Login
        val isBottomNavTab = currentRoute in Route.bottomNavTabs

        Scaffold(
            topBar = {
                if (isAuthenticated) {
                    CenterAlignedTopAppBar(
                        title = {
                            Text(
                                when (currentRoute) {
                                    is Route.Home -> "Home"
                                    is Route.Camera -> "Photos"
                                    is Route.Components -> "Components"
                                    is Route.Notifications -> "Notifications"
                                    is Route.Settings -> "Settings"
                                    else -> ""
                                }
                            )
                        },
                        navigationIcon = {
                            // Back button for non-tab screens (e.g. Settings)
                            if (!isBottomNavTab && backStack.size > 1) {
                                TextButton(onClick = { navigator.goBack() }) {
                                    Text("\u2190 Back")
                                }
                            }
                        },
                        actions = {
                            if (currentRoute == Route.Home) {
                                TextButton(onClick = { navigator.navigateTo(Route.Settings) }) {
                                    Text("Settings")
                                }
                            }
                        }
                    )
                }
            },
            bottomBar = {
                if (isAuthenticated && (isBottomNavTab || currentRoute == Route.Settings)) {
                    BottomNavBar(
                        currentRoute = if (isBottomNavTab) currentRoute else Route.Home,
                        onTabSelected = { tab ->
                            // Tab switches replace the stack (no back to previous tab)
                            backStack.clear()
                            backStack.add(tab)
                            currentRoute = tab
                        }
                    )
                }
            }
        ) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                Crossfade(targetState = currentRoute) { route ->
                    when (route) {
                        is Route.Splash -> SplashScreen()
                        is Route.Login -> LoginScreen(viewModel = loginViewModel)
                        is Route.Home -> HomeScreen()
                        is Route.Camera -> CameraScreen()
                        is Route.Components -> ComponentsScreen()
                        is Route.Notifications -> NotificationsScreen()
                        is Route.Settings -> SettingsScreen(
                            onLogout = {
                                coroutineScope.launch {
                                    authRepository.logout()
                                    backStack.clear()
                                    backStack.add(Route.Login)
                                    currentRoute = Route.Login
                                }
                            }
                        )
                        else -> HomeScreen()
                    }
                }
            }
        }
    }
}

/**
 * Bottom navigation bar with labeled tabs.
 *
 * Uses text labels instead of icons to avoid pulling in the
 * material-icons dependency. Replace with Icon() if you add
 * compose.material.icons to shared/build.gradle.kts.
 */
@Composable
private fun BottomNavBar(
    currentRoute: Route,
    onTabSelected: (Route) -> Unit
) {
    val tabs = listOf(
        Route.Home to "\uD83C\uDFE0 Home",
        Route.Camera to "\uD83D\uDCF7 Photos",
        Route.Components to "\uD83E\uDDE9 UI Kit",
        Route.Notifications to "\uD83D\uDD14 Alerts"
    )

    NavigationBar {
        tabs.forEach { (route, label) ->
            NavigationBarItem(
                selected = currentRoute == route,
                onClick = { onTabSelected(route) },
                label = { Text(label) },
                icon = {} // No icon — using emoji in label instead
            )
        }
    }
}
