package com.example.kmpapp.data.api.interceptors

import com.example.kmpapp.data.api.HttpInterceptor
import com.example.kmpapp.data.api.HttpRequestData

/**
 * Marks requests as retryable by adding a retry header.
 *
 * Note: Actual retry logic lives in RestApiClient's executeRequest.
 * This interceptor is used to tag which requests should be retried
 * and how many times, enabling per-request retry configuration.
 */
class RetryInterceptor(
    private val maxRetries: Int = 3,
    private val retryableStatusCodes: Set<Int> = setOf(408, 429, 500, 502, 503, 504)
) : HttpInterceptor {

    override suspend fun intercept(request: HttpRequestData): HttpRequestData {
        return request.copy(
            headers = request.headers.apply {
                put("X-Retry-Max", maxRetries.toString())
                put("X-Retry-Codes", retryableStatusCodes.joinToString(","))
            }
        )
    }
}
