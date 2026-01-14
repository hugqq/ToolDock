/// 批量重命名命令层
use crate::core::renamer::{self, RenameRule};
use crate::models::{ApiResponse, RenameRuleDto, RenamePreview, RenameHistoryItem, ApiErrorDetail};

#[tauri::command]
pub async fn preview_batch_rename(paths: Vec<String>, rule: RenameRuleDto) -> ApiResponse<Vec<RenamePreview>> {
    let core_rule = RenameRule {
        prefix: rule.prefix,
        suffix: rule.suffix,
        search: rule.search,
        replace: rule.replace,
        use_regex: rule.use_regex,
        case_sensitive: rule.case_sensitive,
        auto_increment: rule.auto_increment,
        sequence_start: rule.sequence_start,
        sequence_step: rule.sequence_step,
        sequence_padding: rule.sequence_padding,
        // 高级选项
        apply_to: rule.apply_to,
        include_files: rule.include_files,
        include_folders: rule.include_folders,
        include_subfolders: rule.include_subfolders,
        text_formatting: rule.text_formatting,
        enumerate_items: rule.enumerate_items,
        random_string: rule.random_string,
        use_datetime: rule.use_datetime,
    };

    let results = renamer::preview_rename(paths, core_rule);
    let preview = results.into_iter().map(|(old_path, new_name)| RenamePreview {
        old_path,
        new_name,
    }).collect();

    ApiResponse {
        ok: true,
        data: Some(preview),
        error: None,
    }
}

#[tauri::command]
pub async fn execute_batch_rename(renames: Vec<RenamePreview>) -> ApiResponse<Vec<RenameHistoryItem>> {
    let core_renames = renames.into_iter().map(|r| (r.old_path, r.new_name)).collect();
    
    match renamer::execute_rename(core_renames) {
        Ok(entries) => {
            let history_items: Vec<RenameHistoryItem> = entries.into_iter().map(|e| RenameHistoryItem {
                current_path: e.current_path,
                original_name: e.original_name,
                timestamp: e.timestamp,
            }).collect();
            ApiResponse {
                ok: true,
                data: Some(history_items),
                error: None,
            }
        },
        Err(e) => ApiResponse {
            ok: false,
            data: None,
            error: Some(ApiErrorDetail {
                code: "RENAME_ERROR".into(),
                message: e,
            }),
        },
    }
}

/// 获取所有重命名历史记录
#[tauri::command]
pub async fn get_rename_history() -> ApiResponse<Vec<RenameHistoryItem>> {
    let entries = renamer::get_all_rename_history();
    let history_items: Vec<RenameHistoryItem> = entries.into_iter().map(|e| RenameHistoryItem {
        current_path: e.current_path,
        original_name: e.original_name,
        timestamp: e.timestamp,
    }).collect();
    ApiResponse::ok(history_items)
}

/// 还原单个文件的重命名
#[tauri::command]
pub async fn revert_single_rename(current_path: String) -> ApiResponse<String> {
    match renamer::revert_rename(&current_path) {
        Ok(new_path) => ApiResponse::ok(new_path),
        Err(e) => ApiResponse::error(e.clone(), e),
    }
}

/// 批量还原重命名
#[tauri::command]
pub async fn revert_batch_rename(paths: Vec<String>) -> ApiResponse<Vec<(String, String)>> {
    match renamer::revert_renames(paths) {
        Ok(results) => ApiResponse::ok(results),
        Err(e) => ApiResponse::error("REVERT_ERROR", e),
    }
}

/// 清除所有重命名历史记录
#[tauri::command]
pub async fn clear_rename_history() -> ApiResponse<()> {
    renamer::clear_rename_history();
    ApiResponse::ok(())
}
