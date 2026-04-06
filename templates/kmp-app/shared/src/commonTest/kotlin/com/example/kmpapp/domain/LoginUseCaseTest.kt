package com.example.kmpapp.domain

import com.example.kmpapp.domain.models.AppResult
import com.example.kmpapp.domain.models.AuthState
import com.example.kmpapp.domain.models.User
import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.domain.usecase.LoginUseCase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

class LoginUseCaseTest {

    private val fakeUser = User(id = "1", name = "Test", email = "test@example.com")

    private val fakeRepo = object : AuthRepository {
        override val authState: Flow<AuthState> = emptyFlow()
        override suspend fun login(email: String, password: String) = AppResult.success(fakeUser)
        override suspend fun loginWithBiometric() = AppResult.success(fakeUser)
        override suspend fun logout() = AppResult.success(Unit)
        override suspend fun refreshToken() = AppResult.success("token")
        override suspend fun isLoggedIn() = false
    }

    private val useCase = LoginUseCase(fakeRepo)

    @Test
    fun loginWithValidCredentialsReturnsSuccess() = runTest {
        val result = useCase.execute("test@example.com", "password123")
        assertTrue(result.isSuccess)
    }

    @Test
    fun loginWithEmptyEmailReturnsError() = runTest {
        val result = useCase.execute("", "password123")
        assertTrue(result.isError)
    }

    @Test
    fun loginWithEmptyPasswordReturnsError() = runTest {
        val result = useCase.execute("test@example.com", "")
        assertTrue(result.isError)
    }

    @Test
    fun biometricLoginReturnsSuccess() = runTest {
        val result = useCase.executeWithBiometric()
        assertTrue(result.isSuccess)
    }
}
