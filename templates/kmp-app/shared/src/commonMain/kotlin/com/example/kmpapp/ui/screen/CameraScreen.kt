package com.example.kmpapp.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.datetime.Clock

/**
 * Represents a saved photo in the local gallery.
 * In a real app, [filePath] would point to actual file storage.
 * Here we use a simulated in-memory list for demonstration.
 */
data class SavedPhoto(
    val id: String,
    val name: String,
    val timestamp: Long,
    val sizeKb: Int
)

/**
 * Photo gallery screen — demonstrates image capture/pick workflow.
 *
 * Since actual camera capture requires platform-specific UI (photo picker,
 * camera intent), this screen simulates the workflow with placeholder data.
 * The CameraManager expect/actual stubs are ready to wire up when you
 * implement the native capture logic.
 *
 * Features demonstrated:
 * - Grid layout for photo gallery
 * - Add/remove items from a list
 * - Confirmation dialog before deletion
 * - Empty state handling
 */
@Composable
fun CameraScreen() {
    val photos = remember { mutableStateListOf<SavedPhoto>() }
    var photoToDelete by remember { mutableStateOf<SavedPhoto?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Action buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = {
                    // Simulate capturing a photo
                    val now = Clock.System.now().toEpochMilliseconds()
                    photos.add(
                        SavedPhoto(
                            id = "photo-$now",
                            name = "Photo ${photos.size + 1}",
                            timestamp = now,
                            sizeKb = (100..2048).random()
                        )
                    )
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Take Photo")
            }

            OutlinedButton(
                onClick = {
                    // Simulate picking from gallery
                    val now = Clock.System.now().toEpochMilliseconds()
                    photos.add(
                        SavedPhoto(
                            id = "picked-$now",
                            name = "Import ${photos.size + 1}",
                            timestamp = now,
                            sizeKb = (200..4096).random()
                        )
                    )
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Pick Image")
            }
        }

        if (photos.isEmpty()) {
            // Empty state
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "\uD83D\uDCF7",
                        style = MaterialTheme.typography.displayLarge
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No photos yet",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Take a photo or pick one from your gallery",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            // Photo count
            Text(
                text = "${photos.size} photo${if (photos.size != 1) "s" else ""} saved",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            // Photo grid
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 140.dp),
                contentPadding = PaddingValues(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(photos, key = { it.id }) { photo ->
                    PhotoCard(
                        photo = photo,
                        onDelete = { photoToDelete = photo }
                    )
                }
            }
        }
    }

    // Delete confirmation dialog
    photoToDelete?.let { photo ->
        AlertDialog(
            onDismissRequest = { photoToDelete = null },
            title = { Text("Delete Photo") },
            text = { Text("Remove \"${photo.name}\" from saved photos?") },
            confirmButton = {
                TextButton(onClick = {
                    photos.remove(photo)
                    photoToDelete = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { photoToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun PhotoCard(photo: SavedPhoto, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Placeholder image area with colored background
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(
                        MaterialTheme.colorScheme.primaryContainer,
                        RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "\uD83D\uDDBC\uFE0F",
                    style = MaterialTheme.typography.headlineLarge
                )

                // Delete badge
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.errorContainer)
                        .clickable { onDelete() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "\u2715",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            // Photo info
            Column(modifier = Modifier.padding(8.dp)) {
                Text(
                    text = photo.name,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1
                )
                Text(
                    text = "${photo.sizeKb} KB",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
