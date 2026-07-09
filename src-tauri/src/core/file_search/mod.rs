use crate::errors::AppError;
use crate::models::search::FileSearchResponse;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod unsupported;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
use unsupported as platform;
#[cfg(target_os = "windows")]
use windows as platform;

pub fn validate_query(query: &str) -> Result<&str, &'static str> {
    let query = query.trim();
    if query.is_empty() {
        Err("EMPTY_QUERY")
    } else {
        Ok(query)
    }
}

pub fn normalize_limit(limit: usize) -> usize {
    limit.clamp(1, 100)
}

pub async fn provider_status() -> FileSearchResponse {
    platform::provider_status().await
}

pub async fn search_files(
    query: String,
    limit: usize,
) -> Result<FileSearchResponse, AppError> {
    let query = validate_query(&query).map_err(|code| AppError::Internal(code.into()))?;
    platform::search(query, normalize_limit(limit)).await
}

#[cfg(test)]
mod tests {
    use super::{normalize_limit, validate_query};

    #[test]
    fn rejects_blank_queries() {
        assert_eq!(validate_query("   ").unwrap_err(), "EMPTY_QUERY");
    }

    #[test]
    fn clamps_limits_to_safe_range() {
        assert_eq!(normalize_limit(0), 1);
        assert_eq!(normalize_limit(50), 50);
        assert_eq!(normalize_limit(500), 100);
    }
}
