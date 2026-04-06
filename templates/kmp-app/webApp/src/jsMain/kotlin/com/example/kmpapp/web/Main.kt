package com.example.kmpapp.web

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.CanvasBasedWindow
import com.example.kmpapp.di.platformModule
import com.example.kmpapp.di.sharedModules
import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.features.auth.presentation.LoginViewModel
import com.example.kmpapp.presentation.navigation.Navigator
import com.example.kmpapp.ui.App
import org.koin.core.context.startKoin
import org.koin.core.context.GlobalContext

/**
 * Web entry point — Compose Multiplatform for Web (Canvas-based).
 *
 * Uses the same shared composables as Android/iOS instead of
 * DOM-based Compose HTML. This means UI code is written once in
 * the shared module and rendered identically on all platforms.
 */
@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    // Initialize Koin DI
    startKoin {
        modules(sharedModules + platformModule)
    }

    val koin = GlobalContext.get()
    val loginViewModel = koin.get<LoginViewModel>()
    val navigator = koin.get<Navigator>()
    val authRepository = koin.get<AuthRepository>()

    CanvasBasedWindow(canvasElementId = "ComposeTarget", title = "KMP App") {
        App(
            loginViewModel = loginViewModel,
            navigator = navigator,
            authRepository = authRepository
        )
    }
}
