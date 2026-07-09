use crate::errors::AppError;
use crate::models::search::{FileSearchResponse, FileSearchResult};
use everything_ipc::wm::{EverythingClient, RequestFlags, Sort};
use std::path::{Path, PathBuf};

fn error_response(error_code: &str, available: bool) -> FileSearchResponse {
    FileSearchResponse {
        provider: "everything".into(),
        available,
        results: vec![],
        error_code: Some(error_code.into()),
    }
}

fn normalize_item(
    name: &str,
    parent: &str,
    is_directory: bool,
    size: Option<u64>,
    modified_at: Option<i64>,
) -> FileSearchResult {
    let path = PathBuf::from(parent).join(name);
    FileSearchResult {
        kind: if is_directory { "directory" } else { "file" }.into(),
        name: name.into(),
        path: path.to_string_lossy().into_owned(),
        modified_at,
        size: if is_directory { None } else { size },
    }
}

pub async fn provider_status() -> FileSearchResponse {
    match tauri::async_runtime::spawn_blocking(|| EverythingClient::new().is_ok()).await {
        Ok(true) => FileSearchResponse {
            provider: "everything".into(),
            available: true,
            results: vec![],
            error_code: None,
        },
        _ => error_response("provider_unavailable", false),
    }
}

pub async fn search(query: &str, limit: usize) -> Result<FileSearchResponse, AppError> {
    let query = query.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let client = match EverythingClient::new() {
            Ok(client) => client,
            Err(_) => return error_response("provider_unavailable", false),
        };
        let list = match client
            .query_wait(&query)
            .request_flags(
                RequestFlags::FileName
                    | RequestFlags::Path
                    | RequestFlags::Size
                    | RequestFlags::DateModified,
            )
            .sort(Sort::NameAscending)
            .max_results(limit as u32)
            .call()
        {
            Ok(list) => list,
            Err(_) => return error_response("query_failed", true),
        };

        let results = list
            .iter()
            .filter_map(|item| {
                let name = item.get_string(RequestFlags::FileName)?;
                let parent = item.get_string(RequestFlags::Path)?;
                let full_path = Path::new(&parent).join(&name);
                let is_directory = full_path.is_dir();
                let size = item.get_size(RequestFlags::Size);
                let modified_at = item.get_time(RequestFlags::DateModified).and_then(|time| {
                    const WINDOWS_TO_UNIX_EPOCH_TICKS: u64 = 116_444_736_000_000_000;
                    let ticks = ((time.dwHighDateTime as u64) << 32) | time.dwLowDateTime as u64;
                    ticks
                        .checked_sub(WINDOWS_TO_UNIX_EPOCH_TICKS)
                        .map(|value| (value / 10_000) as i64)
                });
                Some(normalize_item(&name, &parent, is_directory, size, modified_at))
            })
            .collect();

        FileSearchResponse {
            provider: "everything".into(),
            available: true,
            results,
            error_code: None,
        }
    })
    .await
    .map_err(|error| AppError::Internal(format!("Everything search worker failed: {error}")))
}

#[cfg(test)]
mod tests {
    use super::normalize_item;

    #[test]
    fn joins_everything_name_and_parent_path() {
        let item = normalize_item("notes.txt", r"C:\Users\me", false, Some(42), Some(7));
        assert_eq!(item.path, r"C:\Users\me\notes.txt");
        assert_eq!(item.kind, "file");
        assert_eq!(item.size, Some(42));

        let directory = normalize_item("docs", r"C:\Users\me", true, Some(42), None);
        assert_eq!(directory.kind, "directory");
        assert_eq!(directory.size, None);
    }
}
