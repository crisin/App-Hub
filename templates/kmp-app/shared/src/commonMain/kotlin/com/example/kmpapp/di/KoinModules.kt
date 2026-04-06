package com.example.kmpapp.di

import com.example.kmpapp.data.api.ApiBackendConfig
import com.example.kmpapp.data.api.ApiClient
import com.example.kmpapp.data.api.GraphqlApiClient
import com.example.kmpapp.data.api.RestApiClient
import com.example.kmpapp.data.api.interceptors.AuthInterceptor
import com.example.kmpapp.data.api.interceptors.LoggingInterceptor
import com.example.kmpapp.data.api.interceptors.RetryInterceptor
import com.example.kmpapp.data.local.AppDatabase
import com.example.kmpapp.data.local.CacheManager
import com.example.kmpapp.data.local.DatabaseDriverFactory
import com.example.kmpapp.data.repository.AuthRepositoryImpl
import com.example.kmpapp.data.repository.DemoAuthRepository
import com.example.kmpapp.data.repository.LocationRepositoryImpl
import com.example.kmpapp.data.repository.NotificationRepositoryImpl
import com.example.kmpapp.domain.repository.AuthRepository
import com.example.kmpapp.domain.repository.LocationRepository
import com.example.kmpapp.domain.repository.NotificationRepository
import com.example.kmpapp.domain.usecase.LoginUseCase
import com.example.kmpapp.features.auth.presentation.LoginViewModel
import com.example.kmpapp.presentation.navigation.Navigator
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * ============================================
 * DEMO MODE
 * ============================================
 * Set to true to use a fake auth backend (accepts any email/password).
 * Set to false and configure [apiConfig] when your real backend is ready.
 */
val useDemoMode: Boolean = true

/**
 * ============================================
 * CONFIGURE YOUR API HERE
 * ============================================
 * Change the baseUrl to point at your backend.
 * Switch to ApiBackendConfig.GraphQL for GraphQL.
 * Only used when [useDemoMode] is false.
 */
val apiConfig: ApiBackendConfig = ApiBackendConfig.Rest(
    baseUrl = "https://api.example.com/v1",
    timeout = 30_000L,
    retryCount = 3
)

// To use GraphQL instead, replace the above with:
// val apiConfig: ApiBackendConfig = ApiBackendConfig.GraphQL(
//     baseUrl = "https://api.example.com/graphql",
//     timeout = 30_000L
// )

/**
 * Network module — API client with interceptors.
 * Automatically selects REST or GraphQL based on [apiConfig].
 */
val networkModule = module {
    single<ApiBackendConfig> { apiConfig }
    single<ApiClient> {
        val client: ApiClient = when (val config = get<ApiBackendConfig>()) {
            is ApiBackendConfig.Rest -> RestApiClient(config)
            is ApiBackendConfig.GraphQL -> GraphqlApiClient(config)
        }
        client.apply {
            addInterceptor(LoggingInterceptor(isDebug = true))
            addInterceptor(RetryInterceptor())
            addInterceptor(AuthInterceptor(get()))
        }
    }
}

/**
 * Local database and caching.
 *
 * Uses lazy creation (createdAtStart = false, the default) so platforms
 * where SQLDelight isn't available (web) don't crash at Koin startup.
 * The database is only instantiated when a feature first requests it.
 */
val databaseModule = module {
    single {
        val driver = get<DatabaseDriverFactory>().createDriver()
        AppDatabase(driver)
    }
    single { CacheManager(get()) }
}

/**
 * Repository bindings — data layer implementations.
 *
 * In demo mode, [DemoAuthRepository] is used instead of [AuthRepositoryImpl].
 * It accepts any credentials and returns a fake user — no backend needed.
 */
val repositoryModule = module {
    single<AuthRepository> {
        if (useDemoMode) {
            DemoAuthRepository(get())
        } else {
            AuthRepositoryImpl(get(), get(), get())
        }
    }
    single<LocationRepository> { LocationRepositoryImpl(get()) }
    single<NotificationRepository> { NotificationRepositoryImpl(get()) }
}

/**
 * Use cases — domain layer orchestration.
 */
val useCaseModule = module {
    factory { LoginUseCase(get()) }
}

/**
 * ViewModels — presentation logic.
 */
val viewModelModule = module {
    factory { LoginViewModel(get(), get()) }
}

/**
 * Navigation.
 */
val navigationModule = module {
    single { Navigator() }
}

/**
 * Collect all shared modules.
 * Platform modules (platformModule) are added in each platform's initialization.
 */
val sharedModules: List<Module> = listOf(
    networkModule,
    databaseModule,
    repositoryModule,
    useCaseModule,
    viewModelModule,
    navigationModule
)

/**
 * Platform-specific Koin module.
 * Each platform (Android/iOS/Web) provides its own implementation.
 */
expect val platformModule: Module
