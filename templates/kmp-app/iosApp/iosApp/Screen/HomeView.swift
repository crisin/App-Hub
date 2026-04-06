import SwiftUI

/// Home screen — main landing after login.
///
/// Shows dashboard-style cards as a starting point.
/// Replace with your app's real content (feed, list, etc.).
struct HomeView: View {
    let onLogout: () -> Void
    var onSettings: (() -> Void)?

    private let cards: [(title: String, description: String)] = [
        ("Getting Started", "This template includes login, session persistence, navigation, and DI out of the box."),
        ("Recent Activity", "Wire up your data layer to show real content here. The architecture is ready."),
        ("Quick Actions", "Add buttons, shortcuts, or actions your users need most.")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Dashboard")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Your app starts here. Replace these cards with real content.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                ForEach(cards, id: \.title) { card in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(card.title)
                            .font(.headline)
                        Text(card.description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(12)
                }
            }
            .padding()
        }
        .navigationTitle("Home")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { onSettings?() }) {
                    Image(systemName: "gear")
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        HomeView(onLogout: {}, onSettings: {})
    }
}
