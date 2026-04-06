package com.example.kmpapp.data.api.interceptors

import com.example.kmpapp.data.api.HttpInterceptor
import com.example.kmpapp.data.api.HttpRequestData
import com.example.kmpapp.platform.SecureStorageManager

/**
 * Adds the auth token to outgoing requests.
 * Reads the token from secure storage on each request.
 */
class AuthInterceptor(
    private val secureStorage: SecureStorageManager
) : HttpInterceptor {

    override suspend fun intercept(request: HttpRequestData): HttpRequestData {
        val token = secureStorage.getString("auth_token")
        return if (token != null) {
            request.copy(
                headers = request.headers.apply {
                    put("Authorization", "Bearer $token")
                }
            )
        } else {
            request
        }
    }
}
