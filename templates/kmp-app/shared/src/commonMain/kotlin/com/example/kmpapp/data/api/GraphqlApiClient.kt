package com.example.kmpapp.data.api

import com.example.kmpapp.domain.models.AppResult
import io.github.aakira.napier.Napier
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * GraphQL implementation of [ApiClient].
 *
 * Sends all operations as POST to the single GraphQL endpoint.
 * The `endpoint` parameter in get/post/put/delete is repurposed as
 * the GraphQL operation name, and `body` carries the query/variables.
 */
class GraphqlApiClient(
    private val config: ApiBackendConfig.GraphQL
) : ApiClient {

    private val interceptors = mutableListOf<HttpInterceptor>()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val httpClient = HttpClient {
        install(ContentNegotiation) { json(this@GraphqlApiClient.json) }
        install(HttpTimeout) {
            requestTimeoutMillis = config.timeout
            connectTimeoutMillis = config.timeout
        }
        defaultRequest {
            contentType(ContentType.Application.Json)
        }
    }

    override suspend fun <T> get(
        endpoint: String,
        queryParams: Map<String, String>,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> {
        // For GraphQL, a "get" is a query. Endpoint = operation name.
        val query = queryParams["query"] ?: return AppResult.error(
            IllegalArgumentException("GraphQL query string required in queryParams[\"query\"]"),
            "Missing GraphQL query"
        )
        return executeGraphql(query, queryParams["variables"], deserializer)
    }

    override suspend fun <T> post(
        endpoint: String,
        body: Any?,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> {
        val request = body as? GraphqlRequest
            ?: return AppResult.error(
                IllegalArgumentException("Body must be a GraphqlRequest"),
                "Invalid GraphQL request body"
            )
        return executeGraphql(request.query, request.variables?.toString(), deserializer)
    }

    override suspend fun <T> put(
        endpoint: String,
        body: Any?,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> = post(endpoint, body, deserializer) // Mutations use POST

    override suspend fun <T> delete(
        endpoint: String,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> = AppResult.error(
        UnsupportedOperationException("Use a mutation for deletes"),
        "GraphQL: use a mutation for delete operations"
    )

    override fun addInterceptor(interceptor: HttpInterceptor) {
        interceptors.add(interceptor)
    }

    private suspend fun <T> executeGraphql(
        query: String,
        variables: String?,
        deserializer: DeserializationStrategy<T>
    ): AppResult<T> {
        return try {
            var requestData = HttpRequestData(
                url = config.baseUrl,
                method = "POST"
            )
            for (interceptor in interceptors) {
                requestData = interceptor.intercept(requestData)
            }

            val response: HttpResponse = httpClient.post(config.baseUrl) {
                requestData.headers.forEach { (key, value) -> header(key, value) }
                setBody(
                    GraphqlRequestBody(
                        query = query,
                        variables = variables?.let { json.parseToJsonElement(it) }
                    )
                )
            }

            if (response.status.isSuccess()) {
                val body = response.body<String>()
                // GraphQL responses are wrapped in { "data": ... }
                // Extract the data field and deserialize
                val jsonElement = json.parseToJsonElement(body)
                val dataElement = jsonElement.jsonObject["data"]
                if (dataElement != null) {
                    val decoded = json.decodeFromJsonElement(deserializer, dataElement)
                    AppResult.success(decoded)
                } else {
                    val errors = jsonElement.jsonObject["errors"]
                    AppResult.error(
                        Exception("GraphQL error"),
                        errors?.toString() ?: "Unknown GraphQL error"
                    )
                }
            } else {
                AppResult.error(
                    HttpException(response.status.value, response.status.description),
                    "HTTP ${response.status.value}"
                )
            }
        } catch (e: Exception) {
            Napier.e(tag = "GraphQL") { "Request failed: ${e.message}" }
            AppResult.error(e, e.message)
        }
    }

    // jsonObject extension is now imported from kotlinx.serialization.json.jsonObject
}

/**
 * Use this as the `body` when calling GraphqlApiClient.post().
 */
data class GraphqlRequest(
    val query: String,
    val variables: Map<String, Any?>? = null
)

@Serializable
internal data class GraphqlRequestBody(
    val query: String,
    val variables: JsonElement? = null
)
