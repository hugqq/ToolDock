/**
 * 变量命名核心逻辑
 * 职责：调用 AI 接口生成变量名
 */
use crate::errors::AppError;
use crate::models::variable_naming::NamingResult;
use serde_json::json;

pub async fn generate_names(
    provider: &str,
    api_key: &str,
    model: &str,
    base_url: &str,
    input: &str,
    language: &str,
) -> Result<Vec<NamingResult>, AppError> {
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

    let lang_desc = if language.trim().is_empty() {
        "通用".to_string()
    } else {
        format!("{} 编程语言", language)
    };

    let system_prompt = format!(
        r#"你是一个专业的程序员，擅长给变量、函数、类起名字。
请根据用户输入的中文名或需求描述，生成符合 {} 规范的英文命名。
输出必须是 JSON 格式，包含一个 "results" 数组，数组内分为三个分类：常见命名 (common)、变量命名 (variable)、方法命名 (method)。
每个分类下包含多个项目，每个项目有 label (中文描述) 和 value (生成的英文名)。

必须包含以下具体项：
1. 常见命名：常量 (如 TEST)、大驼峰 (如 Test)、小驼峰 (如 test)、下划线 (如 test)、前下划线 (如 _test)、项目名 (如 test)
2. 变量命名：全局变量(如 gTest/g_test)、字符串变量(如 sTest/s_test)、数字变量(如 nTest/n_test)、逻辑变量(如 bTest/b_test)、数组变量(如 aTest/a_test)、正则命名(如 rTest/r_test)、函数命名(如 fTest/f_test)、成员变量(如 mTest/m_test)、临时变量(如 tmpTest/tmp_test)、状态变量(如 stateTest/state_test)
3. 方法命名：加载(如 loadTest)、判断执行(如 canTest)、判断包含(如 hasTest)、判断存在(如 isTest)、事件(如 fnTest)、接口(如 iTest)、接口实现(如 ImplTest)、get、set、查询(如 queryTest)、查看(如 viewTest)、详情(如 testDetails)、读取(如 readTest)、创建(如 createTest)、保存(如 saveTest)、新增(如 addTest)、生成(如 emitTest)、更新(如 updateTest)、编辑(如 editTest)、清除(如 clearTest)、删除(如 delete/removeTest)、移除(如 destroyTest)、上传(如 uploadTest)、下载(如 downTest)、缓存(如 cacheTest)、初始化(如 initTest)、重置(如 resetTest)

JSON 结构示例：
{{
  "results": [
    {{
      "category": "common",
      "items": [
        {{ "label": "常量", "value": "USER_INFO" }}
      ]
    }}
  ]
}}
"#,
        lang_desc
    );

    let mut body_json = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": input }
        ]
    });

    // DeepSeek 支持 json_object
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

    // 清理 Markdown 代码块
    let clean_content = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let val: serde_json::Value = serde_json::from_str(clean_content)
        .map_err(|e| AppError::Internal(format!("Failed to parse AI JSON: {}. Content: {}", e, clean_content)))?;
    
    // 兼容直接返回数组或返回带 results 键的对象
    let results_val = if val.is_array() {
        val
    } else if let Some(results) = val.get("results") {
        results.clone()
    } else {
        return Err(AppError::Internal(format!("AI returned invalid JSON structure: {}", clean_content)));
    };

    let results: Vec<NamingResult> = serde_json::from_value(results_val)
        .map_err(|e| AppError::Internal(format!("Failed to convert to NamingResult: {}", e)))?;

    Ok(results)
}
