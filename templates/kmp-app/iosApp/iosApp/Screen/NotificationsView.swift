import SwiftUI

/// Push notification test screen.
///
/// Simulates the notification workflow — register, send test notifications,
/// view a log. Wire up UNUserNotificationCenter for real push when ready.
struct NotificationsView: View {
    @State private var isRegistered = false
    @State private var deviceToken: String?
    @State private var customTitle = "Test Notification"
    @State private var customBody = "This is a test push notification."
    @State private var notificationLog: [NotificationLogEntry] = []

    var body: some View {
        List {
            // Registration
            Section("Registration") {
                Toggle(isOn: $isRegistered) {
                    VStack(alignment: .leading) {
                        Text("Push Notifications")
                        Text(isRegistered ? "Registered" : "Not registered")
                            .font(.caption)
                            .foregroundColor(isRegistered ? .blue : .secondary)
                    }
                }
                .onChange(of: isRegistered) { _, enabled in
                    if enabled {
                        deviceToken = "demo-token-\(Int(Date().timeIntervalSince1970))"
                        addLogEntry(title: "System", body: "Registered for push notifications", isSystem: true)
                    } else {
                        deviceToken = nil
                        addLogEntry(title: "System", body: "Unregistered from push notifications", isSystem: true)
                    }
                }

                if let token = deviceToken {
                    Text("Token: \(String(token.prefix(24)))...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Send test notification
            Section("Send Test Notification") {
                TextField("Title", text: $customTitle)
                TextField("Body", text: $customBody, axis: .vertical)
                    .lineLimit(1...3)

                HStack {
                    Button("Send") {
                        addLogEntry(title: customTitle, body: customBody, isSystem: false)
                    }
                    .disabled(!isRegistered || customTitle.isEmpty)
                    .buttonStyle(.borderedProminent)

                    Button("Clear Log") {
                        notificationLog.removeAll()
                    }
                    .disabled(notificationLog.isEmpty)
                    .buttonStyle(.bordered)
                }

                if !isRegistered {
                    Text("Enable push notifications above to send test messages")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Log
            Section("Notification Log (\(notificationLog.count))") {
                if notificationLog.isEmpty {
                    Text("No notifications yet. Register and send a test notification.")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(notificationLog) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(entry.title)
                                    .font(.headline)
                                if entry.isSystem {
                                    Text("SYSTEM")
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.2))
                                        .cornerRadius(4)
                                }
                            }
                            Text(entry.body)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Notifications")
    }

    private func addLogEntry(title: String, body: String, isSystem: Bool) {
        let entry = NotificationLogEntry(
            id: UUID().uuidString,
            title: title,
            body: body,
            timestamp: Date(),
            isSystem: isSystem
        )
        notificationLog.insert(entry, at: 0)
    }
}

private struct NotificationLogEntry: Identifiable {
    let id: String
    let title: String
    let body: String
    let timestamp: Date
    let isSystem: Bool
}

#Preview {
    NavigationStack {
        NotificationsView()
    }
}
