package com.example.kmpapp.di

import com.example.kmpapp.data.local.DatabaseDriverFactory
import com.example.kmpapp.platform.BiometricAuthManager
import com.example.kmpapp.platform.CameraManager
import com.example.kmpapp.platform.LocationManager
import com.example.kmpapp.platform.NotificationManager
import com.example.kmpapp.platform.SecureStorageManager
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformModule: Module = module {
    single { DatabaseDriverFactory() }
    single { SecureStorageManager() }
    single { BiometricAuthManager() }
    single { CameraManager() }
    single { LocationManager() }
    single { NotificationManager() }
}
