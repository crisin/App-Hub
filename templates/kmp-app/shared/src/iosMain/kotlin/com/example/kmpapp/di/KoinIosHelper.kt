package com.example.kmpapp.di

import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.features.auth.presentation.LoginViewModel
import com.example.kmpapp.presentation.navigation.NavigationEvent
import com.example.kmpapp.presentation.navigation.Navigator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.koin.core.context.startKoin
import org.koin.mp.KoinPlatform

/**
 * Called from Swift to initialize Koin on iOS.
 *
 * Kotlin/Native exports this as `doInitKoinIos()` in Swift because
 * the "init" prefix clashes with Obj-C init selector naming.
 */
fun initKoinIos() {
    startKoin {
        modules(sharedModules + platformModule)
    }
}

/**
 * Factory accessors for Swift — Koin's inline reified generics
 * aren't available in Obj-C/Swift, so we expose typed helpers.
 */
fun loginViewModel(): LoginViewModel = KoinPlatform.getKoin().get()
fun navigator(): Navigator = KoinPlatform.getKoin().get()
fun authRepository(): AuthRepository = KoinPlatform.getKoin().get()

/**
 * Observes [Navigator] events and calls [onRoute] with the route path string.
 *
 * Returns a cancellation handle — call cancel() from Swift's onDisappear/deinit.
 *
 * Usage from Swift:
 *   let handle = KoinIosHelperKt.observeNavigation { routePath in
 *       self.currentRoute = routePath as! String
 *   }
 *   // later: handle.cancel()
 */
fun observeNavigation(onRoute: (String) -> Unit): NavigationHandle {
    val nav = KoinPlatform.getKoin().get<Navigator>()
    val scope = CoroutineScope(Dispatchers.Main)
    val job = scope.launch {
        nav.navigationEvents.collect { event ->
            when (event) {
                is NavigationEvent.NavigateTo -> onRoute(event.route.path)
                is NavigationEvent.GoBack -> onRoute("__back")
                is NavigationEvent.PopToRoot -> onRoute("/login")
            }
        }
    }
    return NavigationHandle(job)
}

/**
 * Cancellation handle for the navigation observer.
 * Call [cancel] when the SwiftUI view disappears.
 */
class NavigationHandle(private val job: Job) {
    fun cancel() { job.cancel() }
}

/**
 * Checks whether the user has an active session (stored auth token).
 *
 * Call from Swift on launch to decide between Login and Home.
 * The callback receives a Boolean — true if logged in.
 * Wraps the suspend function in a coroutine for Swift interop.
 */
fun checkSession(onResult: (Boolean) -> Unit) {
    val scope = CoroutineScope(Dispatchers.Main)
    scope.launch {
        val authRepo = KoinPlatform.getKoin().get<AuthRepository>()
        onResult(authRepo.isLoggedIn())
    }
}

/**
 * Performs logout: clears stored tokens and navigates to login.
 *
 * Call from Swift when the user taps "Sign Out" in Settings.
 * Wraps the suspend function in a coroutine for Swift interop.
 */
fun performLogout() {
    val scope = CoroutineScope(Dispatchers.Main)
    scope.launch {
        val authRepo = KoinPlatform.getKoin().get<AuthRepository>()
        authRepo.logout()
        val nav = KoinPlatform.getKoin().get<Navigator>()
        nav.popToRoot()
    }
}
