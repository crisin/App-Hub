package com.example.kmpapp.data.api

/**
 * Configuration for the API backend.
 *
 * Change this in your Koin module to point at your API.
 * The template defaults to REST — switch to GraphQL by
 * providing a GraphQL config and binding GraphqlApiClient.
 */
sealed class ApiBackendConfig {
    abstract val baseUrl: String

    data class Rest(
        override val baseUrl: String,
        val timeout: Long = 30_000L,
        val retryCount: Int = 3
    ) : ApiBackendConfig()

    data class GraphQL(
        override val baseUrl: String,
        val timeout: Long = 30_000L
    ) : ApiBackendConfig()
}
