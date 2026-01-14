use crate::core::hash;
use crate::models::ApiResponse;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
pub struct DuplicateFile {
    pub path: String,
    pub size: u64,
    pub hash: String,
}

#[derive(Serialize, Clone)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub count: usize,
    pub files: Vec<DuplicateFile>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScanProgress {
    pub scanned_files: usize,
    pub total_files: usize,
    pub percentage: f64,
    pub current_file: String,
}

#[tauri::command]
pub fn find_duplicate_files(app: AppHandle, path: String) -> ApiResponse<String> {
    // 立即返回确认，然后在后台处理扫描
    let app_clone = app.clone();

    std::thread::spawn(move || {
        match hash::find_duplicates(
            &path,
            |scanned_files, total_files, percentage, current_file| {
                // 发送进度事件
                let _ = app_clone.emit(
                    "duplicate-scan-progress",
                    ScanProgress {
                        scanned_files,
                        total_files,
                        percentage,
                        current_file: current_file.to_string(),
                    },
                );
            },
        ) {
            Ok(duplicates) => {
                let groups: Vec<DuplicateGroup> = duplicates
                    .into_iter()
                    .map(|group| DuplicateGroup {
                        hash: group.hash,
                        size: group.size,
                        count: group.count,
                        files: group
                            .files
                            .into_iter()
                            .map(|f| DuplicateFile {
                                path: f.path,
                                size: f.size,
                                hash: f.hash,
                            })
                            .collect(),
                    })
                    .collect();

                // 扫描完成，发送最终结果事件
                let _ = app_clone.emit(
                    "duplicate-scan-complete",
                    serde_json::json!({
                        "duplicates": groups
                    }),
                );
            }
            Err(e) => {
                // 发送错误事件
                let _ = app_clone.emit(
                    "duplicate-scan-error",
                    serde_json::json!({
                        "error": e.to_string()
                    }),
                );
            }
        }
    });

    ApiResponse {
        ok: true,
        data: Some("Scan started in background".into()),
        error: None,
    }
}
