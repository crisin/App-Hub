package com.example.kmpapp.domain.models

/**
 * Represents the authentication state of the current user.
 */
sealed class AuthState {
    data object Unauthenticated : AuthState()
    data object Authenticating : AuthState()
    data class Authenticated(val user: User, val token: String) : AuthState()
    data class Error(val message: String) : AuthState()
}
