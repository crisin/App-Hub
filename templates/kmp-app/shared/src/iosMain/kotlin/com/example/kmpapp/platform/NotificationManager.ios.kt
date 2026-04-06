package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.repository.PushNotification
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow

actual class NotificationManager {

    private val _notifications = MutableSharedFlow<PushNotification>(extraBufferCapacity = 10)

    actual suspend fun register(): AppResult<String> {
        // TODO: Register with APNs via UNUserNotificationCenter
        return AppResult.error(AppError.Unknown(), "Push not yet implemented for iOS")
    }

    actual suspend fun unregister(): AppResult<Unit> {
        // TODO: Unregister from APNs
        return AppResult.success(Unit)
    }

    actual fun observeNotifications(): Flow<PushNotification> = _notifications

    fun onNotificationReceived(notification: PushNotification) {
        _notifications.tryEmit(notification)
    }
}
