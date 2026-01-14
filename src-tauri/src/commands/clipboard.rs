/// 剪贴板命令接口层

use tauri::{State};
use crate::core::clipboard::{ClipboardItem, ClipboardManager};
use crate::models::ApiResponse;
use crate::errors::AppError;
use std::sync::Arc;

#[tauri::command]
pub async fn get_clipboard_history(
    clipboard_manager: State<'_, Arc<ClipboardManager>>
) -> Result<ApiResponse<Vec<ClipboardItem>>, AppError> {
    Ok(ApiResponse::ok(clipboard_manager.get_history()))
}

#[tauri::command]
pub async fn set_clipboard_enabled(
    enabled: bool,
    clipboard_manager: State<'_, Arc<ClipboardManager>>
) -> Result<ApiResponse<()>, AppError> {
    clipboard_manager.set_enabled(enabled);
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn set_clipboard_config(
    prefix: String,
    suffix: String,
    clipboard_manager: State<'_, Arc<ClipboardManager>>
) -> Result<ApiResponse<()>, AppError> {
    clipboard_manager.set_config(prefix, suffix);
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn is_clipboard_enabled(
    clipboard_manager: State<'_, Arc<ClipboardManager>>
) -> Result<ApiResponse<bool>, AppError> {
    Ok(ApiResponse::ok(clipboard_manager.is_enabled()))
}

#[tauri::command]
pub async fn delete_clipboard_item(
    id: String,
    clipboard_manager: State<'_, Arc<ClipboardManager>>
) -> Result<ApiResponse<()>, AppError> {
    match clipboard_manager.delete_item(&id) {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Ok(ApiResponse::error("DELETE_CLIPBOARD_ITEM_FAILED", e.to_string())),
    }
}

#[tauri::command]
pub async fn clear_clipboard_history(
    clipboard_manager: State<'_, Arc<ClipboardManager>>
) -> Result<ApiResponse<()>, AppError> {
    match clipboard_manager.clear_history() {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Ok(ApiResponse::error("CLEAR_CLIPBOARD_HISTORY_FAILED", e.to_string())),
    }
}

#[tauri::command]
pub async fn copy_clipboard_item(
    app_handle: tauri::AppHandle,
    clipboard_manager: State<'_, Arc<ClipboardManager>>,
    id: String,
    prefix: Option<String>,
    suffix: Option<String>
) -> Result<ApiResponse<()>, AppError> {
    let history = clipboard_manager.get_history();
    if let Some(item) = history.iter().find(|i| i.id == id) {
        if item.content_type == crate::core::clipboard::ClipboardType::Text {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            let mut content = item.content.clone();
            if let Some(p) = prefix {
                content = format!("{}{}", p, content);
            }
            if let Some(s) = suffix {
                content = format!("{}{}", content, s);
            }
            if let Err(e) = app_handle.clipboard().write_text(content) {
                return Ok(ApiResponse::error("COPY_TEXT_FAILED", e.to_string()));
            }
        } else {
            // 复制图片
            let path = std::path::PathBuf::from(&item.content);
            if path.exists() {
                match image::open(&path) {
                    Ok(img) => {
                        let rgba = img.to_rgba8();
                        let tauri_img = tauri::image::Image::new(rgba.as_raw(), img.width(), img.height());
                        use tauri_plugin_clipboard_manager::ClipboardExt;
                        if let Err(e) = app_handle.clipboard().write_image(&tauri_img) {
                            return Ok(ApiResponse::error("COPY_IMAGE_FAILED", e.to_string()));
                        }
                    }
                    Err(e) => return Ok(ApiResponse::error("OPEN_IMAGE_FAILED", e.to_string())),
                }
            } else {
                return Ok(ApiResponse::error("IMAGE_NOT_FOUND", "Image file not found"));
            }
        }
    }
    Ok(ApiResponse::ok(()))
}
