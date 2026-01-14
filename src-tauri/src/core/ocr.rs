use screenshots::Screen;
use windows::{
    Graphics::Imaging::{BitmapAlphaMode, BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Storage::Streams::DataWriter,
};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};
use serde_json::Value;

type HmacSha256 = Hmac<Sha256>;

pub async fn run_ocr(
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> std::result::Result<String, String> {
    // 1. 捕获屏幕
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found".to_string())?;
    
    let image = if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, width, height) {
        screen.capture_area(x, y, w, h).map_err(|e| e.to_string())?
    } else {
        screen.capture().map_err(|e| e.to_string())?
    };
    
    let width = image.width();
    let height = image.height();
    let rgba_data = image.into_raw();
    
    // 将 RGBA 转换为 BGRA (Windows OCR 引擎更喜欢 BGRA8)
    let mut bgra_data = Vec::with_capacity(rgba_data.len());
    for chunk in rgba_data.chunks_exact(4) {
        bgra_data.push(chunk[2]); // B
        bgra_data.push(chunk[1]); // G
        bgra_data.push(chunk[0]); // R
        bgra_data.push(chunk[3]); // A
    }

    // 2. 将图像数据转换为 Windows SoftwareBitmap
    let software_bitmap = SoftwareBitmap::CreateWithAlpha(
        BitmapPixelFormat::Bgra8,
        width as i32,
        height as i32,
        BitmapAlphaMode::Ignore,
    ).map_err(|e| format!("Failed to create SoftwareBitmap: {}", e))?;

    let writer = DataWriter::new().map_err(|e| e.to_string())?;
    writer.WriteBytes(&bgra_data).map_err(|e| e.to_string())?;
    let buffer = writer.DetachBuffer().map_err(|e| e.to_string())?;
    
    software_bitmap.CopyFromBuffer(&buffer).map_err(|e| format!("Failed to copy buffer: {}", e))?;

    // 3. 执行 OCR
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("Failed to create OCR engine: {}", e))?;
    
    let operation = engine.RecognizeAsync(&software_bitmap)
        .map_err(|e| format!("OCR recognition failed: {}", e))?;
    
    // 使用 blocking get() 避免 await 问题，在 Tauri 命令线程中是安全的
    let result = operation.get().map_err(|e| format!("OCR result failed: {}", e))?;

    let text = result.Text().map_err(|e| e.to_string())?;
    
    Ok(text.to_string())
}

pub async fn run_tencent_ocr(
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
    secret_id: &str,
    secret_key: &str,
    region: &str,
    high_precision: bool,
) -> std::result::Result<String, String> {
    // 1. 捕获屏幕
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found".to_string())?;
    
    let image = if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, width, height) {
        screen.capture_area(x, y, w, h).map_err(|e| e.to_string())?
    } else {
        screen.capture().map_err(|e| e.to_string())?
    };

    // 2. 转换为 PNG Base64
    let mut buffer = std::io::Cursor::new(Vec::new());
    image.write_to(&mut buffer, screenshots::image::ImageFormat::Png).map_err(|e| e.to_string())?;
    let base64_image = general_purpose::STANDARD.encode(buffer.into_inner());

    // 3. 腾讯云 API 配置
    let action = if high_precision { "GeneralAccurateOCR" } else { "GeneralBasicOCR" };
    let version = "2018-11-19";
    let service = "ocr";
    let host = "ocr.tencentcloudapi.com";
    let endpoint = format!("https://{}", host);
    
    let payload = serde_json::json!({
        "ImageBase64": base64_image,
    }).to_string();

    // 4. 签名 V3
    let now = Utc::now();
    let timestamp = now.timestamp();
    let date = now.format("%Y-%m-%d").to_string();
    
    let hashed_payload = {
        let mut hasher = Sha256::new();
        hasher.update(payload.as_bytes());
        hex::encode(hasher.finalize())
    };

    let canonical_request = format!(
        "POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:{}\nx-tc-action:{}\n\ncontent-type;host;x-tc-action\n{}",
        host, action.to_lowercase(), hashed_payload
    );

    let hashed_canonical_request = {
        let mut hasher = Sha256::new();
        hasher.update(canonical_request.as_bytes());
        hex::encode(hasher.finalize())
    };

    let credential_scope = format!("{}/{}/tc3_request", date, service);
    let string_to_sign = format!(
        "TC3-HMAC-SHA256\n{}\n{}\n{}",
        timestamp, credential_scope, hashed_canonical_request
    );

    let signature = {
        let mut mac = HmacSha256::new_from_slice(format!("TC3{}", secret_key).as_bytes()).map_err(|e| e.to_string())?;
        mac.update(date.as_bytes());
        let k_date = mac.finalize().into_bytes();

        let mut mac = HmacSha256::new_from_slice(&k_date).map_err(|e| e.to_string())?;
        mac.update(service.as_bytes());
        let k_service = mac.finalize().into_bytes();

        let mut mac = HmacSha256::new_from_slice(&k_service).map_err(|e| e.to_string())?;
        mac.update(b"tc3_request");
        let k_signing = mac.finalize().into_bytes();

        let mut mac = HmacSha256::new_from_slice(&k_signing).map_err(|e| e.to_string())?;
        mac.update(string_to_sign.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    };

    let authorization = format!(
        "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders=content-type;host;x-tc-action, Signature={}",
        secret_id, credential_scope, signature
    );

    // 5. 发送请求
    let client = reqwest::Client::new();
    let response = client.post(endpoint)
        .header("Authorization", authorization)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Host", host)
        .header("X-TC-Action", action)
        .header("X-TC-Timestamp", timestamp.to_string())
        .header("X-TC-Version", version)
        .header("X-TC-Region", region)
        .body(payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let res_json: Value = response.json().await.map_err(|e| e.to_string())?;
    
    // 解析结果
    if let Some(resp) = res_json.get("Response") {
        if let Some(err) = resp.get("Error") {
            return Err(format!("{}: {}", err["Code"], err["Message"]));
        }
        
        if let Some(text_detections) = resp.get("TextDetections").and_then(|v| v.as_array()) {
            let mut result_text = String::new();
            for det in text_detections {
                if let Some(detected_text) = det.get("DetectedText").and_then(|v| v.as_str()) {
                    result_text.push_str(detected_text);
                    result_text.push('\n');
                }
            }
            return Ok(result_text.trim().to_string());
        }
    }

    Err("Failed to parse Tencent OCR response".to_string())
}

pub async fn run_baidu_ocr(
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
    api_key: &str,
    secret_key: &str,
    high_precision: bool,
) -> std::result::Result<String, String> {
    // 1. 捕获屏幕
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found".to_string())?;
    
    let image = if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, width, height) {
        screen.capture_area(x, y, w, h).map_err(|e| e.to_string())?
    } else {
        screen.capture().map_err(|e| e.to_string())?
    };

    // 2. 转换为 PNG Base64
    let mut buffer = std::io::Cursor::new(Vec::new());
    image.write_to(&mut buffer, screenshots::image::ImageFormat::Png).map_err(|e| e.to_string())?;
    let base64_image = general_purpose::STANDARD.encode(buffer.into_inner());

    // 3. 获取 Access Token
    let client = reqwest::Client::new();
    let token_url = format!(
        "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={}&client_secret={}",
        api_key, secret_key
    );
    
    let token_resp = client.get(token_url).send().await.map_err(|e| e.to_string())?;
    let token_json: Value = token_resp.json().await.map_err(|e| e.to_string())?;
    
    let access_token = token_json.get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            let err_msg = token_json.get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("Failed to get Baidu access token");
            err_msg.to_string()
        })?;

    // 4. 执行 OCR
    let ocr_url = if high_precision {
        "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic"
    } else {
        "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic"
    };

    let response = client.post(format!("{}?access_token={}", ocr_url, access_token))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&[("image", base64_image)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let res_json: Value = response.json().await.map_err(|e| e.to_string())?;

    if let Some(err_code) = res_json.get("error_code") {
        let msg = res_json.get("error_msg").and_then(|v| v.as_str()).unwrap_or("Unknown error");
        return Err(format!("Baidu OCR Error ({}): {}", err_code, msg));
    }

    if let Some(words_result) = res_json.get("words_result").and_then(|v| v.as_array()) {
        let mut result_text = String::new();
        for item in words_result {
            if let Some(words) = item.get("words").and_then(|v| v.as_str()) {
                result_text.push_str(words);
                result_text.push('\n');
            }
        }
        return Ok(result_text.trim().to_string());
    }

    Err("Failed to parse Baidu OCR response".to_string())
}

