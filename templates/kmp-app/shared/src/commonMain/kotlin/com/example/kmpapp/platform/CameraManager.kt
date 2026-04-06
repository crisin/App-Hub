package com.example.kmpapp.platform

import com.example.kmpapp.domain.models.AppResult

data class ImageData(
    val bytes: ByteArray,
    val mimeType: String = "image/jpeg",
    val width: Int = 0,
    val height: Int = 0
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ImageData) return false
        return bytes.contentEquals(other.bytes) && mimeType == other.mimeType
    }

    override fun hashCode(): Int = bytes.contentHashCode() * 31 + mimeType.hashCode()
}

/**
 * Platform-agnostic camera/media capture.
 *
 * - Android: CameraX
 * - iOS: AVFoundation
 * - Web: getUserMedia()
 */
expect class CameraManager {
    suspend fun capturePhoto(): AppResult<ImageData>
    suspend fun isCameraAvailable(): Boolean
    suspend fun requestCameraPermission(): AppResult<Boolean>
}
