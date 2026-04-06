package com.example.kmpapp.platform

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.LocalAuthentication.LAContext
import platform.LocalAuthentication.LAPolicyDeviceOwnerAuthenticationWithBiometrics
import kotlinx.cinterop.ExperimentalForeignApi
import kotlin.coroutines.resume

@OptIn(ExperimentalForeignApi::class)
actual class BiometricAuthManager {

    actual fun isBiometricAvailable(): Boolean {
        val context = LAContext()
        return context.canEvaluatePolicy(
            LAPolicyDeviceOwnerAuthenticationWithBiometrics,
            error = null
        )
    }

    actual suspend fun authenticate(reason: String): AppResult<Boolean> {
        if (!isBiometricAvailable()) {
            return AppResult.error(AppError.BiometricNotAvailable())
        }

        return suspendCancellableCoroutine { continuation ->
            val context = LAContext()
            context.evaluatePolicy(
                LAPolicyDeviceOwnerAuthenticationWithBiometrics,
                localizedReason = reason
            ) { success, error ->
                if (continuation.isActive) {
                    if (success) {
                        continuation.resume(AppResult.success(true))
                    } else {
                        continuation.resume(
                            AppResult.error(
                                AppError.BiometricFailed(
                                    error?.localizedDescription ?: "Authentication failed"
                                )
                            )
                        )
                    }
                }
            }
        }
    }
}
