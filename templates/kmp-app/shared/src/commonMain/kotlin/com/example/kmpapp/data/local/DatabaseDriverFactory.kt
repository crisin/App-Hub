package com.example.kmpapp.data.local

/**
 * Platform-specific SQLDelight driver factory.
 * Each platform provides its own SqlDriver implementation.
 */
expect class DatabaseDriverFactory {
    fun createDriver(): app.cash.sqldelight.db.SqlDriver
}
