package com.example.kmpapp.data.local

import app.cash.sqldelight.db.SqlDriver

/**
 * Web SQLDelight driver factory.
 *
 * SQLDelight's web-worker-driver requires async initialization which
 * doesn't fit the synchronous createDriver() expect/actual API.
 *
 * The database is not available on the web platform. Koin registers
 * it lazily, so this only throws if a feature actually tries to use
 * the database. Features that need offline storage on web should use
 * localStorage or IndexedDB directly.
 *
 * To add full web database support, implement async initialization
 * with the sqljs-driver:
 *   https://cashapp.github.io/sqldelight/2.0.0/js_sqlite/
 */
actual class DatabaseDriverFactory {
    actual fun createDriver(): SqlDriver {
        throw UnsupportedOperationException(
            "SQLDelight is not available on web. " +
            "Use in-memory caching or implement async driver initialization."
        )
    }
}
