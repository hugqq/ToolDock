use std::path::PathBuf;
use crate::core::nginx;
use crate::errors::AppResult;

#[tauri::command]
pub async fn read_nginx_config(path: String) -> AppResult<String> {
    nginx::read_config(PathBuf::from(path))
}

#[tauri::command]
pub async fn write_nginx_config(path: String, content: String) -> AppResult<()> {
    nginx::write_config(PathBuf::from(path), &content)
}

#[tauri::command]
pub async fn test_nginx_config(path: String, nginx_path: Option<String>) -> AppResult<String> {
    nginx::test_config(PathBuf::from(path), nginx_path)
}

#[tauri::command]
pub async fn create_nginx_backup(path: String) -> AppResult<String> {
    nginx::create_backup(PathBuf::from(path))
}

#[tauri::command]
pub async fn restore_nginx_backup(path: String, backup_path: String) -> AppResult<()> {
    nginx::restore_backup(PathBuf::from(path), PathBuf::from(backup_path))
}

#[tauri::command]
pub async fn list_nginx_backups(path: String) -> AppResult<Vec<nginx::BackupInfo>> {
    nginx::list_backups(PathBuf::from(path))
}

#[tauri::command]
pub async fn delete_nginx_backup(backup_path: String) -> AppResult<()> {
    nginx::delete_backup(PathBuf::from(backup_path))
}

#[tauri::command]
pub async fn start_nginx(path: String, nginx_path: Option<String>) -> AppResult<()> {
    nginx::start_nginx(PathBuf::from(path), nginx_path)
}

#[tauri::command]
pub async fn stop_nginx(nginx_path: Option<String>) -> AppResult<()> {
    nginx::stop_nginx(nginx_path)
}

#[tauri::command]
pub async fn is_nginx_running() -> bool {
    nginx::is_nginx_running()
}

#[tauri::command]
pub async fn scan_nginx_configs() -> Vec<String> {
    nginx::scan_configs()
}
