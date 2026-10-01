//! Tauri shell. Keep it thin: commands translate between the UI and the
//! crates in `crates/`, nothing more. Logic that grows here belongs in a crate.

#[tauri::command]
fn greet(name: &str) -> String {
    app_core::greet(name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
