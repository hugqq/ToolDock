use crate::errors::AppResult;
use crate::core::wechat_assistant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeChatWindowInfo {
    pub hwnd: isize,
    pub title: String,
}

/// 等待用户点击窗口并获取句柄
#[tauri::command]
pub async fn wait_for_wechat_window(timeout_secs: u64) -> AppResult<WeChatWindowInfo> {
    let window = wechat_assistant::wait_for_window_click(timeout_secs)?;
    Ok(WeChatWindowInfo {
        hwnd: window.hwnd,
        title: window.title,
    })
}

/// 从微信窗口捕获最新消息
#[tauri::command]
pub async fn capture_wechat_message(hwnd: isize) -> AppResult<String> {
    let message = wechat_assistant::capture_wechat_message(hwnd)?;
    Ok(message)
}

/// 将AI回复填充到微信输入框（通过窗口句柄）
#[tauri::command]
pub async fn fill_wechat_reply(hwnd: isize, reply: String) -> AppResult<()> {
    wechat_assistant::fill_text_to_wechat(hwnd, &reply)?;
    Ok(())
}

/// 查找微信窗口
#[tauri::command]
pub async fn find_wechat_window() -> AppResult<WeChatWindowInfo> {
    let window = wechat_assistant::find_wechat_window()?;
    Ok(WeChatWindowInfo {
        hwnd: window.hwnd,
        title: window.title,
    })
}

/// 静默读取剪贴板内容（不激活窗口）
#[tauri::command]
pub async fn read_clipboard_silent() -> AppResult<String> {
    let text = wechat_assistant::read_clipboard_silent()?;
    Ok(text)
}
