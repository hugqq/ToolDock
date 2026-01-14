/// 翻译核心逻辑（纯业务逻辑层）
/// 职责：与外部翻译服务（如 Google, DeepL）通信，返回翻译结果。
/// 注意：尽量保持此模块与 Tauri 无关，方便单元测试。

use crate::errors::AppResult;
use crate::models::TranslationResult;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use md5::{Md5, Digest};
use sha2::{Sha256};
use hmac::{Hmac, Mac};
use hex;

type HmacSha256 = Hmac<Sha256>;

/// 翻译引擎类型
pub enum TranslationEngine {
    Google,
    DeepL,
    DeepLX,
    Baidu,
    Youdao,
    Tencent,
    Volcengine,
}

/// 获取统一的 HTTP 客户端
fn get_client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| crate::errors::AppError::Internal(format!("Failed to build client: {}", e)))
}

/// 统一翻译入口
pub async fn translate_text(
    engine: TranslationEngine,
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    match engine {
        TranslationEngine::Google => translate_google(text, target, source, api_key).await,
        TranslationEngine::DeepL => translate_deepl(text, target, source, api_key).await,
        TranslationEngine::DeepLX => translate_deeplx(text, target, source, api_key).await,
        TranslationEngine::Baidu => translate_baidu(text, target, source, api_key).await,
        TranslationEngine::Youdao => translate_youdao(text, target, source, api_key).await,
        TranslationEngine::Tencent => translate_tencent(text, target, source, api_key).await,
        TranslationEngine::Volcengine => translate_volcengine(text, target, source, api_key).await,
    }
}

/// 校验 API Key 是否有效
pub async fn check_api_key(engine: TranslationEngine, api_key: &str) -> AppResult<()> {
    let client = get_client()?;
    match engine {
        TranslationEngine::Google => {
            let url = format!(
                "https://translation.googleapis.com/language/translate/v2/languages?key={}",
                api_key
            );
            let resp = client.get(&url).send().await.map_err(|e| {
                crate::errors::AppError::Internal(format!("Network error: {}", e))
            })?;
            if resp.status().is_success() {
                Ok(())
            } else {
                let err = resp.text().await.unwrap_or_default();
                Err(crate::errors::AppError::Internal(format!("Google Key Invalid: {}", err)))
            }
        }
        TranslationEngine::DeepL => {
            let url = if api_key.ends_with(":fx") {
                "https://api-free.deepl.com/v2/usage"
            } else {
                "https://api.deepl.com/v2/usage"
            };
            let resp = client
                .get(url)
                .header(AUTHORIZATION, format!("DeepL-Auth-Key {}", api_key))
                .send()
                .await
                .map_err(|e| {
                    crate::errors::AppError::Internal(format!("Network error: {}", e))
                })?;
            if resp.status().is_success() {
                Ok(())
            } else {
                let err = resp.text().await.unwrap_or_default();
                Err(crate::errors::AppError::Internal(format!("DeepL Key Invalid: {}", err)))
            }
        }
        TranslationEngine::DeepLX => {
            let url = format!("https://api.deeplx.org/{}/translate", api_key.trim());
            let body = serde_json::json!({
                "text": "Hi",
                "source_lang": "en",
                "target_lang": "zh",
            });
            let resp = client.post(url).json(&body).send().await.map_err(|e| {
                crate::errors::AppError::Internal(format!("Network error: {}", e))
            })?;
            if resp.status().is_success() {
                Ok(())
            } else {
                let err = resp.text().await.unwrap_or_default();
                Err(crate::errors::AppError::Internal(format!("DeepLX Key Invalid: {}", err)))
            }
        }
        TranslationEngine::Baidu => {
            // 百度翻译校验：尝试翻译一个简单的词
            translate_baidu("Hi", "zh", Some("en"), Some(api_key)).await?;
            Ok(())
        }
        TranslationEngine::Youdao => {
            // 有道翻译校验：尝试翻译一个简单的词
            translate_youdao("Hi", "zh-CHS", Some("en"), Some(api_key)).await?;
            Ok(())
        }
        TranslationEngine::Tencent => {
            // 腾讯翻译校验
            translate_tencent("Hi", "zh", Some("en"), Some(api_key)).await?;
            Ok(())
        }
        TranslationEngine::Volcengine => {
            // 火山引擎校验
            translate_volcengine("Hi", "zh", Some("en"), Some(api_key)).await?;
            Ok(())
        }
    }
}

async fn translate_google(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            return translate_google_with_key(key, text, target, source).await;
        }
    }
    translate_google_free(text, target, source).await
}

async fn translate_google_with_key(
    api_key: &str,
    text: &str,
    target: &str,
    source: Option<&str>,
) -> AppResult<TranslationResult> {
    let client = get_client()?;
    let url = format!(
        "https://translation.googleapis.com/language/translate/v2?key={}",
        api_key
    );
    // ... (保持后续逻辑不变，但使用 client)

    let mut body = serde_json::json!({
        "q": text,
        "target": target,
        "format": "text"
    });

    if let Some(src) = source {
        body["source"] = serde_json::Value::String(src.to_string());
    }

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("HTTP request failed: {}", e)))?;

    let status = resp.status();
    let txt = resp
        .text()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("Read response failed: {}", e)))?;

    if !status.is_success() {
        return Err(crate::errors::AppError::Internal(format!(
            "Google API error: {} - {}",
            status, txt
        )));
    }

    let v: serde_json::Value = serde_json::from_str(&txt)
        .map_err(|e| crate::errors::AppError::Internal(format!("Parse response failed: {}", e)))?;

    let translated_text = v["data"]["translations"][0]["translatedText"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let detected = v["data"]["translations"][0]["detectedSourceLanguage"]
        .as_str()
        .map(|s| s.to_string());

    Ok(TranslationResult {
        translated_text,
        detected_source_language: detected,
    })
}

async fn translate_google_free(
    text: &str,
    target: &str,
    source: Option<&str>,
) -> AppResult<TranslationResult> {
    let client = get_client()?;
    let sl = source.unwrap_or("auto");
    
    let resp = client
        .get("https://translate.googleapis.com/translate_a/single")
        .query(&[
            ("client", "gtx"),
            ("sl", sl),
            ("tl", target),
            ("dt", "t"),
            ("q", text),
        ])
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("HTTP request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(crate::errors::AppError::Internal(format!(
            "Google Free API error: {}",
            resp.status()
        )));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("Parse JSON failed: {}", e)))?;

    let mut translated_text = String::new();
    if let Some(sentences) = json.get(0).and_then(|v| v.as_array()) {
        for sentence in sentences {
            if let Some(text) = sentence.get(0).and_then(|v| v.as_str()) {
                translated_text.push_str(text);
            }
        }
    }

    let detected_source_language = json.get(2).and_then(|v| v.as_str()).map(|s| s.to_string());

    Ok(TranslationResult {
        translated_text,
        detected_source_language,
    })
}

async fn translate_deepl(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    let key = api_key.ok_or_else(|| crate::errors::AppError::Internal("DeepL API Key is required".into()))?;
    let client = get_client()?;
    
    // DeepL API 域名取决于 Key 的后缀
    let url = if key.ends_with(":fx") {
        "https://api-free.deepl.com/v2/translate"
    } else {
        "https://api.deepl.com/v2/translate"
    };

    // 语言代码映射 (DeepL 特有要求)
    let target_upper = target.to_uppercase();
    let target_lang = match target_upper.as_str() {
        "ZH-CN" => "ZH",
        "EN" => "EN-US", // 默认使用美式英语
        other => other,
    };

    let mut params = vec![
        ("auth_key", key.to_string()),
        ("text", text.to_string()),
        ("target_lang", target_lang.to_string()),
    ];

    if let Some(src) = source {
        if src != "auto" {
            let src_upper = src.to_uppercase();
            let source_lang = match src_upper.as_str() {
                "ZH-CN" => "ZH",
                other => other,
            };
            params.push(("source_lang", source_lang.to_string()));
        }
    }

    let resp = client
        .post(url)
        .form(&params)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("DeepL request failed: {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(crate::errors::AppError::Internal(format!("DeepL API error: {}", txt)));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| crate::errors::AppError::Internal(format!("DeepL parse failed: {}", e)))?;
    
    let translated_text = json["translations"][0]["text"].as_str().unwrap_or_default().to_string();
    let detected = json["translations"][0]["detected_source_language"].as_str().map(|s| s.to_lowercase());

    Ok(TranslationResult {
        translated_text,
        detected_source_language: detected,
    })
}
async fn translate_tencent(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    let key_str = api_key.ok_or_else(|| crate::errors::AppError::Internal("Tencent API Key is required".into()))?;
    
    // 确保去除前后空格
    let key_str = key_str.trim();
    
    let parts: Vec<&str> = key_str.split(':').collect();
    if parts.len() != 2 {
        return Err(crate::errors::AppError::Internal(
            "Tencent API Key format must be 'SecretId:SecretKey'. Example: AKIDxxxxx:xxxxx".into()
        ));
    }
    
    let secret_id = parts[0].trim();
    let secret_key = parts[1].trim();
    
    // 基本格式验证
    if secret_id.is_empty() || secret_key.is_empty() {
        return Err(crate::errors::AppError::Internal(
            "Tencent SecretId or SecretKey cannot be empty".into()
        ));
    }
    
    // SecretId 长度验证（通常 36-40 字符）
    if secret_id.len() < 30 {
        return Err(crate::errors::AppError::Internal(
            format!(
                "Invalid Tencent SecretId format. Your input length: {}, expected: 36-40 characters.\n\
                Please visit https://console.cloud.tencent.com/cam/capi to get the correct SecretId.\n\
                SecretId example: AKIDz8krbsJ5yKBZQpn74WFkmLPx3EXAMPLE",
                secret_id.len()
            )
        ));
    }
    
    // SecretKey 长度验证（通常 32 字符）
    if secret_key.len() < 30 {
        return Err(crate::errors::AppError::Internal(
            format!(
                "Invalid Tencent SecretKey format. Your input length: {}, expected: ~32 characters.\n\
                Please visit https://console.cloud.tencent.com/cam/capi to get the correct SecretKey.",
                secret_key.len()
            )
        ));
    }
    
    let client = get_client()?;
    let service = "tmt";
    let host = "tmt.tencentcloudapi.com";
    let region = "ap-guangzhou";  // 必须是有效的腾讯云地域
    let action = "TextTranslate";
    let version = "2018-03-21";
    let now = chrono::Utc::now();
    let timestamp = now.timestamp();
    let date = now.format("%Y-%m-%d").to_string();

    // 语言映射
    let target_lang = match target {
        "zh-CN" => "zh",
        "zh-TW" => "zh-TW",
        other => other,
    };
    let source_lang = source.unwrap_or("auto");

    let payload = serde_json::json!({
        "SourceText": text,
        "Source": source_lang,
        "Target": target_lang,
        "ProjectId": 0
    });
    let payload_str = payload.to_string();
    
    tracing::debug!("Tencent Translation Request - SecretId: {}, Timestamp: {}, Date: {}", 
        &secret_id[..10.min(secret_id.len())], timestamp, date);

    // 1. 拼接规范请求串 (Canonical Request)
    let http_request_method = "POST";
    let canonical_uri = "/";
    let canonical_query_string = "";
    let canonical_headers = format!(
        "content-type:application/json; charset=utf-8\nhost:{}\n",
        host
    );
    let signed_headers = "content-type;host";
    
    let mut hasher = Sha256::new();
    hasher.update(payload_str.as_bytes());
    let hashed_payload = hex::encode(hasher.finalize());
    
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        http_request_method,
        canonical_uri,
        canonical_query_string,
        canonical_headers,
        signed_headers,
        hashed_payload
    );
    
    tracing::debug!("Canonical Request:\n{}", canonical_request);

    // 2. 拼接待签名字符串 (String to Sign)
    let algorithm = "TC3-HMAC-SHA256";
    let credential_scope = format!("{}/{}/tc3_request", date, service);
    
    let mut hasher = Sha256::new();
    hasher.update(canonical_request.as_bytes());
    let hashed_canonical_request = hex::encode(hasher.finalize());
    
    let string_to_sign = format!(
        "{}\n{}\n{}\n{}",
        algorithm,
        timestamp,
        credential_scope,
        hashed_canonical_request
    );
    
    tracing::debug!("String to Sign:\n{}", string_to_sign);

    // 3. 计算签名 (Calculate Signature)
    let k_date = hmac_sha256(format!("TC3{}", secret_key).as_bytes(), date.as_bytes());
    let k_service = hmac_sha256(&k_date, service.as_bytes());
    let k_signing = hmac_sha256(&k_service, "tc3_request".as_bytes());
    let signature = hex::encode(hmac_sha256(&k_signing, string_to_sign.as_bytes()));

    // 4. 拼接 Authorization (Build Authorization Header)
    let authorization = format!(
        "{} Credential={}/{}, SignedHeaders={}, Signature={}",
        algorithm,
        secret_id,
        credential_scope,
        signed_headers,
        signature
    );
    
    tracing::debug!("Authorization: {}", authorization);

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&authorization).unwrap());
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json; charset=utf-8"));
    headers.insert("Host", HeaderValue::from_str(host).unwrap());
    headers.insert("X-TC-Action", HeaderValue::from_str(action).unwrap());
    headers.insert("X-TC-Timestamp", HeaderValue::from_str(&timestamp.to_string()).unwrap());
    headers.insert("X-TC-Version", HeaderValue::from_str(version).unwrap());
    headers.insert("X-TC-Region", HeaderValue::from_str(region).unwrap());

    let resp = client
        .post(format!("https://{}", host))
        .headers(headers)
        .body(payload_str)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("Tencent request failed: {}", e)))?;

    let status = resp.status();
    tracing::debug!("Tencent API Response Status: {}", status);
    
    if !status.is_success() {
        let txt = resp.text().await.unwrap_or_default();
        tracing::error!("Tencent API error response: {}", txt);
        return Err(crate::errors::AppError::Internal(format!("Tencent API error ({}): {}", status, txt)));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| crate::errors::AppError::Internal(format!("Tencent parse failed: {}", e)))?;
    
    if let Some(err) = json["Response"].get("Error") {
        let err_code = err["Code"].as_str().unwrap_or("Unknown");
        let err_msg = err["Message"].as_str().unwrap_or("Unknown error");
        return Err(crate::errors::AppError::Internal(format!("Tencent API error [{}]: {}", err_code, err_msg)));
    }

    let translated_text = json["Response"]["TargetText"].as_str().unwrap_or_default().to_string();
    let detected = json["Response"]["Source"].as_str().map(|s| s.to_string());

    Ok(TranslationResult {
        translated_text,
        detected_source_language: detected,
    })
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}
async fn translate_deeplx(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    let key = api_key.unwrap_or("").trim();
    let url = format!("https://api.deeplx.org/{}/translate", key);

    let client = get_client()?;
    
    // 语言代码映射
    let target_lower = target.to_lowercase();
    let target_lang = match target_lower.as_str() {
        "zh-cn" => "zh",
        other => other,
    };
    let source_val = source.unwrap_or("auto").to_lowercase();
    let source_lang = match source_val.as_str() {
        "zh-cn" => "zh",
        other => other,
    };

    let body = serde_json::json!({
        "text": text,
        "source_lang": source_lang,
        "target_lang": target_lang,
    });

    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("DeepLX request failed: {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(crate::errors::AppError::Internal(format!("DeepLX API error: {}", txt)));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| crate::errors::AppError::Internal(format!("DeepLX parse failed: {}", e)))?;
    
    if json["code"].as_i64().unwrap_or(0) != 200 {
        return Err(crate::errors::AppError::Internal(format!("DeepLX error: {}", json["message"])));
    }

    let translated_text = json["data"].as_str().unwrap_or_default().to_string();

    Ok(TranslationResult {
        translated_text,
        detected_source_language: None, // DeepLX standard response usually doesn't return detected lang in simple data field
    })
}

async fn translate_baidu(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    let key_full = api_key.ok_or_else(|| crate::errors::AppError::Internal("Baidu AppID:Secret is required".into()))?;
    let parts: Vec<&str> = key_full.split(':').collect();
    if parts.len() < 2 {
        return Err(crate::errors::AppError::Internal("Baidu API Key format must be AppID:Secret".into()));
    }
    let appid = parts[0];
    let secret = parts[1];

    let client = get_client()?;
    let salt = uuid::Uuid::new_v4().to_string();
    
    // 签名计算: appid+q+salt+secret
    let sign_str = format!("{}{}{}{}", appid, text, salt, secret);
    let mut hasher = Md5::new();
    hasher.update(sign_str.as_bytes());
    let sign = hex::encode(hasher.finalize());

    // 语言映射
    let target_lower = target.to_lowercase();
    let to_lang = match target_lower.as_str() {
        "zh-cn" => "zh",
        "ja" => "jp",
        "ko" => "kor",
        "fr" => "fra",
        "es" => "spa",
        other => other,
    };
    let source_lower = source.unwrap_or("auto").to_lowercase();
    let from_lang = match source_lower.as_str() {
        "zh-cn" => "zh",
        "ja" => "jp",
        "ko" => "kor",
        "fr" => "fra",
        "es" => "spa",
        other => other,
    };

    let params = [
        ("q", text),
        ("from", from_lang),
        ("to", to_lang),
        ("appid", appid),
        ("salt", &salt),
        ("sign", &sign),
    ];

    let resp = client.post("https://fanyi-api.baidu.com/api/trans/vip/translate")
        .form(&params)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("Baidu request failed: {}", e)))?;

    let json: serde_json::Value = resp.json().await.map_err(|e| crate::errors::AppError::Internal(format!("Baidu parse failed: {}", e)))?;
    
    if let Some(err_code) = json["error_code"].as_str() {
        if err_code != "52000" && !err_code.is_empty() {
            return Err(crate::errors::AppError::Internal(format!("Baidu API error: {} - {}", err_code, json["error_msg"])));
        }
    }

    let mut translated_text = String::new();
    if let Some(results) = json["trans_result"].as_array() {
        for res in results {
            if let Some(dst) = res["dst"].as_str() {
                translated_text.push_str(dst);
            }
        }
    }

    Ok(TranslationResult {
        translated_text,
        detected_source_language: None,
    })
}

async fn translate_youdao(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    let key_full = api_key.ok_or_else(|| crate::errors::AppError::Internal("Youdao AppKey:Secret is required".into()))?;
    let parts: Vec<&str> = key_full.split(':').collect();
    if parts.len() < 2 {
        return Err(crate::errors::AppError::Internal("Youdao API Key format must be AppKey:Secret".into()));
    }
    let app_key = parts[0];
    let app_secret = parts[1];

    let client = get_client()?;
    let salt = uuid::Uuid::new_v4().to_string();
    let curtime = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    // 签名计算: appKey + input + salt + curtime + appSecret
    // input 处理: 如果 q 长度大于 20，则取前 10 个字符 + 长度 + 后 10 个字符
    let input = if text.len() <= 20 {
        text.to_string()
    } else {
        format!("{}{}{}", &text[..10], text.len(), &text[text.len()-10..])
    };

    let sign_str = format!("{}{}{}{}{}", app_key, input, salt, curtime, app_secret);
    let mut hasher = Sha256::new();
    hasher.update(sign_str.as_bytes());
    let sign = hex::encode(hasher.finalize());

    // 语言映射
    let target_lower = target.to_lowercase();
    let to_lang = match target_lower.as_str() {
        "zh-cn" => "zh-CHS",
        other => other,
    };
    let source_lower = source.unwrap_or("auto").to_lowercase();
    let from_lang = match source_lower.as_str() {
        "zh-cn" => "zh-CHS",
        other => other,
    };

    let params = [
        ("q", text),
        ("from", from_lang),
        ("to", to_lang),
        ("appKey", app_key),
        ("salt", &salt),
        ("sign", &sign),
        ("signType", "v3"),
        ("curtime", &curtime),
    ];

    let resp = client.post("https://openapi.youdao.com/api")
        .form(&params)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("Youdao request failed: {}", e)))?;

    let json: serde_json::Value = resp.json().await.map_err(|e| crate::errors::AppError::Internal(format!("Youdao parse failed: {}", e)))?;
    
    if let Some(err_code) = json["errorCode"].as_str() {
        if err_code != "0" {
            return Err(crate::errors::AppError::Internal(format!("Youdao API error: {}", err_code)));
        }
    }

    let mut translated_text = String::new();
    if let Some(results) = json["translation"].as_array() {
        for res in results {
            if let Some(dst) = res.as_str() {
                translated_text.push_str(dst);
            }
        }
    }

    Ok(TranslationResult {
        translated_text,
        detected_source_language: None,
    })
}

async fn volcengine_call(
    ak: &str,
    sk: &str,
    action: &str,
    version: &str,
    body: serde_json::Value,
) -> AppResult<serde_json::Value> {
    let client = get_client()?;
    let service = "translate";
    let host = "open.volcengineapi.com";
    let region = "cn-beijing";
    
    let now = chrono::Utc::now();
    let x_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date = now.format("%Y%m%d").to_string();

    let body_str = body.to_string();

    // 1. Canonical Request
    let hashed_payload = {
        let mut hasher = Sha256::new();
        hasher.update(body_str.as_bytes());
        hex::encode(hasher.finalize())
    };

    let canonical_headers = format!(
        "content-type:application/json; charset=utf-8\nhost:{}\nx-content-sha256:{}\nx-date:{}\n",
        host, hashed_payload, x_date
    );
    let signed_headers = "content-type;host;x-content-sha256;x-date";
    let canonical_request = format!(
        "POST\n/\nAction={}&Version={}\n{}\n{}\n{}",
        action, version, canonical_headers, signed_headers, hashed_payload
    );

    // 2. String to Sign
    let credential_scope = format!("{}/{}/{}/request", date, region, service);
    let hashed_canonical_request = {
        let mut hasher = Sha256::new();
        hasher.update(canonical_request.as_bytes());
        hex::encode(hasher.finalize())
    };
    let string_to_sign = format!(
        "HMAC-SHA256\n{}\n{}\n{}",
        x_date, credential_scope, hashed_canonical_request
    );

    // 3. Signing Key
    let k_date = hmac_sha256(sk.as_bytes(), date.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    let k_signing = hmac_sha256(&k_service, b"request");

    // 4. Signature
    let signature = hex::encode(hmac_sha256(&k_signing, string_to_sign.as_bytes()));

    let authorization = format!(
        "HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        ak, credential_scope, signed_headers, signature
    );

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&authorization).unwrap());
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json; charset=utf-8"));
    headers.insert("X-Date", HeaderValue::from_str(&x_date).unwrap());
    headers.insert("X-Content-Sha256", HeaderValue::from_str(&hashed_payload).unwrap());

    let url = format!("https://{}?Action={}&Version={}", host, action, version);
    let resp = client
        .post(url)
        .headers(headers)
        .body(body_str)
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(format!("Volcengine request failed: {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(crate::errors::AppError::Internal(format!("Volcengine API error: {}", txt)));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| crate::errors::AppError::Internal(format!("Volcengine parse failed: {}", e)))?;
    
    if let Some(err) = json.get("ResponseMetadata").and_then(|m| m.get("Error")) {
        let code = err["Code"].as_str().unwrap_or("Unknown");
        let msg = err["Message"].as_str().unwrap_or("Unknown error");
        return Err(crate::errors::AppError::Internal(format!("Volcengine API error [{}]: {}", code, msg)));
    }
    
    Ok(json)
}

async fn translate_volcengine(
    text: &str,
    target: &str,
    source: Option<&str>,
    api_key: Option<&str>,
) -> AppResult<TranslationResult> {
    let key_str = api_key.ok_or_else(|| crate::errors::AppError::Internal("Volcengine API Key is required".into()))?;
    let parts: Vec<&str> = key_str.split(':').collect();
    if parts.len() != 2 {
        return Err(crate::errors::AppError::Internal(
            "Volcengine API Key format must be 'AccessKey:SecretKey'.".into()
        ));
    }
    let ak = parts[0].trim();
    let sk = parts[1].trim();

    let mut source_lang = source.unwrap_or("auto").to_string();
    let mut detected_lang = None;

    // 如果是 auto，先调用语种检测接口
    if source_lang == "auto" {
        let detect_body = serde_json::json!({
            "TextList": [text]
        });
        let detect_res = volcengine_call(ak, sk, "LangDetect", "2020-06-01", detect_body).await?;
        if let Some(lang) = detect_res["DetectedLanguageList"][0]["Language"].as_str() {
            source_lang = lang.to_string();
            detected_lang = Some(lang.to_string());
        } else {
            return Err(crate::errors::AppError::Internal("Volcengine language detection failed".into()));
        }
    }

    // 语言映射
    let target_lang = match target {
        "zh-CN" => "zh",
        other => other,
    };

    let translate_body = serde_json::json!({
        "TargetLanguage": target_lang,
        "SourceLanguage": source_lang,
        "TextList": [text],
    });

    let translate_res = volcengine_call(ak, sk, "TranslateText", "2020-06-01", translate_body).await?;

    let translated_text = translate_res["TranslationList"][0]["Translation"].as_str().unwrap_or_default().to_string();
    let detected = translate_res["TranslationList"][0]["DetectedSourceLanguage"].as_str().map(|s| s.to_string()).or(detected_lang);

    Ok(TranslationResult {
        translated_text,
        detected_source_language: detected,
    })
}
