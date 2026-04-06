package com.example.kmpapp.data.api

import com.example.kmpapp.domain.models.AppResult

/**
 * Pluggable API client abstraction.
 *
 * Swap between REST and GraphQL by changing the Koin binding.
 * Both implementations share the same interceptor chain.
 */
interface ApiClient {
    suspend fun <T> get(
        endpoint: String,
        queryParams: Map<String, String> = emptyMap(),
        deserializer: kotlinx.serialization.DeserializationStrategy<T>
    ): AppResult<T>

    suspend fun <T> post(
        endpoint: String,
        body: Any? = null,
        deserializer: kotlinx.serialization.DeserializationStrategy<T>
    ): AppResult<T>

    suspend fun <T> put(
        endpoint: String,
        body: Any? = null,
        deserializer: kotlinx.serialization.DeserializationStrategy<T>
    ): AppResult<T>

    suspend fun <T> delete(
        endpoint: String,
        deserializer: kotlinx.serialization.DeserializationStrategy<T>
    ): AppResult<T>

    fun addInterceptor(interceptor: HttpInterceptor)
}
