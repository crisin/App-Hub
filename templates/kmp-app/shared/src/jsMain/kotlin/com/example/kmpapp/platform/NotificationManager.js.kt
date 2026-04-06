package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.repository.PushNotification
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow

/**
 * Web Push API + Service Workers.
 * TODO: Implement PushManager.subscribe() and Notification API.
 */
actual class NotificationManager {

    private val _notifications = MutableSharedFlow<PushNotification>(extraBufferCapacity = 10)

    actual suspend fun register(): AppResult<String> {
        // TODO: Implement Web Push registration via Service Worker
        return AppResult.error(AppError.Unknown(), "Web Push not yet implemented")
    }

    actual suspend fun unregister(): AppResult<Unit> {
        return AppResult.success(Unit)
    }

    actual fun observeNotifications(): Flow<PushNotification> = _notifications
}
