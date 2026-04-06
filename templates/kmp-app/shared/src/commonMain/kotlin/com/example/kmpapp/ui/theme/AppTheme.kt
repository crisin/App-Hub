package com.example.kmpapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Shared Material 3 theme used by all platforms.
 *
 * Platforms can wrap this with their own system-theme detection
 * (e.g. Android dynamic colors, iOS trait collection).
 */

private val LightColors = lightColorScheme(
    primary = Color(0xFF6200EE),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE8DEF8),
    secondary = Color(0xFF03DAC6),
    onSecondary = Color.Black,
    surface = Color(0xFFFFFBFE),
    onSurface = Color(0xFF1C1B1F),
    background = Color(0xFFFFFBFE),
    onBackground = Color(0xFF1C1B1F),
    error = Color(0xFFB3261E),
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    primaryContainer = Color(0xFF4F378B),
    secondary = Color(0xFFCCC2DC),
    onSecondary = Color(0xFF332D41),
    surface = Color(0xFF1C1B1F),
    onSurface = Color(0xFFE6E1E5),
    background = Color(0xFF1C1B1F),
    onBackground = Color(0xFFE6E1E5),
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
)

@Composable
fun AppTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
