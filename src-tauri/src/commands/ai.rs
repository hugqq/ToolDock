use crate::errors::AppResult;
use crate::core::ai;
use tauri::{Emitter, Window};

#[tauri::command]
pub async fn ask_ai(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    system_prompt: String,
    user_prompt: String,
) -> AppResult<String> {
    tracing::info!("[CMD ask_ai] Invoked: provider={}, model={}, base_url={:?}", provider, model, base_url);
    let result = ai::ask_ai(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
        &system_prompt,
        &user_prompt,
    )
    .await;
    match &result {
        Ok(s) => tracing::info!("[CMD ask_ai] OK, {} chars", s.len()),
        Err(e) => tracing::error!("[CMD ask_ai] Error: {:?}", e),
    }
    result
}

#[tauri::command]
pub async fn ask_ai_stream(
    window: Window,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    system_prompt: String,
    user_prompt: String,
) -> AppResult<String> {
    tracing::info!("[CMD ask_ai_stream] Invoked: provider={}, model={}", provider, model);
    let result = ai::ask_ai_stream(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
        &system_prompt,
        &user_prompt,
        |chunk| {
            let _ = window.emit("ai-stream-chunk", chunk);
        },
    )
    .await;
    let _ = window.emit("ai-stream-done", "");
    match &result {
        Ok(s) => tracing::info!("[CMD ask_ai_stream] OK, {} chars", s.len()),
        Err(e) => tracing::error!("[CMD ask_ai_stream] Error: {:?}", e),
    }
    result
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
