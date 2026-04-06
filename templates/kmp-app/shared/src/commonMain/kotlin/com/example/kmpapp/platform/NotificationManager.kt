package com.example.kmpapp.platform

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.repository.PushNotification
import kotlinx.coroutines.flow.Flow

/**
 * Platform-agnostic push notification handling.
 *
 * - Android: Firebase Cloud Messaging (FCM)
 * - iOS: Apple Push Notification service (APNs)
 * - Web: Web Push API + Service Workers
 */
expect class NotificationManager {
    suspend fun register(): AppResult<String> // Returns device/push token
    suspend fun unregister(): AppResult<Unit>
    fun observeNotifications(): Flow<PushNotification>
}
