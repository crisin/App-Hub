package com.example.kmpapp.util

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

/**
 * Wraps a Kotlin StateFlow for observation from Swift.
 *
 * Swift can't call Kotlin suspend functions or use Flow.collect() directly.
 * This class bridges the gap by launching a coroutine that collects the flow
 * and calls a Swift-friendly callback on each emission.
 *
 * Usage from Swift:
 *   let observer = FlowObserver(flow: viewModel.state) { state in
 *       // update SwiftUI state
 *   }
 *   // later: observer.cancel()
 */
class FlowObserver<T>(
    private val flow: StateFlow<T>,
    private val onChange: (T) -> Unit
) {
    private val scope = CoroutineScope(Dispatchers.Main)
    private val job: Job

    init {
        job = flow.onEach { value ->
            onChange(value)
        }.launchIn(scope)
    }

    /** Stop observing. Call this from Swift's deinit or onDisappear. */
    fun cancel() {
        job.cancel()
    }
}
