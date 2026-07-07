use crate::errors::{AppError, AppResult};
use crate::models::TranslationResult;
use crate::core::translator::TranslationEngine;

/// Tauri 命令层：暴露给前端的 translate_text 接口
/// 参数说明：
/// - text: 要翻译的文本
/// - target: 目标语言（例如 "zh-CN" 或 "en"）
/// - source: 可选源语言（例如 "en"），为空则由服务自动检测
/// - engine: 翻译引擎 ("google", "deepl", "baidu", "youdao", "tencent", "volcengine")
/// - api_key: 可选的 API Key
#[tauri::command]
pub async fn translate_text(
    text: String,
    target: String,
    source: Option<String>,
    engine: Option<String>,
    api_key: Option<String>,
) -> AppResult<TranslationResult> {
    if text.trim().is_empty() {
        return Err(AppError::Internal("Empty text".into()));
    }
    if target.trim().is_empty() {
        return Err(AppError::Internal("Target language is required".into()));
    }

    let engine_type = match engine.as_deref() {
        Some("deepl") => TranslationEngine::DeepL,
        Some("baidu") => TranslationEngine::Baidu,
        Some("youdao") => TranslationEngine::Youdao,
        Some("tencent") => TranslationEngine::Tencent,
        Some("volcengine") => TranslationEngine::Volcengine,
        _ => TranslationEngine::Google,
    };

    // 优先使用传入的 key，如果没有则尝试从环境变量读取
    let key = match api_key {
        Some(k) if !k.trim().is_empty() => Some(k),
        _ => {
            let env_var = match engine_type {
                TranslationEngine::DeepL => "DEEPL_API_KEY",
                TranslationEngine::Baidu => "BAIDU_TRANSLATE_API_KEY",
                TranslationEngine::Youdao => "YOUDAO_TRANSLATE_API_KEY",
                TranslationEngine::Tencent => "TENCENT_TRANSLATE_API_KEY",
                TranslationEngine::Volcengine => "VOLCENGINE_TRANSLATE_API_KEY",
                _ => "GOOGLE_TRANSLATE_API_KEY",
            };
            std::env::var(env_var).ok()
        }
    };

    crate::core::translator::translate_text(
        engine_type,
        &text,
        &target,
        source.as_deref(),
        key.as_deref(),
    ).await
}

/// 校验 API Key 是否有效
#[tauri::command]
pub async fn check_translator_key(engine: String, api_key: String) -> AppResult<bool> {
    if api_key.trim().is_empty() {
        return Ok(false);
    }

    let engine_type = match engine.as_str() {
        "deepl" => TranslationEngine::DeepL,
        "baidu" => TranslationEngine::Baidu,
        "youdao" => TranslationEngine::Youdao,
        "tencent" => TranslationEngine::Tencent,
        "volcengine" => TranslationEngine::Volcengine,
        _ => TranslationEngine::Google,
    };

    match crate::core::translator::check_api_key(engine_type, &api_key).await {
        Ok(_) => Ok(true),
        Err(e) => {
            tracing::error!("Key check failed: {}", e);
            Err(e)
        }
    }
}
