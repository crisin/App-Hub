import SwiftUI
import shared

@main
struct KmpAppApp: App {

    init() {
        // Initialize Koin DI from the shared Kotlin module.
        // Kotlin/Native exports top-level function initKoinIos() as doInitKoinIos()
        // (the "do" prefix avoids clashing with Obj-C init* selector naming).
        KoinIosHelperKt.doInitKoinIos()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onTapGesture {
                    // Dismiss keyboard when tapping outside any text field.
                    // Applied at the app root so it works on every screen.
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil
                    )
                }
        }
    }
}
