package com.example.kmpapp.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Settings screen with grouped sections.
 *
 * Add your own settings rows here. Each row is a simple composable —
 * wire toggles, navigation, or dialogs as needed for your app.
 * The sign-out action is delegated to the caller via [onLogout].
 */
@Composable
fun SettingsScreen(onLogout: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Account section
        SettingsSection(title = "Account")
        SettingsRow(label = "Profile", detail = "Edit your profile")
        SettingsRow(label = "Notifications", detail = "Manage push notifications")
        HorizontalDivider()

        // App section
        SettingsSection(title = "App")
        SettingsRow(label = "Appearance", detail = "Light / Dark / System")
        SettingsRow(label = "Language", detail = "System default")
        HorizontalDivider()

        // About section
        SettingsSection(title = "About")
        SettingsRow(label = "Version", detail = "1.0.0")
        SettingsRow(label = "Licenses", detail = "Open source licenses")
        HorizontalDivider()

        // Sign out
        Text(
            text = "Sign Out",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onLogout() }
                .padding(16.dp)
        )
    }
}

@Composable
private fun SettingsSection(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 24.dp, end = 16.dp, bottom = 8.dp)
    )
}

@Composable
private fun SettingsRow(label: String, detail: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { /* Wire up navigation or dialogs here */ }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyLarge)
        Text(
            text = detail,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
