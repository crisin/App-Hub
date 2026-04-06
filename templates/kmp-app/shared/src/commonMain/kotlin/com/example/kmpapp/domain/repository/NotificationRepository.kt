package com.example.kmpapp.domain.repository

import com.example.kmpapp.domain.models.AppResult
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable

@Serializable
data class PushNotification(
    val title: String,
    val body: String,
    val data: Map<String, String> = emptyMap()
)

interface NotificationRepository {
    suspend fun registerForPushNotifications(): AppResult<String> // Returns device token
    suspend fun unregister(): AppResult<Unit>
    fun observeNotifications(): Flow<PushNotification>
}
