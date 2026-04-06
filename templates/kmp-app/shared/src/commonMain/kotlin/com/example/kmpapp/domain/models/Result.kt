package com.example.kmpapp.domain.models

/**
 * A generic wrapper for operation results across the app.
 * Use this instead of throwing exceptions for expected failure cases.
 */
sealed class AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>()
    data class Error(val exception: Throwable, val message: String? = null) : AppResult<Nothing>()

    val isSuccess: Boolean get() = this is Success
    val isError: Boolean get() = this is Error

    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Error -> null
    }

    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Error -> throw exception
    }

    fun <R> map(transform: (T) -> R): AppResult<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
    }

    suspend fun <R> flatMap(transform: suspend (T) -> AppResult<R>): AppResult<R> = when (this) {
        is Success -> transform(data)
        is Error -> this
    }

    companion object {
        fun <T> success(data: T): AppResult<T> = Success(data)
        fun error(exception: Throwable, message: String? = null): AppResult<Nothing> =
            Error(exception, message)
    }
}
