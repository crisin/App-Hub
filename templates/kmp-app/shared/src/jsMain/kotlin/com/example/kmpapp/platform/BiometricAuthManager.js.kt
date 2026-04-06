package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult

/**
 * Web biometric auth via WebAuthn / FIDO2.
 * TODO: Implement navigator.credentials.create() / .get()
 */
actual class BiometricAuthManager {

    actual fun isBiometricAvailable(): Boolean {
        // Check if WebAuthn is supported
        return js("typeof window !== 'undefined' && window.PublicKeyCredential !== undefined") as Boolean
    }

    actual suspend fun authenticate(reason: String): AppResult<Boolean> {
        if (!isBiometricAvailable()) {
            return AppResult.error(AppError.BiometricNotAvailable())
        }
        // TODO: Implement WebAuthn flow
        return AppResult.error(AppError.Unknown(), "WebAuthn not yet implemented")
    }
}
