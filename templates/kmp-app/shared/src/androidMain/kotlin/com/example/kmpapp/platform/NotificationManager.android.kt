package com.example.kmpapp.platform

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.repository.PushNotification
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

actual class NotificationManager {

    private val _notifications = MutableSharedFlow<PushNotification>(extraBufferCapacity = 10)

    actual suspend fun register(): AppResult<String> {
        return suspendCancellableCoroutine { continuation ->
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (continuation.isActive) {
                        continuation.resume(AppResult.success(token))
                    }
                }
                .addOnFailureListener { e ->
                    if (continuation.isActive) {
                        continuation.resume(AppResult.error(e, e.message))
                    }
                }
        }
    }

    actual suspend fun unregister(): AppResult<Unit> {
        return suspendCancellableCoroutine { continuation ->
            FirebaseMessaging.getInstance().deleteToken()
                .addOnSuccessListener {
                    if (continuation.isActive) {
                        continuation.resume(AppResult.success(Unit))
                    }
                }
                .addOnFailureListener { e ->
                    if (continuation.isActive) {
                        continuation.resume(AppResult.error(e, e.message))
                    }
                }
        }
    }

    actual fun observeNotifications(): Flow<PushNotification> = _notifications

    /**
     * Called from the FirebaseMessagingService in the Android app module.
     */
    fun onNotificationReceived(notification: PushNotification) {
        _notifications.tryEmit(notification)
    }
}
