package com.example.kmpapp.platform

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.Location
import kotlinx.coroutines.flow.Flow

/**
 * Platform-agnostic location services.
 *
 * - Android: FusedLocationProviderClient
 * - iOS: CLLocationManager
 * - Web: Geolocation API
 */
expect class LocationManager {
    suspend fun getLastKnownLocation(): AppResult<Location>
    fun observeLocationUpdates(intervalMs: Long): Flow<Location>
    suspend fun isLocationPermissionGranted(): Boolean
    suspend fun requestLocationPermission(): AppResult<Boolean>
}
