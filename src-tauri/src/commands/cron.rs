/*
 * Cron 表达式命令层
 * 负责处理前端请求并调用核心逻辑
 */

use crate::errors::AppResult;
use crate::core::cron;

/// 获取 Cron 表达式的下几次运行时间
/// 
/// # 参数
/// * `expression` - Cron 表达式字符串
/// * `count` - 需要获取的运行时间数量
/// 
/// # 返回
/// * `AppResult<Vec<String>>` - 成功返回时间字符串列表，失败返回错误信息
#[tauri::command]
pub async fn get_cron_next_runs(expression: String, count: usize) -> AppResult<Vec<String>> {
    cron::get_next_runs(&expression, count).map_err(|e| crate::errors::AppError::Internal(e))
}

/// 使用 AI 生成 Cron 表达式
#[tauri::command]
pub async fn generate_cron_with_ai(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    input: String,
) -> AppResult<String> {
    cron::generate_with_ai(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
        &input,
    )
    .await
}
