use crate::core::web_server::{start_server, stop_server, get_server_status, SharedWebServerState, WebServerError};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<ApiErrorDetail>,
}

#[derive(Debug, Serialize)]
pub struct ApiErrorDetail {
    pub code: String,
    pub message_key: String,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: &str, message_key: &str) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(ApiErrorDetail {
                code: code.to_string(),
                message_key: message_key.to_string(),
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartServerRequest {
    pub root_dir: String,
    pub port: u16,
}

#[derive(Debug, Serialize)]
pub struct StartServerResponse {
    pub url: String,
    pub port: u16,
    pub ip: String,
}

#[derive(Debug, Serialize)]
pub struct ServerStatusResponse {
    pub is_running: bool,
    pub port: u16,
    pub ip: String,
}

#[tauri::command]
pub async fn start_web_server(
    request: StartServerRequest,
    state: tauri::State<'_, SharedWebServerState>,
) -> Result<ApiResponse<StartServerResponse>, String> {
    let root_dir = PathBuf::from(&request.root_dir);
    
    match start_server(state.inner().clone(), root_dir, request.port).await {
        Ok(url) => {
            let (_, port, ip) = get_server_status(state.inner().clone()).await;
            Ok(ApiResponse::success(StartServerResponse {
                url,
                port,
                ip,
            }))
        }
        Err(e) => {
            let (code, message_key) = match e {
                WebServerError::FolderNotFound => ("FOLDER_NOT_FOUND", "tools.simple_web_server.folder_not_found"),
                WebServerError::InvalidPort => ("INVALID_PORT", "tools.simple_web_server.invalid_port"),
                WebServerError::PortInUse => ("PORT_IN_USE", "tools.simple_web_server.port_in_use"),
                WebServerError::AccessDenied => ("ACCESS_DENIED", "tools.simple_web_server.access_denied"),
                WebServerError::AlreadyRunning => ("ALREADY_RUNNING", "tools.simple_web_server.server_running"),
                _ => ("START_FAILED", "tools.simple_web_server.start_failed"),
            };
            Ok(ApiResponse::error(code, message_key))
        }
    }
}

#[tauri::command]
pub async fn stop_web_server(
    state: tauri::State<'_, SharedWebServerState>,
) -> Result<ApiResponse<()>, String> {
    match stop_server(state.inner().clone()).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => {
            let (code, message_key) = match e {
                WebServerError::NotRunning => ("NOT_RUNNING", "tools.simple_web_server.server_stopped"),
                _ => ("STOP_FAILED", "tools.simple_web_server.stop_failed"),
            };
            Ok(ApiResponse::error(code, message_key))
        }
    }
}

#[tauri::command]
pub async fn get_web_server_status(
    state: tauri::State<'_, SharedWebServerState>,
) -> Result<ApiResponse<ServerStatusResponse>, String> {
    let (is_running, port, ip) = get_server_status(state.inner().clone()).await;
    Ok(ApiResponse::success(ServerStatusResponse {
        is_running,
        port,
        ip,
    }))
}
