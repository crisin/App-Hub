//! Core logic of the app. The rule for everything under `crates/`: no Tauri
//! types, no window handles — the shell in `src-tauri` adapts this crate to
//! commands and events. That keeps the logic testable with `cargo test` and
//! the shell replaceable.

/// Build the greeting shown by the starter UI.
pub fn greet(name: &str) -> String {
    let name = name.trim();
    if name.is_empty() {
        "Hello! Type a name to get greeted from Rust.".to_string()
    } else {
        format!("Hello, {name}! This greeting came from the app-core crate.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greets_by_name() {
        assert!(greet("Appa").contains("Appa"));
    }

    #[test]
    fn handles_empty_input() {
        assert!(greet("   ").starts_with("Hello!"));
    }
}
