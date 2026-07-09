use crate::errors::AppError;
use crate::models::search::FileSearchResponse;

fn response() -> FileSearchResponse {
    FileSearchResponse {
        provider: "unsupported".into(),
        available: false,
        results: vec![],
        error_code: Some("unsupported_platform".into()),
    }
}

pub async fn provider_status() -> FileSearchResponse {
    response()
}

pub async fn search(_query: &str, _limit: usize) -> Result<FileSearchResponse, AppError> {
    Ok(response())
}
