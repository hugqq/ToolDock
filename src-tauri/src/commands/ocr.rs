use crate::core::ocr;
use crate::models::ocr::OcrDetailResult;
use crate::models::{ApiErrorDetail, ApiResponse};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct OcrSettings {
    pub tencent_secret_id: String,
    pub tencent_secret_key: String,
    pub tencent_region: String,
    pub baidu_api_key: String,
    pub baidu_secret_key: String,
}

#[tauri::command]
pub async fn run_ocr(
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
    engine: Option<String>,
    settings: Option<OcrSettings>,
) -> ApiResponse<String> {
    let engine_str = engine.unwrap_or_else(|| "windows".to_string());

    let result = match engine_str.as_str() {
        "tencent" | "tencent_high_precision" => {
            if let Some(s) = settings {
                ocr::run_tencent_ocr(
                    x,
                    y,
                    width,
                    height,
                    &s.tencent_secret_id,
                    &s.tencent_secret_key,
                    &s.tencent_region,
                    engine_str == "tencent_high_precision",
                )
                .await
            } else {
                Err("Missing Tencent Cloud settings".to_string())
            }
        }
        "baidu" | "baidu_high_precision" => {
            if let Some(s) = settings {
                ocr::run_baidu_ocr(
                    x,
                    y,
                    width,
                    height,
                    &s.baidu_api_key,
                    &s.baidu_secret_key,
                    engine_str == "baidu_high_precision",
                )
                .await
            } else {
                Err("Missing Baidu Cloud settings".to_string())
            }
        }
        _ => ocr::run_ocr(x, y, width, height).await,
    };

    match result {
        Ok(text) => ApiResponse {
            ok: true,
            data: Some(text),
            error: None,
        },
        Err(e) => ApiResponse {
            ok: false,
            data: None,
            error: Some(ApiErrorDetail {
                code: "OCR_ERROR".to_string(),
                message: e.to_string(),
            }),
        },
    }
}

/// OCR识别并返回详细结果(文字+坐标+原图)
/// 支持所有OCR引擎
#[tauri::command]
pub async fn run_ocr_detailed(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    engine: Option<String>,
    mode: Option<String>,
    settings: Option<OcrSettings>,
) -> ApiResponse<OcrDetailResult> {
    let mut engine_str = engine.unwrap_or_else(|| "windows".to_string());
    let mode_str = mode.unwrap_or_else(|| "normal".to_string());

    // 根据mode调整engine
    if mode_str == "accurate" {
        match engine_str.as_str() {
            "tencent" => engine_str = "tencent_high_precision".to_string(),
            "baidu" => engine_str = "baidu_high_precision".to_string(),
            _ => {} // Windows OCR没有高精度模式
        }
    }

    let result = match engine_str.as_str() {
        "tencent" | "tencent_high_precision" => {
            if let Some(s) = settings {
                ocr::run_tencent_ocr_with_boxes(
                    Some(x),
                    Some(y),
                    Some(width),
                    Some(height),
                    &s.tencent_secret_id,
                    &s.tencent_secret_key,
                    &s.tencent_region,
                    engine_str == "tencent_high_precision",
                )
                .await
            } else {
                Err("Missing Tencent Cloud settings".to_string())
            }
        }
        "baidu" | "baidu_high_precision" => {
            if let Some(s) = settings {
                ocr::run_baidu_ocr_with_boxes(
                    Some(x),
                    Some(y),
                    Some(width),
                    Some(height),
                    &s.baidu_api_key,
                    &s.baidu_secret_key,
                    engine_str == "baidu_high_precision",
                )
                .await
            } else {
                Err("Missing Baidu Cloud settings".to_string())
            }
        }
        _ => ocr::run_ocr_with_boxes(Some(x), Some(y), Some(width), Some(height)).await,
    };

    match result {
        Ok(detail) => ApiResponse::ok(detail),
        Err(e) => ApiResponse::error("OCR_ERROR", e),
    }
}
