package com.example.kmpapp.data.api

import com.example.kmpapp.domain.models.AppResult
import io.github.aakira.napier.Napier
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json

/**
 * Ktor-based REST implementation of [ApiClient].
 *
 * Customize by changing the [ApiBackendConfig.Rest] in your Koin module.
 */
class RestApiClient(
    private val config: ApiBackendConfig.Rest
) : ApiClient {

    private val interceptors = mutableListOf<HttpInterceptor>()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        prettyPrint = false
    }

    private val httpClient = HttpClient {
        install(ContentNegotiation) {
            json(this@RestApiClient.json)
        }

        install(Logging) {
            logger = object : Logger {
                override fun log(message: String) {
                    Napier.d(tag = "Ktor") { message }
                }
            }
            level = LogLevel.HEADERS
        }

        install(HttpTimeout) {
            requestTimeoutMillis = config.timeout
            connectTimeoutMillis = config.timeout
            socketTimeoutMillis = config.timeout
        }

        defaultRequest {
            contentType(ContentType.Application.Json)
        }
    }

    override suspend fun <T> get(
        endpoint: String,
        queryParams: Map<String, String>,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> = executeRequest("GET", endpoint, queryParams, null, deserializer)

    override suspend fun <T> post(
        endpoint: String,
        body: Any?,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> = executeRequest("POST", endpoint, emptyMap(), body, deserializer)

    override suspend fun <T> put(
        endpoint: String,
        body: Any?,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> = executeRequest("PUT", endpoint, emptyMap(), body, deserializer)

    override suspend fun <T> delete(
        endpoint: String,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> = executeRequest("DELETE", endpoint, emptyMap(), null, deserializer)

    override fun addInterceptor(interceptor: HttpInterceptor) {
        interceptors.add(interceptor)
    }

    private suspend fun <T> executeRequest(
        method: String,
        endpoint: String,
        queryParams: Map<String, String>,
        body: Any?,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> {
        return try {
            // Run interceptor chain.
            // Note: HttpRequestData.body is for interceptor inspection only (e.g. logging).
            // The actual request body is serialized by Ktor's ContentNegotiation plugin
            // via setBody() below, which correctly handles @Serializable classes.
            var requestData = HttpRequestData(
                url = "${config.baseUrl}$endpoint",
                method = method,
                body = null
            )
            for (interceptor in interceptors) {
                requestData = interceptor.intercept(requestData)
            }

            val response: HttpResponse = httpClient.request(requestData.url) {
                this.method = HttpMethod.parse(requestData.method)
                requestData.headers.forEach { (key, value) ->
                    header(key, value)
                }
                queryParams.forEach { (key, value) ->
                    parameter(key, value)
                }
                // Pass body directly — Ktor's ContentNegotiation plugin handles
                // JSON serialization via the installed Json configuration.
                if (body != null) {
                    setBody(body)
                }
            }

            if (response.status.isSuccess()) {
                val responseBody = response.body<String>()
                val decoded = json.decodeFromString(deserializer, responseBody)
                AppResult.success(decoded)
            } else {
                AppResult.error(
                    HttpException(response.status.value, response.status.description),
                    "HTTP ${response.status.value}: ${response.status.description}"
                )
            }
        } catch (e: Exception) {
            Napier.e(tag = "RestApiClient") { "Request failed: $method $endpoint — ${e.message}" }
            AppResult.error(e, e.message)
        }
    }
}

class HttpException(val statusCode: Int, message: String) : Exception("HTTP $statusCode: $message")
