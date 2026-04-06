package com.example.kmpapp.platform

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryAddValue
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFDictionaryRef
import platform.CoreFoundation.CFMutableDictionaryRef
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFTypeRefVar
import platform.CoreFoundation.kCFBooleanTrue
import platform.Foundation.CFBridgingRelease
import platform.Foundation.CFBridgingRetain
import platform.Foundation.NSData
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

/**
 * iOS secure storage backed by the system Keychain.
 *
 * Stores key-value strings as kSecClassGenericPassword items,
 * grouped under [serviceName]. The Keychain encrypts data at rest
 * and protects it with the device passcode / biometrics.
 *
 * Uses CFDictionary (not NSDictionary/Kotlin Map) for Keychain queries
 * because Security framework constants (kSecClass, kSecAttrService, etc.)
 * are CFStringRef pointers — they don't bridge to Kotlin String and can't
 * be used as NSDictionary keys via setValue(forKey:). CFDictionaryAddValue
 * accepts raw pointers natively, avoiding all bridging issues.
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
actual class SecureStorageManager {

    private val serviceName = "com.crisin.kmpapp.secure"

    /**
     * Creates a base Keychain query with class + service + account.
     * Caller must call CFRelease on the returned dictionary when done.
     */
    private fun baseQuery(key: String): CFMutableDictionaryRef {
        val dict = CFDictionaryCreateMutable(null, 4, null, null)!!
        CFDictionaryAddValue(dict, kSecClass, kSecClassGenericPassword)
        CFDictionaryAddValue(dict, kSecAttrService, CFBridgingRetain(serviceName))
        CFDictionaryAddValue(dict, kSecAttrAccount, CFBridgingRetain(key))
        return dict
    }

    actual suspend fun saveString(key: String, value: String) {
        // Keychain doesn't upsert — delete first, then add.
        remove(key)

        val valueData = (value as NSString).dataUsingEncoding(NSUTF8StringEncoding) ?: return
        val query = baseQuery(key)
        CFDictionaryAddValue(query, kSecValueData, CFBridgingRetain(valueData))

        SecItemAdd(query as CFDictionaryRef, null)
        CFRelease(query)
    }

    actual suspend fun getString(key: String): String? {
        val query = baseQuery(key)
        CFDictionaryAddValue(query, kSecReturnData, kCFBooleanTrue)
        CFDictionaryAddValue(query, kSecMatchLimit, kSecMatchLimitOne)

        memScoped {
            val result = alloc<CFTypeRefVar>()
            val status = SecItemCopyMatching(query as CFDictionaryRef, result.ptr)
            CFRelease(query)

            return if (status == errSecSuccess) {
                val data = CFBridgingRelease(result.value) as? NSData ?: return null
                NSString.create(data = data, encoding = NSUTF8StringEncoding) as? String
            } else {
                null
            }
        }
    }

    actual suspend fun remove(key: String) {
        val query = baseQuery(key)
        SecItemDelete(query as CFDictionaryRef)
        CFRelease(query)
    }

    actual suspend fun clear() {
        val dict = CFDictionaryCreateMutable(null, 2, null, null)!!
        CFDictionaryAddValue(dict, kSecClass, kSecClassGenericPassword)
        CFDictionaryAddValue(dict, kSecAttrService, CFBridgingRetain(serviceName))
        SecItemDelete(dict as CFDictionaryRef)
        CFRelease(dict)
    }
}
