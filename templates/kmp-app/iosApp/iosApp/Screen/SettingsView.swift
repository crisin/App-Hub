import SwiftUI

/// Settings screen with grouped sections.
///
/// Add your own settings rows here. The sign-out action is
/// delegated to the caller via onLogout.
struct SettingsView: View {
    let onLogout: () -> Void
    var onBack: (() -> Void)?

    var body: some View {
        List {
            Section("Account") {
                Label("Profile", systemImage: "person.circle")
                Label("Notifications", systemImage: "bell")
            }

            Section("App") {
                Label("Appearance", systemImage: "paintbrush")
                Label("Language", systemImage: "globe")
            }

            Section("About") {
                HStack {
                    Label("Version", systemImage: "info.circle")
                    Spacer()
                    Text("1.0.0")
                        .foregroundColor(.secondary)
                }
                Label("Licenses", systemImage: "doc.text")
            }

            Section {
                Button(role: .destructive) {
                    onLogout()
                } label: {
                    Text("Sign Out")
                }
            }
        }
        .navigationTitle("Settings")
    }
}

#Preview {
    NavigationStack {
        SettingsView(onLogout: {})
    }
}
