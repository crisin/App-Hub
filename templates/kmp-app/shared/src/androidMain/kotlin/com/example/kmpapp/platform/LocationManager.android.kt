package com.example.kmpapp.platform

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.Location
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

actual class LocationManager(private val context: Context) {

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    actual suspend fun getLastKnownLocation(): AppResult<Location> {
        if (!isLocationPermissionGranted()) {
            return AppResult.error(AppError.PermissionDenied("location"))
        }

        return suspendCancellableCoroutine { continuation ->
            try {
                fusedLocationClient.lastLocation
                    .addOnSuccessListener { location ->
                        if (location != null && continuation.isActive) {
                            continuation.resume(
                                AppResult.success(
                                    Location(
                                        latitude = location.latitude,
                                        longitude = location.longitude,
                                        accuracy = location.accuracy,
                                        altitude = location.altitude,
                                        timestampMs = location.time
                                    )
                                )
                            )
                        } else if (continuation.isActive) {
                            continuation.resume(
                                AppResult.error(AppError.NotFound("location"))
                            )
                        }
                    }
                    .addOnFailureListener { e ->
                        if (continuation.isActive) {
                            continuation.resume(AppResult.error(e, e.message))
                        }
                    }
            } catch (e: SecurityException) {
                if (continuation.isActive) {
                    continuation.resume(AppResult.error(AppError.PermissionDenied("location")))
                }
            }
        }
    }

    actual fun observeLocationUpdates(intervalMs: Long): Flow<Location> = callbackFlow {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    trySend(
                        Location(
                            latitude = location.latitude,
                            longitude = location.longitude,
                            accuracy = location.accuracy,
                            altitude = location.altitude,
                            timestampMs = location.time
                        )
                    )
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                callback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            close(e)
        }

        awaitClose {
            fusedLocationClient.removeLocationUpdates(callback)
        }
    }

    actual suspend fun isLocationPermissionGranted(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    actual suspend fun requestLocationPermission(): AppResult<Boolean> {
        // Permission request must be triggered from Activity
        return AppResult.success(isLocationPermissionGranted())
    }
}
