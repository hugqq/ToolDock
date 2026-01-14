/// 剪贴板核心逻辑实现
/// 负责监听剪贴板变化、持久化历史记录以及图片存储

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Emitter};
use uuid::Uuid;
use crate::errors::AppError;
use tauri_plugin_clipboard_manager::ClipboardExt;
use image::{ImageBuffer, Rgba};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ClipboardType {
    Text,
    Image,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: ClipboardType,
    pub content: String, // 文本内容或图片文件路径
    pub timestamp: i64,
    pub preview: Option<String>, // 文本预览或缩略图路径
}

pub struct ClipboardManager {
    history: Arc<Mutex<Vec<ClipboardItem>>>,
    storage_path: PathBuf,
    image_dir: PathBuf,
    enabled: AtomicBool,
    prefix: Mutex<String>,
    suffix: Mutex<String>,
}

impl ClipboardManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        let data_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("data"));
        let storage_path = data_dir.join("clipboard_history.json");
        let image_dir = data_dir.join("clipboard_images");

        if !image_dir.exists() {
            fs::create_dir_all(&image_dir).ok();
        }

        let history: Vec<ClipboardItem> = if storage_path.exists() {
            let content = fs::read_to_string(&storage_path).unwrap_or_default();
            let items: Vec<ClipboardItem> = serde_json::from_str(&content).unwrap_or_else(|_| Vec::new());
            items
        } else {
            Vec::new()
        };

        Self {
            history: Arc::new(Mutex::new(history)),
            storage_path,
            image_dir,
            enabled: AtomicBool::new(false), // 默认不启用
            prefix: Mutex::new(String::new()),
            suffix: Mutex::new(String::new()),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
    }

    pub fn set_config(&self, prefix: String, suffix: String) {
        let mut p = self.prefix.lock().unwrap();
        *p = prefix;
        let mut s = self.suffix.lock().unwrap();
        *s = suffix;
    }

    pub fn get_config(&self) -> (String, String) {
        let p = self.prefix.lock().unwrap();
        let s = self.suffix.lock().unwrap();
        (p.clone(), s.clone())
    }

    pub fn get_history(&self) -> Vec<ClipboardItem> {
        let history = self.history.lock().unwrap();
        history.clone()
    }

    pub fn add_text(&self, text: String) -> Result<(), AppError> {
        let mut history = self.history.lock().unwrap();
        
        // 检查是否与上一条相同
        if let Some(last) = history.first() {
            if last.content_type == ClipboardType::Text && last.content == text {
                return Ok(());
            }
        }

        let item = ClipboardItem {
            id: Uuid::new_v4().to_string(),
            content_type: ClipboardType::Text,
            content: text.clone(),
            timestamp: Local::now().timestamp(),
            preview: Some(if text.len() > 100 { format!("{}...", &text.chars().take(100).collect::<String>()) } else { text }),
        };

        history.insert(0, item);
        if history.len() > 100 {
            history.pop();
        }

        self.save(&history)
    }

    pub fn add_image(&self, rgba_data: Vec<u8>, width: u32, height: u32) -> Result<(), AppError> {
        let expected_len = (width * height * 4) as usize;
        
        if rgba_data.len() != expected_len {
            tracing::error!("Image data length mismatch: got {}, expected {}", rgba_data.len(), expected_len);
            return Err(AppError::Internal(format!("Data length mismatch: {} != {}", rgba_data.len(), expected_len)));
        }

        // 确保目录存在
        if !self.image_dir.exists() {
            fs::create_dir_all(&self.image_dir).map_err(|e| {
                tracing::error!("Failed to create image directory: {}", e);
                AppError::Io(e)
            })?;
        }

        let mut history = self.history.lock().unwrap();
        
        let id = Uuid::new_v4().to_string();
        let file_name = format!("{}.png", id);
        let file_path = self.image_dir.join(&file_name);

        // 使用 image 库编码为 PNG
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(width, height, rgba_data)
            .ok_or_else(|| {
                tracing::error!("Failed to create image buffer from raw data (len mismatch?)");
                AppError::Internal("Failed to create image buffer".to_string())
            })?;
        
        // 显式保存并检查
        img.save(&file_path).map_err(|e| {
            tracing::error!("Failed to save image to {:?}: {}", file_path, e);
            AppError::Internal(e.to_string())
        })?;

        if file_path.exists() {
        } else {
            tracing::error!("Image save returned Ok but file does not exist at {:?}", file_path);
            return Err(AppError::Internal("File verification failed after save".to_string()));
        }

        let item = ClipboardItem {
            id,
            content_type: ClipboardType::Image,
            content: file_path.to_string_lossy().to_string(),
            timestamp: Local::now().timestamp(),
            preview: Some(file_path.to_string_lossy().to_string()),
        };

        history.insert(0, item);
        if history.len() > 100 {
            if let Some(removed) = history.pop() {
                if removed.content_type == ClipboardType::Image {
                    let path = PathBuf::from(&removed.content);
                    if path.exists() {
                        fs::remove_file(path).ok();
                    }
                }
            }
        }

        self.save(&history)
    }

    pub fn delete_item(&self, id: &str) -> Result<(), AppError> {
        let mut history = self.history.lock().unwrap();
        if let Some(index) = history.iter().position(|item| item.id == id) {
            let item = history.remove(index);
            if item.content_type == ClipboardType::Image {
                fs::remove_file(item.content).ok();
            }
            self.save(&history)?;
        }
        Ok(())
    }

    pub fn clear_history(&self) -> Result<(), AppError> {
        let mut history = self.history.lock().unwrap();
        for item in history.iter() {
            if item.content_type == ClipboardType::Image {
                fs::remove_file(&item.content).ok();
            }
        }
        history.clear();
        self.save(&history)
    }

    fn save(&self, history: &[ClipboardItem]) -> Result<(), AppError> {
        let content = serde_json::to_string(history).map_err(|e| AppError::Internal(e.to_string()))?;
        fs::write(&self.storage_path, content).map_err(|e| AppError::Io(e))?;
        Ok(())
    }
}

pub fn start_listening(app_handle: AppHandle, manager: Arc<ClipboardManager>) {
    std::thread::spawn(move || {
        let mut last_text = String::new();
        let mut last_image_hash = Vec::new();

        loop {
            if manager.is_enabled() {
                let clipboard = app_handle.clipboard();
                
                // 检查文本
                match clipboard.read_text() {
                    Ok(text) => {
                        if !text.is_empty() && text != last_text {
                            let (prefix, suffix) = manager.get_config();
                            let mut final_text = text.clone();
                            let mut modified = false;

                            if !prefix.is_empty() && !final_text.starts_with(&prefix) {
                                final_text = format!("{}{}", prefix, final_text);
                                modified = true;
                            }
                            if !suffix.is_empty() && !final_text.ends_with(&suffix) {
                                final_text = format!("{}{}", final_text, suffix);
                                modified = true;
                            }

                            if modified {
                                let _ = clipboard.write_text(final_text.clone());
                                last_text = final_text;
                            } else {
                                last_text = text.clone();
                            }

                            if let Err(e) = manager.add_text(text) {
                                tracing::error!("Failed to add text to history: {}", e);
                            } else {
                                app_handle.emit("clipboard://changed", ()).ok();
                            }
                        }
                    }
                    Err(_) => {} // 忽略文本读取错误
                }

                // 检查图片
                match clipboard.read_image() {
                    Ok(image) => {
                        let width = image.width();
                        let height = image.height();
                        let rgba = image.rgba();
                        
                        // 简单的哈希检查，避免重复保存
                        if !rgba.is_empty() {
                            let hash = rgba[..rgba.len().min(1024)].to_vec(); 
                            if hash != last_image_hash {
                                last_image_hash = hash;
                                if let Err(e) = manager.add_image(rgba.to_vec(), width, height) {
                                    tracing::error!("Failed to add image to history: {}", e);
                                } else {
                                    app_handle.emit("clipboard://changed", ()).ok();
                                }
                            }
                        }
                    }
                    Err(e) => {
                        let err_msg = e.to_string();
                        // 只有在不是 "No image in clipboard" 的错误时才记录，且避免重复记录相同错误
                        if !err_msg.contains("no image") && !err_msg.contains("empty") && !err_msg.contains("No item") {
                            // tracing::warn!("Clipboard read_image error: {}", e);
                        }
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(1000));
        }
    });
}
