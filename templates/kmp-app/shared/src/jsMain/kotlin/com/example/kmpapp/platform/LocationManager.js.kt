package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.Location
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Web location via Geolocation API.
 */
actual class LocationManager {

    actual suspend fun getLastKnownLocation(): AppResult<Location> {
        return suspendCancellableCoroutine { continuation ->
            val geolocation = js("navigator.geolocation")
            if (geolocation == null) {
                continuation.resume(AppResult.error(AppError.NotFound("geolocation")))
                return@suspendCancellableCoroutine
            }

            geolocation.getCurrentPosition(
                { position: dynamic ->
                    val coords = position.coords
                    if (continuation.isActive) {
                        continuation.resume(
                            AppResult.success(
                                Location(
                                    latitude = coords.latitude as Double,
                                    longitude = coords.longitude as Double,
                                    accuracy = (coords.accuracy as Double).toFloat()
                                )
                            )
                        )
                    }
                },
                { error: dynamic ->
                    if (continuation.isActive) {
                        continuation.resume(
                            AppResult.error(
                                AppError.PermissionDenied("location"),
                                error.message as? String
                            )
                        )
                    }
                }
            )
        }
    }

    actual fun observeLocationUpdates(intervalMs: Long): Flow<Location> = callbackFlow {
        val geolocation = js("navigator.geolocation")
        val watchId = geolocation.watchPosition(
            { position: dynamic ->
                val coords = position.coords
                trySend(
                    Location(
                        latitude = coords.latitude as Double,
                        longitude = coords.longitude as Double,
                        accuracy = (coords.accuracy as Double).toFloat()
                    )
                )
            },
            { _: dynamic -> close() }
        )

        awaitClose {
            geolocation.clearWatch(watchId)
        }
    }

    actual suspend fun isLocationPermissionGranted(): Boolean {
        // Geolocation API doesn't have a separate permission check
        return js("typeof navigator !== 'undefined' && navigator.geolocation !== undefined") as Boolean
    }

    actual suspend fun requestLocationPermission(): AppResult<Boolean> {
        return AppResult.success(isLocationPermissionGranted())
    }
}
