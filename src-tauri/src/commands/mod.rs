pub mod ai;
pub mod clicker;
pub mod clipboard;
pub mod color;
pub mod cron;
pub mod diff;
pub mod dns;
pub mod file;
pub mod hash;
pub mod hotkey;
pub mod image_convert;
pub mod ip_lookup;
pub mod network;
pub mod nginx;
pub mod notepad;
pub mod ocr;
pub mod pip_player;
pub mod port_scanner;
pub mod renamer;
pub mod settings;
pub mod timestamp;
pub mod translator;
pub mod unit_converter;
pub mod variable_naming;
pub mod web_server;
pub mod wechat_assistant;
pub mod weread;

#[tauri::command]
pub async fn reveal_in_explorer(path: String) -> Result<(), crate::errors::AppError> {
    use std::process::Command;
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| crate::errors::AppError::Io(e))?;
    }
    Ok(())
}
