package com.example.kmpapp.platform

import com.example.kmpapp.domain.models.AppResult

/**
 * Platform-agnostic biometric authentication.
 *
 * - Android: AndroidX Biometric (fingerprint / face)
 * - iOS: LocalAuthentication (Face ID / Touch ID)
 * - Web: WebAuthn / FIDO2
 */
expect class BiometricAuthManager {
    fun isBiometricAvailable(): Boolean
    suspend fun authenticate(reason: String = "Authenticate to continue"): AppResult<Boolean>
}
