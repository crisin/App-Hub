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
    single { DatabaseDriverFactory(get()) }
    single { SecureStorageManager(get()) }
    single { BiometricAuthManager(get()) }
    single { CameraManager(get()) }
    single { LocationManager(get()) }
    single { NotificationManager() }
}
