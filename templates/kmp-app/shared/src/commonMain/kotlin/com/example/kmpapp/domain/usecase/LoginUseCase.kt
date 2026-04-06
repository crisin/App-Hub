package com.example.kmpapp.domain.usecase

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.User
import com.example.kmpapp.domain.repository.AuthRepository

/**
 * Orchestrates the login flow.
 * Validates input, delegates to AuthRepository, handles errors.
 */
class LoginUseCase(
    private val authRepository: AuthRepository
) {
    suspend fun execute(email: String, password: String): AppResult<User> {
        if (email.isBlank()) {
            return AppResult.error(
                IllegalArgumentException("Email cannot be empty"),
                "Please enter your email address"
            )
        }
        if (password.isBlank()) {
            return AppResult.error(
                IllegalArgumentException("Password cannot be empty"),
                "Please enter your password"
            )
        }

        return authRepository.login(email, password)
    }

    suspend fun executeWithBiometric(): AppResult<User> {
        return authRepository.loginWithBiometric()
    }
}
