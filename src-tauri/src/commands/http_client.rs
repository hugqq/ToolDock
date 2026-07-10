use crate::core::http_client::{execute_request, HttpClientError};
use crate::models::http_client::{HttpDebugRequest, HttpDebugResponse};
use serde::Serialize;

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

#[tauri::command]
pub async fn send_http_request(
    request: HttpDebugRequest,
) -> Result<HttpDebugResponse, HttpCommandError> {
    execute_request(request).await.map_err(Into::into)
}
