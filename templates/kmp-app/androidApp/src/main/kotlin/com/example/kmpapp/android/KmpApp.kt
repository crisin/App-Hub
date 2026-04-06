package com.example.kmpapp.android

import android.app.Application
import com.example.kmpapp.di.platformModule
import com.example.kmpapp.di.sharedModules
import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class KmpApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Initialize logging
        Napier.base(DebugAntilog())

        // Initialize Koin DI
        startKoin {
            androidContext(this@KmpApp)
            modules(sharedModules + platformModule)
        }
    }
}
