// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // llm-api のサイドカーをバックグラウンドで起動
            // tauri.conf.json の externalBin の指定と完全に一致させる必要があります ("bin/llm-api")
            match app.shell().sidecar("llm-api") {
                Ok(sidecar_command) => {
                    match sidecar_command.spawn() {
                        Ok((_rx, _child)) => {
                            println!("Successfully spawned llm-api sidecar.");
                        }
                        Err(e) => {
                            // 開発中はPyInstallerのexeが存在しないことが多いため、エラーではなく「手動起動モード」として扱う
                            println!("Sidecar binary not found. Assuming manual Python server is running. ({})", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to create llm-api sidecar command: {}", e);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
