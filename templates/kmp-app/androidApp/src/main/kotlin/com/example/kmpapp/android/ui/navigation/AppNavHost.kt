package com.example.kmpapp.android.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.kmpapp.android.ui.screen.HomeScreen
import com.example.kmpapp.android.ui.screen.LoginScreen
import com.example.kmpapp.android.ui.screen.SettingsScreen
import com.example.kmpapp.presentation.navigation.NavigationEvent
import com.example.kmpapp.presentation.navigation.Navigator
import com.example.kmpapp.presentation.navigation.Route
import org.koin.compose.koinInject

@Composable
fun AppNavHost(
    navigator: Navigator = koinInject()
) {
    val navController = rememberNavController()

    // Observe shared navigation events
    LaunchedEffect(navigator) {
        navigator.navigationEvents.collect { event ->
            when (event) {
                is NavigationEvent.NavigateTo -> {
                    navController.navigate(event.route.path) {
                        launchSingleTop = true
                    }
                }
                is NavigationEvent.GoBack -> {
                    navController.popBackStack()
                }
                is NavigationEvent.PopToRoot -> {
                    navController.popBackStack(Route.Home.path, inclusive = false)
                }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = Route.Login.path
    ) {
        composable(Route.Login.path) {
            LoginScreen(onLoginSuccess = {
                navController.navigate(Route.Home.path) {
                    popUpTo(Route.Login.path) { inclusive = true }
                }
            })
        }

        composable(Route.Home.path) {
            HomeScreen(
                onNavigateToSettings = {
                    navController.navigate(Route.Settings.path)
                }
            )
        }

        composable(Route.Settings.path) {
            SettingsScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
