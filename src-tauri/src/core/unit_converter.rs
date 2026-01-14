use chrono::DateTime;
use serde::{Deserialize, Serialize};
/// 单位换算核心逻辑
/// 职责：处理长度、重量、温度、进制和汇率的转换计算
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExchangeRates {
    #[serde(default = "default_amount")]
    pub amount: f64,
    pub base: String,
    pub date: String,
    pub rates: HashMap<String, f64>,
}

fn default_amount() -> f64 {
    1.0
}

/// 长度转换
pub fn convert_length(value: f64, from: &str, to: &str) -> f64 {
    let to_meters = match from {
        "mm" => 0.001,
        "cm" => 0.01,
        "m" => 1.0,
        "km" => 1000.0,
        "in" => 0.0254,
        "ft" => 0.3048,
        "yd" => 0.9144,
        "mi" => 1609.344,
        _ => 1.0,
    };

    let from_meters = match to {
        "mm" => 1000.0,
        "cm" => 100.0,
        "m" => 1.0,
        "km" => 0.001,
        "in" => 1.0 / 0.0254,
        "ft" => 1.0 / 0.3048,
        "yd" => 1.0 / 0.9144,
        "mi" => 1.0 / 1609.344,
        _ => 1.0,
    };

    value * to_meters * from_meters
}

/// 重量转换
pub fn convert_weight(value: f64, from: &str, to: &str) -> f64 {
    let to_grams = match from {
        "mg" => 0.001,
        "g" => 1.0,
        "kg" => 1000.0,
        "t" => 1000000.0,
        "oz" => 28.349523125,
        "lb" => 453.59237,
        _ => 1.0,
    };

    let from_grams = match to {
        "mg" => 1000.0,
        "g" => 1.0,
        "kg" => 0.001,
        "t" => 0.000001,
        "oz" => 1.0 / 28.349523125,
        "lb" => 1.0 / 453.59237,
        _ => 1.0,
    };

    value * to_grams * from_grams
}

/// 温度转换
pub fn convert_temperature(value: f64, from: &str, to: &str) -> f64 {
    let celsius = match from {
        "c" => value,
        "f" => (value - 32.0) * 5.0 / 9.0,
        "k" => value - 273.15,
        _ => value,
    };

    match to {
        "c" => celsius,
        "f" => celsius * 9.0 / 5.0 + 32.0,
        "k" => celsius + 273.15,
        _ => celsius,
    }
}

/// 进制转换
pub fn convert_base(value: &str, from_base: u32, to_base: u32) -> Result<String, String> {
    let decimal = u128::from_str_radix(value, from_base).map_err(|e| e.to_string())?;

    match to_base {
        2 => Ok(format!("{:b}", decimal)),
        8 => Ok(format!("{:o}", decimal)),
        10 => Ok(format!("{}", decimal)),
        16 => Ok(format!("{:x}", decimal)),
        _ => Err("Unsupported base".to_string()),
    }
}

/// 存储转换 (使用 1024 进制)
pub fn convert_storage(value: f64, from: &str, to: &str) -> f64 {
    let to_bytes = match from {
        "B" => 1.0,
        "KB" => 1024.0,
        "MB" => 1024.0 * 1024.0,
        "GB" => 1024.0 * 1024.0 * 1024.0,
        "TB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => 1.0,
    };

    let from_bytes = match to {
        "B" => 1.0,
        "KB" => 1.0 / 1024.0,
        "MB" => 1.0 / (1024.0 * 1024.0),
        "GB" => 1.0 / (1024.0 * 1024.0 * 1024.0),
        "TB" => 1.0 / (1024.0 * 1024.0 * 1024.0 * 1024.0),
        _ => 1.0,
    };

    value * to_bytes * from_bytes
}

/// 网速转换 (使用 1000 进制，1Mbps = 125KB/s)
pub fn convert_network_speed(value: f64, from: &str, to: &str) -> f64 {
    let to_bps = match from {
        "bps" => 1.0,
        "Kbps" => 1000.0,
        "Mbps" => 1000.0 * 1000.0,
        "Gbps" => 1000.0 * 1000.0 * 1000.0,
        "KB/s" => 1000.0 * 8.0,
        "MB/s" => 1000.0 * 1000.0 * 8.0,
        "GB/s" => 1000.0 * 1000.0 * 1000.0 * 8.0,
        _ => 1.0,
    };

    let from_bps = match to {
        "bps" => 1.0,
        "Kbps" => 1.0 / 1000.0,
        "Mbps" => 1.0 / (1000.0 * 1000.0),
        "Gbps" => 1.0 / (1000.0 * 1000.0 * 1000.0),
        "KB/s" => 1.0 / (1000.0 * 8.0),
        "MB/s" => 1.0 / (1000.0 * 1000.0 * 8.0),
        "GB/s" => 1.0 / (1000.0 * 1000.0 * 1000.0 * 8.0),
        _ => 1.0,
    };

    value * to_bps * from_bps
}

/// 获取汇率
pub async fn fetch_exchange_rates(base: &str) -> Result<ExchangeRates, String> {
    let client = reqwest::Client::builder()
        .user_agent("ToolDock/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .gzip(true)
        .build()
        .map_err(|e| e.to_string())?;

    // 尝试第一个 API: ExchangeRate-API (v6) - 响应快，更新频率高
    let url1 = format!("https://open.er-api.com/v6/latest/{}", base);
    match client.get(&url1).send().await {
        Ok(resp) if resp.status().is_success() => {
            let text = resp.text().await.unwrap_or_default();
            #[derive(Deserialize)]
            struct ErApiResponse {
                result: String,
                base_code: Option<String>,
                time_last_update_utc: Option<String>,
                rates: Option<HashMap<String, f64>>,
            }

            if let Ok(data) = serde_json::from_str::<ErApiResponse>(&text) {
                if data.result == "success" {
                    let base_code = data.base_code.unwrap_or_else(|| base.to_string());
                    let raw_time = data.time_last_update_utc.unwrap_or_default();
                    // 尝试解析 RFC2822 格式: "Mon, 29 Dec 2025 00:00:01 +0000"
                    let date = DateTime::parse_from_rfc2822(&raw_time)
                        .map(|dt| dt.format("%Y-%m-%d").to_string())
                        .unwrap_or(raw_time);

                    return Ok(ExchangeRates {
                        amount: 1.0,
                        base: base_code,
                        date,
                        rates: data.rates.unwrap_or_default(),
                    });
                }
            }
            tracing::warn!("Failed to decode ExchangeRate-API response: {}", text);
        }
        Ok(resp) => tracing::warn!("ExchangeRate-API returned status: {}", resp.status()),
        Err(e) => tracing::warn!("ExchangeRate-API request failed: {}", e),
    }

    // 尝试第二个 API: Frankfurter - 备选
    let url2 = format!("https://api.frankfurter.app/latest?from={}", base);
    match client.get(&url2).send().await {
        Ok(resp) if resp.status().is_success() => {
            let text = resp.text().await.unwrap_or_default();
            if let Ok(rates) = serde_json::from_str::<ExchangeRates>(&text) {
                return Ok(rates);
            }
        }
        _ => {}
    }

    // 尝试第三个 API: ExchangeRate-API (v4) - 最后的兜底
    let url3 = format!("https://api.exchangerate-api.com/v4/latest/{}", base);
    let resp = client.get(&url3).send().await.map_err(|e| {
        tracing::error!("All exchange rate APIs failed: {}", e);
        format!("Network error: {}", e)
    })?;

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;
    let rates = serde_json::from_str::<ExchangeRates>(&text).map_err(|e| {
        tracing::error!(
            "Failed to decode fallback API response: {}. Body: {}",
            e,
            text
        );
        format!("Decode error: {}", e)
    })?;

    Ok(rates)
}
