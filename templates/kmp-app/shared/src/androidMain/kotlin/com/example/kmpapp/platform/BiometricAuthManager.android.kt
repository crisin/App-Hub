package com.example.kmpapp.platform

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

actual class BiometricAuthManager(private val context: Context) {

    actual fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    actual suspend fun authenticate(reason: String): AppResult<Boolean> {
        if (!isBiometricAvailable()) {
            return AppResult.error(AppError.BiometricNotAvailable())
        }

        val activity = context as? FragmentActivity
            ?: return AppResult.error(AppError.BiometricFailed("Activity not available"))

        return suspendCancellableCoroutine { continuation ->
            val executor = ContextCompat.getMainExecutor(context)

            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (continuation.isActive) {
                        continuation.resume(AppResult.success(true))
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (continuation.isActive) {
                        continuation.resume(
                            AppResult.error(AppError.BiometricFailed(errString.toString()))
                        )
                    }
                }

                override fun onAuthenticationFailed() {
                    // Called on each failed attempt — don't resume yet, user can retry
                }
            }

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Authentication Required")
                .setSubtitle(reason)
                .setNegativeBtnText("Cancel")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build()

            BiometricPrompt(activity, executor, callback).authenticate(promptInfo)
        }
    }
}

// Extension to fix the missing method name
private fun BiometricPrompt.PromptInfo.Builder.setNegativeBtnText(text: String) =
    setNegativeButtonText(text)
