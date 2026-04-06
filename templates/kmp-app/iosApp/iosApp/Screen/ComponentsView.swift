import SwiftUI

/// UI component showcase — tests all common SwiftUI components.
///
/// Mirrors the shared ComponentsScreen composable.
/// Useful for verifying platform-native rendering and comparing
/// with the Compose Multiplatform version on web.
struct ComponentsView: View {
    var body: some View {
        List {
            Section("Text Fields") {
                TextFieldsSection()
            }

            Section("Buttons") {
                ButtonsSection()
            }

            Section("Selection Controls") {
                SelectionSection()
            }

            Section("Picker") {
                PickerSection()
            }

            Section("Slider") {
                SliderSection()
            }

            Section("Progress") {
                ProgressSection()
            }
        }
        .navigationTitle("Components")
    }
}

// MARK: - Text Fields

private struct TextFieldsSection: View {
    @State private var plainText = ""
    @State private var secureText = ""
    @State private var numberText = ""
    @State private var validatedText = ""

    var body: some View {
        TextField("Plain Text Field", text: $plainText)

        SecureField("Secure Field", text: $secureText)

        TextField("Number Input", text: $numberText)
            .keyboardType(.numberPad)

        VStack(alignment: .leading) {
            TextField("With Validation (min 3 chars)", text: $validatedText)
            if !validatedText.isEmpty && validatedText.count < 3 {
                Text("Must be at least 3 characters")
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
    }
}

// MARK: - Buttons

private struct ButtonsSection: View {
    @State private var clickCount = 0

    var body: some View {
        Text("Clicked \(clickCount) time\(clickCount == 1 ? "" : "s")")
            .font(.caption)
            .foregroundColor(.secondary)

        HStack(spacing: 12) {
            Button("Filled") { clickCount += 1 }
                .buttonStyle(.borderedProminent)
            Button("Tonal") { clickCount += 1 }
                .buttonStyle(.bordered)
                .tint(.purple)
        }

        HStack(spacing: 12) {
            Button("Outlined") { clickCount += 1 }
                .buttonStyle(.bordered)
            Button("Destructive") { clickCount += 1 }
                .buttonStyle(.bordered)
                .tint(.red)
        }

        HStack(spacing: 12) {
            Button("Plain") { clickCount += 1 }
            Button("Disabled") {}
                .disabled(true)
        }
    }
}

// MARK: - Selection Controls

private struct SelectionSection: View {
    @State private var switchOn = false
    @State private var checkboxChecked = false
    @State private var selectedRadio = 0

    var body: some View {
        Toggle("Switch: \(switchOn ? "On" : "Off")", isOn: $switchOn)

        Toggle("Checkbox", isOn: $checkboxChecked)

        VStack(alignment: .leading) {
            Text("Radio Group:")
                .font(.subheadline)
            ForEach(0..<3) { index in
                let labels = ["Option A", "Option B", "Option C"]
                HStack {
                    Image(systemName: selectedRadio == index ? "circle.inset.filled" : "circle")
                        .foregroundColor(selectedRadio == index ? .blue : .secondary)
                    Text(labels[index])
                }
                .onTapGesture { selectedRadio = index }
            }
        }
    }
}

// MARK: - Picker

private struct PickerSection: View {
    @State private var selectedOption = "Medium"
    let options = ["Small", "Medium", "Large", "Extra Large"]

    var body: some View {
        Picker("Size", selection: $selectedOption) {
            ForEach(options, id: \.self) { option in
                Text(option).tag(option)
            }
        }
        .pickerStyle(.menu)

        Picker("Segmented", selection: $selectedOption) {
            ForEach(["Small", "Medium", "Large"], id: \.self) { option in
                Text(option).tag(option)
            }
        }
        .pickerStyle(.segmented)
    }
}

// MARK: - Slider

private struct SliderSection: View {
    @State private var sliderValue = 0.5
    @State private var discreteValue = 3.0

    var body: some View {
        VStack(alignment: .leading) {
            Text("Continuous: \(Int(sliderValue * 100))%")
            Slider(value: $sliderValue)
        }

        VStack(alignment: .leading) {
            Text("Discrete (steps): \(Int(discreteValue))")
            Slider(value: $discreteValue, in: 1...5, step: 1)
        }
    }
}

// MARK: - Progress

private struct ProgressSection: View {
    @State private var progress = 0.65

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Determinate: \(Int(progress * 100))%")
            ProgressView(value: progress)

            HStack {
                Button("-10%") { progress = max(0, progress - 0.1) }
                    .buttonStyle(.bordered)
                Button("+10%") { progress = min(1, progress + 0.1) }
                    .buttonStyle(.bordered)
            }
        }

        VStack(alignment: .leading, spacing: 8) {
            Text("Indeterminate:")
            ProgressView()
        }
    }
}

#Preview {
    NavigationStack {
        ComponentsView()
    }
}
