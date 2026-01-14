use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Internal error: {0}")]
    Internal(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;
