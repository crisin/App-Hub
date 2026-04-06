package com.example.kmpapp.platform

/**
 * Platform-agnostic secure storage.
 *
 * - Android: EncryptedSharedPreferences
 * - iOS: Keychain
 * - Web: sessionStorage (with optional encryption)
 */
expect class SecureStorageManager {
    suspend fun saveString(key: String, value: String)
    suspend fun getString(key: String): String?
    suspend fun remove(key: String)
    suspend fun clear()
}
