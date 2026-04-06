package com.example.kmpapp.data.repository

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.data.api.ApiClient
import com.example.kmpapp.data.api.dto.LoginRequestDto
import com.example.kmpapp.data.api.dto.LoginResponseDto
import com.example.kmpapp.data.api.dto.RefreshTokenRequestDto
import com.example.kmpapp.data.api.dto.RefreshTokenResponseDto
import com.example.kmpapp.data.mappers.toDomain
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.AuthState
import com.example.kmpapp.domain.models.User
import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.platform.BiometricAuthManager
import com.example.kmpapp.platform.SecureStorageManager
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json

class AuthRepositoryImpl(
    private val apiClient: ApiClient,
    private val secureStorage: SecureStorageManager,
    private val biometricAuthManager: BiometricAuthManager
) : AuthRepository {

    private val json = Json { ignoreUnknownKeys = true }

    private val _authState = MutableStateFlow<AuthState>(AuthState.Unauthenticated)
    override val authState: Flow<AuthState> = _authState.asStateFlow()

    override suspend fun login(email: String, password: String): AppResult<User> {
        _authState.value = AuthState.Authenticating

        val result = apiClient.post(
            endpoint = "/auth/login",
            body = LoginRequestDto(email, password),
            deserializer = LoginResponseDto.serializer()
        )

        return when (result) {
            is AppResult.Success -> {
                val response = result.data
                // Store tokens securely
                secureStorage.saveString("auth_token", response.accessToken)
                response.refreshToken?.let {
                    secureStorage.saveString("refresh_token", it)
                }
                // Store user info for offline access
                secureStorage.saveString("current_user", json.encodeToString(
                    com.example.kmpapp.data.api.dto.UserDto.serializer(),
                    response.user
                ))

                val user = response.user.toDomain()
                _authState.value = AuthState.Authenticated(user, response.accessToken)
                Napier.d(tag = "Auth") { "Login successful for ${user.email}" }
                AppResult.success(user)
            }
            is AppResult.Error -> {
                _authState.value = AuthState.Error(result.message ?: "Login failed")
                Napier.e(tag = "Auth") { "Login failed: ${result.message}" }
                result
            }
        }
    }

    override suspend fun loginWithBiometric(): AppResult<User> {
        // First verify biometrics
        val biometricResult = biometricAuthManager.authenticate("Sign in to your account")
        if (biometricResult is AppResult.Error) {
            return AppResult.error(biometricResult.exception, biometricResult.message)
        }

        // If biometric succeeds, try to restore session from stored tokens
        val storedToken = secureStorage.getString("auth_token")
        val storedUser = secureStorage.getString("current_user")

        if (storedToken != null && storedUser != null) {
            return try {
                val userDto = json.decodeFromString(
                    com.example.kmpapp.data.api.dto.UserDto.serializer(),
                    storedUser
                )
                val user = userDto.toDomain()
                _authState.value = AuthState.Authenticated(user, storedToken)
                AppResult.success(user)
            } catch (e: Exception) {
                AppResult.error(AppError.InvalidCredentials(), "Stored session is invalid")
            }
        }

        return AppResult.error(
            AppError.Unauthorized(),
            "No stored session. Please log in with email and password first."
        )
    }

    override suspend fun logout(): AppResult<Unit> {
        secureStorage.remove("auth_token")
        secureStorage.remove("refresh_token")
        secureStorage.remove("current_user")
        _authState.value = AuthState.Unauthenticated
        Napier.d(tag = "Auth") { "User logged out" }
        return AppResult.success(Unit)
    }

    override suspend fun refreshToken(): AppResult<String> {
        val refreshToken = secureStorage.getString("refresh_token")
            ?: return AppResult.error(AppError.Unauthorized(), "No refresh token available")

        val result = apiClient.post(
            endpoint = "/auth/refresh",
            body = RefreshTokenRequestDto(refreshToken),
            deserializer = RefreshTokenResponseDto.serializer()
        )

        return when (result) {
            is AppResult.Success -> {
                secureStorage.saveString("auth_token", result.data.accessToken)
                result.data.refreshToken?.let {
                    secureStorage.saveString("refresh_token", it)
                }
                AppResult.success(result.data.accessToken)
            }
            is AppResult.Error -> {
                // Refresh failed — force re-login
                _authState.value = AuthState.Unauthenticated
                result
            }
        }
    }

    override suspend fun isLoggedIn(): Boolean {
        return secureStorage.getString("auth_token") != null
    }
}
