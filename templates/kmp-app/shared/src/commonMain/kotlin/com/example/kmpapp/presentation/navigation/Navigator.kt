package com.example.kmpapp.presentation.navigation

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Shared navigation controller.
 *
 * Emits navigation events that platform-specific navigators consume.
 * This decouples navigation intent (shared) from navigation execution (platform).
 */
class Navigator {

    private val _navigationEvents = MutableSharedFlow<NavigationEvent>(extraBufferCapacity = 1)
    val navigationEvents: SharedFlow<NavigationEvent> = _navigationEvents.asSharedFlow()

    fun navigateTo(route: Route) {
        _navigationEvents.tryEmit(NavigationEvent.NavigateTo(route))
    }

    fun goBack() {
        _navigationEvents.tryEmit(NavigationEvent.GoBack)
    }

    fun popToRoot() {
        _navigationEvents.tryEmit(NavigationEvent.PopToRoot)
    }
}

sealed class NavigationEvent {
    data class NavigateTo(val route: Route) : NavigationEvent()
    data object GoBack : NavigationEvent()
    data object PopToRoot : NavigationEvent()
}
