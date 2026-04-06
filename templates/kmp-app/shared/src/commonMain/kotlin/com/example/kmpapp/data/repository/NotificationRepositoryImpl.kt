package com.example.kmpapp.data.repository

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.repository.NotificationRepository
import com.example.kmpapp.domain.repository.PushNotification
import com.example.kmpapp.platform.NotificationManager
import kotlinx.coroutines.flow.Flow

class NotificationRepositoryImpl(
    private val notificationManager: NotificationManager
) : NotificationRepository {

    override suspend fun registerForPushNotifications(): AppResult<String> {
        return notificationManager.register()
    }

    override suspend fun unregister(): AppResult<Unit> {
        return notificationManager.unregister()
    }

    override fun observeNotifications(): Flow<PushNotification> {
        return notificationManager.observeNotifications()
    }
}
