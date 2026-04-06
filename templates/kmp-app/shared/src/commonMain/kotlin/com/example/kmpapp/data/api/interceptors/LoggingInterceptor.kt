package com.example.kmpapp.data.api.interceptors

import com.example.kmpapp.data.api.HttpInterceptor
import com.example.kmpapp.data.api.HttpRequestData
import io.github.aakira.napier.Napier

/**
 * Logs outgoing HTTP requests for debugging.
 * Redacts Authorization headers in production.
 */
class LoggingInterceptor(
    private val isDebug: Boolean = false
) : HttpInterceptor {

    override suspend fun intercept(request: HttpRequestData): HttpRequestData {
        val sanitizedHeaders = if (isDebug) {
            request.headers
        } else {
            request.headers.mapValues { (key, value) ->
                if (key.equals("Authorization", ignoreCase = true)) "***" else value
            }
        }

        Napier.d(tag = "HTTP") {
            "${request.method} ${request.url} headers=$sanitizedHeaders"
        }
        return request
    }
}
