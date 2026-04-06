package com.example.kmpapp.data.repository

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.Location
import com.example.kmpapp.domain.repository.LocationRepository
import com.example.kmpapp.platform.LocationManager
import kotlinx.coroutines.flow.Flow

class LocationRepositoryImpl(
    private val locationManager: LocationManager
) : LocationRepository {

    override suspend fun getLastKnownLocation(): AppResult<Location> {
        return locationManager.getLastKnownLocation()
    }

    override fun observeLocationUpdates(intervalMs: Long): Flow<Location> {
        return locationManager.observeLocationUpdates(intervalMs)
    }

    override suspend fun isLocationPermissionGranted(): Boolean {
        return locationManager.isLocationPermissionGranted()
    }

    override suspend fun requestLocationPermission(): AppResult<Boolean> {
        return locationManager.requestLocationPermission()
    }
}
