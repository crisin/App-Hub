package com.example.kmpapp.data.api

/**
 * Intercepts HTTP requests before they are sent.
 * Use for auth headers, logging, request modification, etc.
 */
interface HttpInterceptor {
    suspend fun intercept(request: HttpRequestData): HttpRequestData
}

data class HttpRequestData(
    val url: String,
    val method: String,
    val headers: MutableMap<String, String> = mutableMapOf(),
    val body: String? = null
)
