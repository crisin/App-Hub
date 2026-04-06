package com.example.kmpapp.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.datetime.Clock

/**
 * Push notification test screen.
 *
 * Allows testing the notification workflow without a real push service:
 * - Register/unregister for notifications (simulated)
 * - Send local test notifications
 * - View notification log
 *
 * When you wire up real APNs/FCM, replace the simulated actions
 * with calls to NotificationManager from Koin.
 */
@Composable
fun NotificationsScreen() {
    var isRegistered by remember { mutableStateOf(false) }
    var deviceToken by remember { mutableStateOf<String?>(null) }
    var customTitle by remember { mutableStateOf("Test Notification") }
    var customBody by remember { mutableStateOf("This is a test push notification.") }
    val notificationLog = remember { mutableStateListOf<NotificationLogEntry>() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Registration section
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Registration",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Push Notifications")
                            Text(
                                text = if (isRegistered) "Registered" else "Not registered",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (isRegistered)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(
                            checked = isRegistered,
                            onCheckedChange = { enabled ->
                                isRegistered = enabled
                                if (enabled) {
                                    // Simulate registration — replace with NotificationManager.register()
                                    deviceToken = "demo-token-${Clock.System.now().toEpochMilliseconds()}"
                                    notificationLog.add(
                                        0,
                                        NotificationLogEntry(
                                            title = "System",
                                            body = "Registered for push notifications",
                                            timestamp = Clock.System.now().toEpochMilliseconds(),
                                            isSystem = true
                                        )
                                    )
                                } else {
                                    deviceToken = null
                                    notificationLog.add(
                                        0,
                                        NotificationLogEntry(
                                            title = "System",
                                            body = "Unregistered from push notifications",
                                            timestamp = Clock.System.now().toEpochMilliseconds(),
                                            isSystem = true
                                        )
                                    )
                                }
                            }
                        )
                    }

                    deviceToken?.let { token ->
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Token: ${token.take(24)}...",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Send test notification
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Send Test Notification",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = customTitle,
                        onValueChange = { customTitle = it },
                        label = { Text("Title") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = customBody,
                        onValueChange = { customBody = it },
                        label = { Text("Body") },
                        maxLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                notificationLog.add(
                                    0,
                                    NotificationLogEntry(
                                        title = customTitle,
                                        body = customBody,
                                        timestamp = Clock.System.now().toEpochMilliseconds(),
                                        isSystem = false
                                    )
                                )
                            },
                            enabled = isRegistered && customTitle.isNotBlank()
                        ) {
                            Text("Send")
                        }

                        OutlinedButton(
                            onClick = { notificationLog.clear() },
                            enabled = notificationLog.isNotEmpty()
                        ) {
                            Text("Clear Log")
                        }
                    }

                    if (!isRegistered) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Enable push notifications above to send test messages",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Notification log
        item {
            Text(
                text = "Notification Log (${notificationLog.size})",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        if (notificationLog.isEmpty()) {
            item {
                Text(
                    text = "No notifications yet. Register and send a test notification.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            items(notificationLog) { entry ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = if (entry.isSystem)
                        CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    else CardDefaults.cardColors()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = entry.title,
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(
                            text = entry.body,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(16.dp)) }
    }
}

private data class NotificationLogEntry(
    val title: String,
    val body: String,
    val timestamp: Long,
    val isSystem: Boolean
)
