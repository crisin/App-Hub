package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult

/**
 * Web camera via getUserMedia() API.
 * TODO: Implement MediaStream capture and Canvas snapshot.
 */
actual class CameraManager {

    actual suspend fun capturePhoto(): AppResult<ImageData> {
        return AppResult.error(AppError.Unknown(), "Camera capture not yet implemented for Web")
    }

    actual suspend fun isCameraAvailable(): Boolean {
        return js("typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined") as Boolean
    }

    actual suspend fun requestCameraPermission(): AppResult<Boolean> {
        // getUserMedia implicitly requests permission
        return AppResult.success(isCameraAvailable())
    }
}
