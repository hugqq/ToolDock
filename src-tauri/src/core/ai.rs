/**
 * AI 核心逻辑
 * 职责：提供通用的 AI 接口调用能力，如连接测试
 */
use crate::errors::AppError;
use serde_json::json;

pub async fn ask_ai(
    provider: &str,
    api_key: &str,
    model: &str,
    base_url: &str,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, AppError> {
    let client = reqwest::Client::new();

    let url = if provider == "deepseek" {
        "https://api.deepseek.com/chat/completions".to_string()
    } else if provider == "openai" || provider == "siliconflow" {
        if base_url.is_empty() {
            if provider == "openai" {
                "https://api.openai.com/v1/chat/completions".to_string()
            } else {
                "https://api.siliconflow.cn/v1/chat/completions".to_string()
            }
        } else {
            format!("{}/chat/completions", base_url.trim_end_matches('/'))
        }
    } else {
        // Doubao (Volcengine)
        "https://ark.cn-beijing.volces.com/api/v3/chat/completions".to_string()
    };

    let body_json = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ]
    });

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body_json)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("AI API error ({}): {}", status, error_text)));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Internal("Empty response from AI".to_string()))?;

    Ok(content.to_string())
}

pub async fn ask_nginx_ai(
    provider: &str,
    api_key: &str,
    model: &str,
    base_url: &str,
    content: &str,
    error: &str,
) -> Result<String, AppError> {
    let system_prompt = "你是一个 Nginx 专家。用户会提供 Nginx 配置文件内容以及可能的错误信息。请分析配置并提供修复建议。请使用 Markdown 格式回复。";
    let user_prompt = format!(
        "配置文件内容：\n```nginx\n{}\n```\n\n错误信息：\n{}",
        content, error
    );
    ask_ai(provider, api_key, model, base_url, system_prompt, &user_prompt).await
}

pub async fn test_connection(
    provider: &str,
    api_key: &str,
    model: &str,
    base_url: &str,
) -> Result<String, AppError> {
    ask_ai(
        provider,
        api_key,
        model,
        base_url,
        "你是一个有用的助手。",
        "你好，你是什么模型？",
    )
    .await
}
