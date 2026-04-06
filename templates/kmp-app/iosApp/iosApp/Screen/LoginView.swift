import SwiftUI
import shared

/// Login screen — driven by the shared LoginViewModel.
///
/// The ViewModel handles all logic: input state, API calls, error display.
/// On successful login, it calls navigator.navigateTo(Route.Home) which
/// ContentView observes — no callback needed here.
struct LoginView: View {
    let viewModel: LoginViewModel

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var observer: FlowObserver<LoginUiState>?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("Welcome")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Sign in to continue")
                .font(.body)
                .foregroundColor(.secondary)

            VStack(spacing: 16) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .onChange(of: email) { _, newValue in
                        viewModel.onEmailChanged(email: newValue)
                    }

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.password)
                    .onChange(of: password) { _, newValue in
                        viewModel.onPasswordChanged(password: newValue)
                    }
            }
            .padding(.horizontal)

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(.horizontal)
            }

            Button(action: {
                viewModel.onLoginClicked()
            }) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Sign In")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(email.isEmpty || password.isEmpty || isLoading)
            .padding(.horizontal)

            Button(action: {
                viewModel.onBiometricLoginClicked()
            }) {
                Text("Sign in with Biometrics")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .padding(.horizontal)

            Spacer()
        }
        .onAppear {
            observer = FlowObserver<LoginUiState>(
                flow: viewModel.state
            ) { state in
                guard let uiState = state as? LoginUiState else { return }
                DispatchQueue.main.async {
                    self.isLoading = uiState.isLoading
                    self.errorMessage = uiState.errorMessage
                }
            }
        }
        .onDisappear {
            observer?.cancel()
        }
    }
}

#Preview {
    LoginView(viewModel: KoinIosHelperKt.loginViewModel())
}
