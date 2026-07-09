use crate::core::http_client::{execute_request, HttpClientError};
use crate::core::http_history_db::HttpHistoryDb;
use crate::models::http_client::{
    HttpDebugRequest, HttpHistoryEntry, SendHttpResult,
};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

pub struct HttpHistoryState(pub Mutex<Option<HttpHistoryDb>>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpCommandError {
    pub code: String,
    pub message: String,
}

impl HttpCommandError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl From<HttpClientError> for HttpCommandError {
    fn from(error: HttpClientError) -> Self {
        Self::new(error.code(), error.to_string())
    }
}

fn get_db_path(app: &AppHandle) -> Result<PathBuf, HttpCommandError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| HttpCommandError::new("HISTORY_PATH_FAILED", error.to_string()))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| HttpCommandError::new("HISTORY_PATH_FAILED", error.to_string()))?;
    Ok(app_data_dir.join("tooldock.db"))
}

fn with_history_db<T>(
    app: &AppHandle,
    state: &HttpHistoryState,
    action: impl FnOnce(&HttpHistoryDb) -> Result<T, crate::core::http_history_db::HttpHistoryError>,
) -> Result<T, HttpCommandError> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| HttpCommandError::new("HISTORY_LOCK_FAILED", "History database lock failed"))?;
    if guard.is_none() {
        let path = get_db_path(app)?;
        *guard = Some(HttpHistoryDb::new(path).map_err(|error| {
            HttpCommandError::new("HISTORY_DB_FAILED", error.to_string())
        })?);
    }

    action(guard.as_ref().expect("HTTP history database is initialized"))
        .map_err(|error| HttpCommandError::new("HISTORY_DB_FAILED", error.to_string()))
}

#[tauri::command]
pub async fn send_http_request(
    app: AppHandle,
    state: State<'_, HttpHistoryState>,
    request: HttpDebugRequest,
) -> Result<SendHttpResult, HttpCommandError> {
    let history_request = request.clone();
    let response = execute_request(request).await?;
    let history = HttpHistoryEntry {
        id: Uuid::new_v4().to_string(),
        request: history_request,
        response_status: response.status,
        duration_ms: response.duration_ms,
        created_at: chrono::Utc::now().timestamp_millis(),
    };
    let history_saved = with_history_db(&app, &state, |db| db.save(&history)).is_ok();

    Ok(SendHttpResult {
        response,
        history_saved,
    })
}

#[tauri::command]
pub fn list_http_history(
    app: AppHandle,
    state: State<'_, HttpHistoryState>,
) -> Result<Vec<HttpHistoryEntry>, HttpCommandError> {
    with_history_db(&app, &state, HttpHistoryDb::load_all)
}

#[tauri::command]
pub fn delete_http_history(
    app: AppHandle,
    state: State<'_, HttpHistoryState>,
    id: String,
) -> Result<(), HttpCommandError> {
    with_history_db(&app, &state, |db| db.delete(&id))
}

#[tauri::command]
pub fn clear_http_history(
    app: AppHandle,
    state: State<'_, HttpHistoryState>,
) -> Result<(), HttpCommandError> {
    with_history_db(&app, &state, HttpHistoryDb::clear)
}
