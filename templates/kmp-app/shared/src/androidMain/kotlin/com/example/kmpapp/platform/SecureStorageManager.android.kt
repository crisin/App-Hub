package com.example.kmpapp.platform

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

actual class SecureStorageManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "kmp_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    actual suspend fun saveString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    actual suspend fun getString(key: String): String? {
        return prefs.getString(key, null)
    }

    actual suspend fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }

    actual suspend fun clear() {
        prefs.edit().clear().apply()
    }
}
