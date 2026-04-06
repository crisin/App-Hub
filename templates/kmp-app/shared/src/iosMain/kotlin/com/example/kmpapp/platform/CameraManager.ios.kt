package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult

actual class CameraManager {

    actual suspend fun capturePhoto(): AppResult<ImageData> {
        // TODO: Implement AVFoundation capture session
        return AppResult.error(AppError.Unknown(), "Camera capture not yet implemented for iOS")
    }

    actual suspend fun isCameraAvailable(): Boolean {
        return true // iOS devices always have a camera
    }

    actual suspend fun requestCameraPermission(): AppResult<Boolean> {
        // TODO: Use AVCaptureDevice.requestAccess(for:)
        return AppResult.success(false)
    }
}
