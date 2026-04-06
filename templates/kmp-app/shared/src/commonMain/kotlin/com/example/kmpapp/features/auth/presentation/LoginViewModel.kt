package com.example.kmpapp.features.auth.presentation

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.usecase.LoginUseCase
import com.example.kmpapp.presentation.navigation.Navigator
import com.example.kmpapp.presentation.navigation.Route
import com.example.kmpapp.presentation.viewmodel.BaseViewModel

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null
) {
    /** Basic email format check — not exhaustive, just catches obvious typos. */
    val isEmailValid: Boolean
        get() = email.contains("@") && email.contains(".")

    val isFormValid: Boolean
        get() = isEmailValid && password.length >= 4

    /** Show validation hint only after user has typed something. */
    val emailError: String?
        get() = if (email.isNotEmpty() && !isEmailValid) "Enter a valid email address" else null
}

/**
 * Shared login ViewModel — observed by all platforms.
 *
 * Handles input state, validation, and login execution.
 * On successful login, navigates to Home via [Navigator].
 * Errors are surfaced in [LoginUiState.errorMessage].
 */
class LoginViewModel(
    private val loginUseCase: LoginUseCase,
    private val navigator: Navigator
) : BaseViewModel<LoginUiState>(LoginUiState()) {

    fun onEmailChanged(email: String) {
        setState { copy(email = email, errorMessage = null) }
    }

    fun onPasswordChanged(password: String) {
        setState { copy(password = password, errorMessage = null) }
    }

    fun onLoginClicked() {
        if (!currentState.isFormValid) {
            setState { copy(errorMessage = "Please check your email and password") }
            return
        }

        launch {
            setState { copy(isLoading = true, errorMessage = null) }

            when (val result = loginUseCase.execute(currentState.email, currentState.password)) {
                is AppResult.Success -> {
                    setState { copy(isLoading = false) }
                    navigator.navigateTo(Route.Home)
                }
                is AppResult.Error -> {
                    setState {
                        copy(
                            isLoading = false,
                            errorMessage = result.message ?: "Login failed. Please try again."
                        )
                    }
                }
            }
        }
    }

    fun onBiometricLoginClicked() {
        launch {
            setState { copy(isLoading = true, errorMessage = null) }

            when (val result = loginUseCase.executeWithBiometric()) {
                is AppResult.Success -> {
                    setState { copy(isLoading = false) }
                    navigator.navigateTo(Route.Home)
                }
                is AppResult.Error -> {
                    setState {
                        copy(
                            isLoading = false,
                            errorMessage = result.message ?: "Biometric login failed"
                        )
                    }
                }
            }
        }
    }
}
