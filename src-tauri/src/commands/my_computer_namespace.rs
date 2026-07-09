use crate::core::my_computer_namespace;
use crate::models::ApiResponse;
use tauri::Manager;

#[tauri::command]
pub async fn scan_my_computer_namespace_icons(
) -> ApiResponse<Vec<my_computer_namespace::MyComputerNamespaceItem>> {
    match my_computer_namespace::scan_icons() {
        Ok(items) => ApiResponse::ok(items),
        Err(e) => ApiResponse::error("SCAN_MY_COMPUTER_NAMESPACE_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn delete_my_computer_namespace_icons(
    app: tauri::AppHandle,
    key_names: Vec<String>,
) -> ApiResponse<my_computer_namespace::DeleteMyComputerNamespaceResult> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("data"));

    match my_computer_namespace::delete_icons(&data_dir, key_names) {
        Ok(result) => ApiResponse::ok(result),
        Err(e) => ApiResponse::error("DELETE_MY_COMPUTER_NAMESPACE_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn list_my_computer_namespace_backups(
    app: tauri::AppHandle,
) -> ApiResponse<Vec<my_computer_namespace::MyComputerNamespaceBackup>> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("data"));

    match my_computer_namespace::list_latest_backup(&data_dir) {
        Ok(backups) => ApiResponse::ok(backups),
        Err(e) => ApiResponse::error("LIST_MY_COMPUTER_NAMESPACE_BACKUPS_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn restore_my_computer_namespace_backup(
    app: tauri::AppHandle,
    backup_path: String,
) -> ApiResponse<()> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("data"));

    match my_computer_namespace::restore_backup(&data_dir, std::path::Path::new(&backup_path)) {
        Ok(_) => ApiResponse::ok(()),
        Err(e) => ApiResponse::error("RESTORE_MY_COMPUTER_NAMESPACE_BACKUP_FAILED", e.to_string()),
    }
}
