package com.example.kmpapp.presentation.viewmodel

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Base ViewModel for shared presentation logic.
 *
 * Each platform maps this to its lifecycle:
 * - Android: wraps in AndroidX ViewModel
 * - iOS: observed via @ObservedObject wrapper
 * - Web: instantiated in composable scope
 */
abstract class BaseViewModel<S>(initialState: S) {

    protected val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _state = MutableStateFlow(initialState)
    val state: StateFlow<S> = _state.asStateFlow()

    protected val currentState: S get() = _state.value

    protected fun setState(reducer: S.() -> S) {
        _state.value = _state.value.reducer()
    }

    protected fun launch(block: suspend CoroutineScope.() -> Unit) {
        scope.launch(block = block)
    }

    open fun onCleared() {
        scope.cancel()
    }
}
