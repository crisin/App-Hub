package com.example.kmpapp.common.error

/**
 * Domain-level error types used across the app.
 * Map platform/network errors to these for consistent handling.
 */
sealed class AppError(message: String, cause: Throwable? = null) : Exception(message, cause) {

    // Network
    class NetworkUnavailable : AppError("No internet connection")
    class ServerError(val statusCode: Int) : AppError("Server error: $statusCode")
    class Timeout : AppError("Request timed out")

    // Auth
    class Unauthorized : AppError("Session expired. Please log in again.")
    class InvalidCredentials : AppError("Invalid email or password")
    class BiometricNotAvailable : AppError("Biometric authentication is not available")
    class BiometricFailed(reason: String = "Authentication failed") : AppError(reason)

    // Permission
    class PermissionDenied(val permission: String) : AppError("Permission denied: $permission")

    // Data
    class NotFound(val resource: String) : AppError("$resource not found")
    class CacheExpired : AppError("Cached data has expired")

    // Generic
    class Unknown(cause: Throwable? = null) : AppError("An unexpected error occurred", cause)
}
