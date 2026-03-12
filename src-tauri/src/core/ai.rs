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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {}", e)))?;

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

    tracing::info!("[AI] provider={}, model={}, url={}", provider, model, url);

    let body_json = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ]
    });

    let response = client
        .post(&url)
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

    tracing::info!("[AI] OK, {} chars", content.len());
    Ok(content.to_string())
}

pub async fn ask_ai_stream<F>(
    provider: &str,
    api_key: &str,
    model: &str,
    base_url: &str,
    system_prompt: &str,
    user_prompt: &str,
    mut on_chunk: F,
) -> Result<String, AppError>
where
    F: FnMut(&str),
{
    use futures_util::StreamExt;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {}", e)))?;

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
        "https://ark.cn-beijing.volces.com/api/v3/chat/completions".to_string()
    };

    tracing::info!("[AI-Stream] provider={}, model={}, url={}", provider, model, url);

    let body_json = json!({
        "model": model,
        "stream": true,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ]
    });

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body_json)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("[AI-Stream] Request failed: {}", e);
            AppError::Internal(format!("Request failed: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        tracing::error!("[AI-Stream] API error ({}): {}", status, error_text);
        return Err(AppError::Internal(format!("AI API error ({}): {}", status, error_text)));
    }

    let mut full_content = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| {
            tracing::error!("[AI-Stream] Chunk read error: {}", e);
            AppError::Internal(format!("Stream read error: {}", e))
        })?;

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            let data = if line.starts_with("data: ") {
                &line[6..]
            } else if line.starts_with("data:") {
                &line[5..]
            } else {
                continue;
            };

            if data.trim() == "[DONE]" {
                break;
            }

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = parsed["choices"][0]["delta"]["content"].as_str() {
                    full_content.push_str(delta);
                    on_chunk(delta);
                }
            }
        }
    }

    tracing::info!("[AI-Stream] Done, total {} chars", full_content.len());
    Ok(full_content)
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
