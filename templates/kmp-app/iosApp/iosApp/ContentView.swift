import SwiftUI
import shared

struct ContentView: View {
    private let loginViewModel = KoinIosHelperKt.loginViewModel()

    @State private var currentRoute: String = "/splash"
    @State private var navHandle: NavigationHandle?
    @State private var selectedTab: String = "/home"

    private let tabRoutes = ["/home", "/camera", "/components", "/notifications"]

    var body: some View {
        Group {
            switch currentRoute {
            case "/login":
                NavigationStack {
                    LoginView(viewModel: loginViewModel)
                }
            case "/splash":
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            default:
                authenticatedView
            }
        }
        .onAppear {
            navHandle = KoinIosHelperKt.observeNavigation { routePath in
                DispatchQueue.main.async {
                    if routePath == "/login" || routePath == "/splash" {
                        self.currentRoute = routePath
                    } else if self.tabRoutes.contains(routePath) {
                        self.selectedTab = routePath
                        self.currentRoute = routePath
                    } else {
                        self.currentRoute = routePath
                    }
                }
            }
            checkExistingSession()
        }
        .onDisappear {
            navHandle?.cancel()
        }
    }

    private var authenticatedView: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeView(onLogout: { logout() }, onSettings: {
                    currentRoute = "/settings"
                })
                .navigationDestination(isPresented: Binding(
                    get: { currentRoute == "/settings" },
                    set: { if !$0 { currentRoute = selectedTab } }
                )) {
                    SettingsView(onLogout: { logout() })
                }
            }
            .tabItem {
                Label("Home", systemImage: "house")
            }
            .tag("/home")

            NavigationStack {
                CameraView()
            }
            .tabItem {
                Label("Photos", systemImage: "camera")
            }
            .tag("/camera")

            NavigationStack {
                ComponentsView()
            }
            .tabItem {
                Label("UI Kit", systemImage: "square.grid.2x2")
            }
            .tag("/components")

            NavigationStack {
                NotificationsView()
            }
            .tabItem {
                Label("Alerts", systemImage: "bell")
            }
            .tag("/notifications")
        }
        .onChange(of: selectedTab) { _, newTab in
            currentRoute = newTab
        }
    }

    private func checkExistingSession() {
        KoinIosHelperKt.checkSession { isLoggedIn in
            DispatchQueue.main.async {
                self.currentRoute = isLoggedIn.boolValue ? "/home" : "/login"
                self.selectedTab = "/home"
            }
        }
    }

    private func logout() {
        KoinIosHelperKt.performLogout()
    }
}

#Preview {
    ContentView()
}
