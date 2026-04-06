package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.Location
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow

actual class LocationManager {

    actual suspend fun getLastKnownLocation(): AppResult<Location> {
        // TODO: Implement CLLocationManager.location
        return AppResult.error(AppError.Unknown(), "Location not yet implemented for iOS")
    }

    actual fun observeLocationUpdates(intervalMs: Long): Flow<Location> {
        // TODO: Implement CLLocationManager delegate with callbackFlow
        return emptyFlow()
    }

    actual suspend fun isLocationPermissionGranted(): Boolean {
        // TODO: Check CLLocationManager.authorizationStatus
        return false
    }

    actual suspend fun requestLocationPermission(): AppResult<Boolean> {
        // TODO: Use CLLocationManager.requestWhenInUseAuthorization()
        return AppResult.success(false)
    }
}
