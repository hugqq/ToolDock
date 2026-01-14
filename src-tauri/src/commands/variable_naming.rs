/**
 * 变量命名命令层
 * 职责：接收前端请求并调用核心逻辑
 */
use crate::core::variable_naming;
use crate::models::variable_naming::NamingResult;
use crate::errors::AppError;

#[tauri::command]
pub async fn generate_variable_names(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    input: String,
    language: String,
) -> Result<Vec<NamingResult>, AppError> {
    variable_naming::generate_names(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
        &input,
        &language,
    )
    .await
}
