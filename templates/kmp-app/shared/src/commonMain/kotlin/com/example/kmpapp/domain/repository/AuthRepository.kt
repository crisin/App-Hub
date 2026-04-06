package com.example.kmpapp.domain.repository

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.AuthState
import com.example.kmpapp.domain.models.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val authState: Flow<AuthState>

    suspend fun login(email: String, password: String): AppResult<User>
    suspend fun loginWithBiometric(): AppResult<User>
    suspend fun logout(): AppResult<Unit>
    suspend fun refreshToken(): AppResult<String>
    suspend fun isLoggedIn(): Boolean
}
