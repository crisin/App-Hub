package com.example.kmpapp.data.local

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.datetime.Clock

/**
 * Generic caching layer backed by SQLDelight.
 * Stores/retrieves JSON strings with TTL-based expiry.
 */
class CacheManager(private val database: AppDatabase) {

    private val queries get() = database.appDatabaseQueries

    /**
     * Retrieve a cached value if it hasn't expired.
     */
    suspend fun get(key: String): String? = withContext(Dispatchers.Default) {
        val now = Clock.System.now().toEpochMilliseconds()
        queries.getCacheEntry(key, now).executeAsOneOrNull()?.json_value
    }

    /**
     * Store a value with a TTL (time-to-live) in milliseconds.
     * Default TTL: 5 minutes.
     */
    suspend fun put(key: String, value: String, ttlMs: Long = 300_000L) = withContext(Dispatchers.Default) {
        val now = Clock.System.now().toEpochMilliseconds()
        queries.insertCacheEntry(
            cache_key = key,
            json_value = value,
            cached_at = now,
            expires_at = now + ttlMs
        )
    }

    /**
     * Remove a specific cache entry.
     */
    suspend fun remove(key: String) = withContext(Dispatchers.Default) {
        queries.deleteCacheEntry(key)
    }

    /**
     * Purge all expired entries.
     */
    suspend fun purgeExpired() = withContext(Dispatchers.Default) {
        val now = Clock.System.now().toEpochMilliseconds()
        queries.deleteExpiredCacheEntries(now)
    }

    /**
     * Clear entire cache.
     */
    suspend fun clearAll() = withContext(Dispatchers.Default) {
        queries.deleteAllCacheEntries()
    }
}
