package com.example.kmpapp.domain.repository

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.Location
import kotlinx.coroutines.flow.Flow

interface LocationRepository {
    suspend fun getLastKnownLocation(): AppResult<Location>
    fun observeLocationUpdates(intervalMs: Long = 5000L): Flow<Location>
    suspend fun isLocationPermissionGranted(): Boolean
    suspend fun requestLocationPermission(): AppResult<Boolean>
}
