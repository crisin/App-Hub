package com.example.kmpapp.platform

import kotlinx.browser.window

/**
 * Web secure storage using localStorage.
 *
 * SECURITY NOTE: localStorage is NOT encrypted and is accessible to any
 * JavaScript running on the same origin (XSS risk). For production apps
 * handling sensitive tokens, consider:
 *   - HttpOnly cookies for auth tokens (set by your backend, not JS)
 *   - Web Crypto API for client-side encryption before storing
 *   - IndexedDB with encryption for larger data
 *
 * FIX: Changed from sessionStorage (lost on tab close) to localStorage
 * (persists across sessions). This matches the persistence behavior of
 * Android SharedPreferences and iOS Keychain.
 */
actual class SecureStorageManager {

    private val prefix = "kmp_secure_"

    actual suspend fun saveString(key: String, value: String) {
        window.localStorage.setItem(prefix + key, value)
    }

    actual suspend fun getString(key: String): String? {
        return window.localStorage.getItem(prefix + key)
    }

    actual suspend fun remove(key: String) {
        window.localStorage.removeItem(prefix + key)
    }

    actual suspend fun clear() {
        // Only clear items with our prefix, not all localStorage
        val keysToRemove = mutableListOf<String>()
        for (i in 0 until window.localStorage.length) {
            val storageKey = window.localStorage.key(i) ?: continue
            if (storageKey.startsWith(prefix)) {
                keysToRemove.add(storageKey)
            }
        }
        keysToRemove.forEach { window.localStorage.removeItem(it) }
    }
}
