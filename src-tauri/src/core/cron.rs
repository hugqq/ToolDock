/*
 * Cron 表达式核心逻辑层
 * 负责 Cron 表达式的解析和下次运行时间的计算
 */

use cron::Schedule;
use std::str::FromStr;
use chrono::{DateTime, Local};
use crate::errors::AppError;
use serde_json::json;

/// 获取 Cron 表达式的下几次运行时间
/// 
/// # 参数
/// * `expression` - Cron 表达式字符串
/// * `count` - 需要获取的运行时间数量
/// 
/// # 返回
/// * `Result<Vec<String>, String>` - 成功返回时间字符串列表，失败返回错误信息
pub fn get_next_runs(expression: &str, count: usize) -> Result<Vec<String>, String> {
    // cron 库要求 6 或 7 个字段
    // 如果用户输入的是 5 个字段（标准 crontab），我们自动在前面补上 "0 " (秒)
    let mut final_expr = expression.to_string();
    let fields_count = expression.split_whitespace().count();
    
    if fields_count == 5 {
        final_expr = format!("0 {}", expression);
    }

    let schedule = Schedule::from_str(&final_expr).map_err(|e| e.to_string())?;
    let now = Local::now();
    
    let next_runs: Vec<String> = schedule
        .after(&now)
        .take(count)
        .map(|datetime: DateTime<Local>| datetime.format("%Y-%m-%d %H:%M:%S").to_string())
        .collect();
        
    Ok(next_runs)
}

/// 使用 AI 生成 Cron 表达式
pub async fn generate_with_ai(
    provider: &str,
    api_key: &str,
    model: &str,
    base_url: &str,
    input: &str,
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
        "https://ark.cn-beijing.volces.com/api/v3/chat/completions".to_string()
    };

    let system_prompt = r#"你是一个专业的系统管理员，擅长编写 Cron 表达式。
请根据用户描述的需求，生成一个标准的 Cron 表达式。
注意：表达式必须包含 6 或 7 个字段，顺序严格为：秒 分 时 日 月 周 [年]。

字段限制：
- 秒 (0-59)
- 分 (0-59)
- 时 (0-23)
- 日 (1-31)
- 月 (1-12)
- 周 (0-6 或 SUN-SAT，? 表示不指定)
- 年 (可选)

重要规则：
1. 如果用户要求“每分钟”，秒字段应该是 0 而不是 *。
2. “日”和“周”字段不能同时为 *。如果指定了其中一个，另一个通常使用 ?。
3. “日”字段从 1 开始，不能包含 0。
4. 时间范围使用 -，例如 14:00 到 14:05 应该是分钟字段为 0-5，小时字段为 14。

示例：
用户：每天下午 2 点到 2:05 期间的每分钟
输出：{"expression": "0 0-5 14 * * ?"}
用户：每天凌晨 2 点
输出：{"expression": "0 0 2 * * ?"}
用户：每分钟一次
输出：{"expression": "0 * * * * ?"}
用户：7点到9点每分钟一次
输出：{"expression": "0 * 7-9 * * ?"}
用户：每周一到周五早上 8 点半
输出：{"expression": "0 30 8 ? * MON-FRI"}

输出必须是 JSON 格式，包含一个 "expression" 字段。只返回 JSON，不要包含任何解释。
"#;

    let mut body_json = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": input }
        ]
    });

    if provider == "deepseek" {
        body_json["response_format"] = json!({ "type": "json_object" });
    }

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body_json)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Request failed: {}", e)))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Internal("Empty response from AI".to_string()))?;

    let clean_content = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let val: serde_json::Value = serde_json::from_str(clean_content)
        .map_err(|e| AppError::Internal(format!("Failed to parse AI JSON: {}", e)))?;
    
    let expr = val["expression"]
        .as_str()
        .ok_or_else(|| AppError::Internal("Missing expression in AI response".to_string()))?;

    Ok(expr.to_string())
}
