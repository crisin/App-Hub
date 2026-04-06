package com.example.kmpapp.platform

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult

actual class CameraManager(private val context: Context) {

    actual suspend fun capturePhoto(): AppResult<ImageData> {
        // TODO: Implement CameraX capture flow
        // This requires an Activity lifecycle owner — wire up in the Android app module.
        return AppResult.error(AppError.Unknown(), "Camera capture not yet implemented")
    }

    actual suspend fun isCameraAvailable(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
    }

    actual suspend fun requestCameraPermission(): AppResult<Boolean> {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        return if (granted) {
            AppResult.success(true)
        } else {
            // Permission request must be triggered from Activity — return false here
            AppResult.success(false)
        }
    }
}
