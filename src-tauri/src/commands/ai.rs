use crate::errors::AppResult;
use crate::core::ai;

#[tauri::command]
pub async fn ask_ai(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    system_prompt: String,
    user_prompt: String,
) -> AppResult<String> {
    ai::ask_ai(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
        &system_prompt,
        &user_prompt,
    )
    .await
}

#[tauri::command]
pub async fn ask_nginx_ai(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    content: String,
    error: String,
) -> AppResult<String> {
    ai::ask_nginx_ai(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
        &content,
        &error,
    )
    .await
}
