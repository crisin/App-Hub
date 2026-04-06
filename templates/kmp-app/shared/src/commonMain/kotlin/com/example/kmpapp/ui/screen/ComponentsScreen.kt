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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

/**
 * UI component showcase — tests all common Material 3 components.
 *
 * Useful for verifying that Compose Multiplatform renders correctly
 * across iOS, Android, and Web. Each section is self-contained with
 * its own state so components can be tested independently.
 */
@Composable
fun ComponentsScreen() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { SectionHeader("Text Fields") }
        item { TextFieldsSection() }

        item { SectionHeader("Buttons") }
        item { ButtonsSection() }

        item { SectionHeader("Selection Controls") }
        item { SelectionSection() }

        item { SectionHeader("Dropdown") }
        item { DropdownSection() }

        item { SectionHeader("Slider") }
        item { SliderSection() }

        item { SectionHeader("Progress Indicators") }
        item { ProgressSection() }

        item { SectionHeader("Chips") }
        item { ChipsSection() }

        item { Spacer(modifier = Modifier.height(32.dp)) }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Column {
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(vertical = 4.dp)
        )
    }
}

@Composable
private fun TextFieldsSection() {
    var filledText by remember { mutableStateOf("") }
    var outlinedText by remember { mutableStateOf("") }
    var numberText by remember { mutableStateOf("") }
    var errorText by remember { mutableStateOf("") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            TextField(
                value = filledText,
                onValueChange = { filledText = it },
                label = { Text("Filled Text Field") },
                placeholder = { Text("Type something...") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = outlinedText,
                onValueChange = { outlinedText = it },
                label = { Text("Outlined Text Field") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = numberText,
                onValueChange = { numberText = it },
                label = { Text("Number Input") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = errorText,
                onValueChange = { errorText = it },
                label = { Text("With Validation") },
                isError = errorText.isNotEmpty() && errorText.length < 3,
                supportingText = {
                    if (errorText.isNotEmpty() && errorText.length < 3) {
                        Text("Must be at least 3 characters")
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun ButtonsSection() {
    var clickCount by remember { mutableStateOf(0) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Clicked $clickCount time${if (clickCount != 1) "s" else ""}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Button(onClick = { clickCount++ }, modifier = Modifier.weight(1f)) {
                    Text("Filled")
                }
                ElevatedButton(onClick = { clickCount++ }, modifier = Modifier.weight(1f)) {
                    Text("Elevated")
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                FilledTonalButton(onClick = { clickCount++ }, modifier = Modifier.weight(1f)) {
                    Text("Tonal")
                }
                OutlinedButton(onClick = { clickCount++ }, modifier = Modifier.weight(1f)) {
                    Text("Outlined")
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                TextButton(onClick = { clickCount++ }, modifier = Modifier.weight(1f)) {
                    Text("Text")
                }
                Button(
                    onClick = {},
                    enabled = false,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Disabled")
                }
            }
        }
    }
}

@Composable
private fun SelectionSection() {
    var switchOn by remember { mutableStateOf(false) }
    var checkboxChecked by remember { mutableStateOf(false) }
    var selectedRadio by remember { mutableStateOf(0) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Switch
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Switch: ${if (switchOn) "On" else "Off"}")
                Switch(checked = switchOn, onCheckedChange = { switchOn = it })
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // Checkbox
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(checked = checkboxChecked, onCheckedChange = { checkboxChecked = it })
                Text("Checkbox: ${if (checkboxChecked) "Checked" else "Unchecked"}")
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // Radio buttons
            Text("Radio Group:", style = MaterialTheme.typography.bodyMedium)
            val options = listOf("Option A", "Option B", "Option C")
            options.forEachIndexed { index, label ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = selectedRadio == index,
                        onClick = { selectedRadio = index }
                    )
                    Text(label)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownSection() {
    var expanded by remember { mutableStateOf(false) }
    var selectedOption by remember { mutableStateOf("Select an option") }
    val options = listOf("Small", "Medium", "Large", "Extra Large")

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = selectedOption,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Size") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                        .fillMaxWidth()
                )

                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    options.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option) },
                            onClick = {
                                selectedOption = option
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SliderSection() {
    var sliderValue by remember { mutableStateOf(0.5f) }
    var discreteValue by remember { mutableStateOf(3f) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("Continuous: ${(sliderValue * 100).toInt()}%")
            Slider(
                value = sliderValue,
                onValueChange = { sliderValue = it },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text("Discrete (steps): ${discreteValue.toInt()}")
            Slider(
                value = discreteValue,
                onValueChange = { discreteValue = it },
                valueRange = 1f..5f,
                steps = 3,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun ProgressSection() {
    var progress by remember { mutableStateOf(0.65f) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Determinate: ${(progress * 100).toInt()}%")
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth()
            )

            // Control the progress
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { progress = (progress - 0.1f).coerceAtLeast(0f) }
                ) { Text("-10%") }
                OutlinedButton(
                    onClick = { progress = (progress + 0.1f).coerceAtMost(1f) }
                ) { Text("+10%") }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text("Indeterminate:")
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ChipsSection() {
    val chipLabels = listOf("Swift", "Kotlin", "Compose", "SwiftUI", "React")
    val selectedChips = remember { mutableStateListOf("Kotlin", "Compose") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Selected: ${selectedChips.joinToString(", ").let { if (it.isEmpty()) "None" else it }}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Chips laid out in two rows to avoid overflow
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                chipLabels.take(3).forEach { label ->
                    FilterChip(
                        selected = label in selectedChips,
                        onClick = {
                            if (label in selectedChips) selectedChips.remove(label)
                            else selectedChips.add(label)
                        },
                        label = { Text(label) }
                    )
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                chipLabels.drop(3).forEach { label ->
                    FilterChip(
                        selected = label in selectedChips,
                        onClick = {
                            if (label in selectedChips) selectedChips.remove(label)
                            else selectedChips.add(label)
                        },
                        label = { Text(label) }
                    )
                }
            }
        }
    }
}
