use crate::errors::AppError;
use crate::models::search::{FileSearchResponse, FileSearchResult};
use objc2::rc::autoreleasepool;
use objc2::runtime::AnyObject;
use objc2_foundation::{
    NSArray, NSDate, NSMetadataItemPathKey, NSMetadataQuery,
    NSMetadataQueryLocalComputerScope, NSPredicate, NSRunLoop, NSString,
};
use std::path::Path;
use std::time::{Duration, Instant, SystemTime};

fn error_response(error_code: &str, available: bool) -> FileSearchResponse {
    FileSearchResponse {
        provider: "spotlight".into(),
        available,
        results: vec![],
        error_code: Some(error_code.into()),
    }
}

fn normalize_metadata(path: &Path) -> FileSearchResult {
    let metadata = std::fs::metadata(path).ok();
    let is_directory = metadata.as_ref().is_some_and(|value| value.is_dir());
    let modified_at = metadata
        .as_ref()
        .and_then(|value| value.modified().ok())
        .and_then(|value| value.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as i64);
    FileSearchResult {
        kind: if is_directory { "directory" } else { "file" }.into(),
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string_lossy().into_owned()),
        path: path.to_string_lossy().into_owned(),
        modified_at,
        size: metadata
            .as_ref()
            .filter(|_| !is_directory)
            .map(|value| value.len()),
        icon_data_url: None,
    }
}

fn escaped_metadata_query(query: &str) -> String {
    let escaped = query.replace('\\', "\\\\").replace('"', "\\\"");
    format!(r#"kMDItemFSName ==[cd] \"*{escaped}*\""#)
}

fn perform_search(query: String, limit: usize) -> FileSearchResponse {
    autoreleasepool(|_| {
        let query_string = NSString::from_str(&escaped_metadata_query(&query));
        let Some(predicate) = NSPredicate::predicateFromMetadataQueryString(&query_string) else {
            return error_response("query_failed", true);
        };
        let metadata_query = NSMetadataQuery::new();
        metadata_query.setPredicate(Some(&predicate));
        let scope = unsafe { NSMetadataQueryLocalComputerScope };
        let scope_object: &AnyObject = scope.as_ref();
        let scopes = NSArray::from_slice(&[scope_object]);
        unsafe { metadata_query.setSearchScopes(&scopes) };

        if !metadata_query.startQuery() {
            return error_response("provider_unavailable", false);
        }

        let deadline = Instant::now() + Duration::from_secs(2);
        let run_loop = NSRunLoop::currentRunLoop();
        while metadata_query.isGathering() && Instant::now() < deadline {
            let next_tick = NSDate::dateWithTimeIntervalSinceNow(0.05);
            run_loop.runUntilDate(&next_tick);
        }

        let timed_out = metadata_query.isGathering();
        metadata_query.disableUpdates();
        let count = metadata_query.resultCount().min(limit);
        let mut results = Vec::with_capacity(count);
        for index in 0..count {
            let Some(value) = metadata_query
                .valueOfAttribute_forResultAtIndex(unsafe { NSMetadataItemPathKey }, index)
            else {
                continue;
            };
            if let Some(path) = value.downcast_ref::<NSString>() {
                results.push(normalize_metadata(Path::new(&path.to_string())));
            }
        }
        metadata_query.stopQuery();

        if timed_out && results.is_empty() {
            error_response("query_failed", true)
        } else {
            FileSearchResponse {
                provider: "spotlight".into(),
                available: true,
                results,
                error_code: None,
            }
        }
    })
}

pub async fn provider_status() -> FileSearchResponse {
    FileSearchResponse {
        provider: "spotlight".into(),
        available: true,
        results: vec![],
        error_code: None,
    }
}

pub async fn search(query: &str, limit: usize) -> Result<FileSearchResponse, AppError> {
    let query = query.to_owned();
    tauri::async_runtime::spawn_blocking(move || perform_search(query, limit))
        .await
        .map_err(|error| AppError::Internal(format!("Spotlight worker failed: {error}")))
}

#[cfg(test)]
mod tests {
    use super::escaped_metadata_query;

    #[test]
    fn escapes_metadata_query_quotes() {
        assert_eq!(
            escaped_metadata_query("draft\"one"),
            r#"kMDItemFSName ==[cd] \"*draft\\\"one*\""#
        );
    }
}
