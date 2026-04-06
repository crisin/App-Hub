package com.example.kmpapp.data.repository

import com.example.kmpapp.common.error.AppError
import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.AuthState
import com.example.kmpapp.domain.models.User
import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.platform.SecureStorageManager
import io.github.aakira.napier.Napier
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json

/**
 * Offline demo implementation of [AuthRepository].
 *
 * Accepts any email/password and returns a fake user after a short delay
 * (simulating network latency). Stores a session in [SecureStorageManager]
 * so session restore and logout work realistically.
 *
 * Use this while developing the UI without a running backend.
 * Switch to [AuthRepositoryImpl] in KoinModules.kt when your API is ready.
 */
class DemoAuthRepository(
    private val secureStorage: SecureStorageManager
) : AuthRepository {

    private val json = Json { ignoreUnknownKeys = true }

    private val _authState = MutableStateFlow<AuthState>(AuthState.Unauthenticated)
    override val authState: Flow<AuthState> = _authState.asStateFlow()

    private val demoToken = "demo-token-kmp-app-template"

    override suspend fun login(email: String, password: String): AppResult<User> {
        _authState.value = AuthState.Authenticating

        // Simulate network delay
        delay(800)

        val user = User(
            id = "demo-user-1",
            name = email.substringBefore("@").replaceFirstChar { it.uppercase() },
            email = email,
            avatarUrl = null
        )

        // Persist session so restore works on next launch
        secureStorage.saveString("auth_token", demoToken)
        secureStorage.saveString("current_user", json.encodeToString(User.serializer(), user))

        _authState.value = AuthState.Authenticated(user, demoToken)
        Napier.d(tag = "DemoAuth") { "Demo login for ${user.email}" }
        return AppResult.success(user)
    }

    override suspend fun loginWithBiometric(): AppResult<User> {
        // In demo mode, biometric login restores the stored session
        val storedUser = secureStorage.getString("current_user")
        val storedToken = secureStorage.getString("auth_token")

        if (storedToken != null && storedUser != null) {
            delay(400)
            return try {
                val user = json.decodeFromString(User.serializer(), storedUser)
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
        Napier.d(tag = "DemoAuth") { "Demo user logged out" }
        return AppResult.success(Unit)
    }

    override suspend fun refreshToken(): AppResult<String> {
        // Demo mode: token never expires
        return AppResult.success(demoToken)
    }

    override suspend fun isLoggedIn(): Boolean {
        return secureStorage.getString("auth_token") != null
    }
}
