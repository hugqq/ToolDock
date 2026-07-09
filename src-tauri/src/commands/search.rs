use crate::core::file_search;
use crate::errors::AppError;
use crate::models::search::FileSearchResponse;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn get_file_search_status() -> FileSearchResponse {
    file_search::provider_status().await
}

#[tauri::command]
pub async fn search_local_files(
    query: String,
    limit: usize,
) -> Result<FileSearchResponse, AppError> {
    file_search::search_files(query, limit).await
}

#[tauri::command]
pub fn open_search_result(app: AppHandle, path: String) -> Result<(), AppError> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err(AppError::Internal("SEARCH_RESULT_MISSING".into()));
    }
    app.opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| AppError::Internal(error.to_string()))
}
