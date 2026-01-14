use crate::core::diff::{self, DiffResult};
use crate::models::ApiResponse;
use tauri::command;

#[command]
pub async fn diff_text(old_text: String, new_text: String) -> ApiResponse<DiffResult> {
    let result = diff::compare_text(&old_text, &new_text);
    ApiResponse::ok(result)
}
