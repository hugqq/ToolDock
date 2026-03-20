use crate::core::clicker::{simulate_text_input, ClickType, ClickerManager, MouseButton};
use crate::models::ApiResponse;
use tauri::State;

#[tauri::command]
pub async fn start_mouse_clicker(
    manager: State<'_, ClickerManager>,
    interval_ms: u64,
    button: MouseButton,
    click_type: ClickType,
) -> Result<ApiResponse<()>, String> {
    manager.start_mouse_clicker(interval_ms, button, click_type);
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn stop_mouse_clicker(
    manager: State<'_, ClickerManager>,
) -> Result<ApiResponse<()>, String> {
    manager.stop_mouse_clicker();
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn is_mouse_clicker_running(
    manager: State<'_, ClickerManager>,
) -> Result<ApiResponse<bool>, String> {
    Ok(ApiResponse::ok(manager.is_mouse_running()))
}

#[tauri::command]
pub async fn start_keyboard_clicker(
    manager: State<'_, ClickerManager>,
    interval_ms: u64,
    key_code: u16,
) -> Result<ApiResponse<()>, String> {
    manager.start_keyboard_clicker(interval_ms, key_code);
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn stop_keyboard_clicker(
    manager: State<'_, ClickerManager>,
) -> Result<ApiResponse<()>, String> {
    manager.stop_keyboard_clicker();
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn is_keyboard_clicker_running(
    manager: State<'_, ClickerManager>,
) -> Result<ApiResponse<bool>, String> {
    Ok(ApiResponse::ok(manager.is_keyboard_running()))
}

#[tauri::command]
pub async fn send_text_input(text: String, delay_ms: u64) -> Result<ApiResponse<()>, String> {
    // Add initial delay to allow user to switch windows
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    tokio::task::spawn_blocking(move || simulate_text_input(&text, delay_ms))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    Ok(ApiResponse::ok(()))
}

/// 设置 F8/F9 快捷键启用状态
#[tauri::command]
pub async fn set_clicker_hotkey_enabled(
    manager: State<'_, ClickerManager>,
    enabled: bool,
) -> Result<ApiResponse<()>, String> {
    manager.set_hotkey_enabled(enabled);
    Ok(ApiResponse::ok(()))
}

/// 获取 F8/F9 快捷键当前启用状态
#[tauri::command]
pub async fn get_clicker_hotkey_enabled(
    manager: State<'_, ClickerManager>,
) -> Result<ApiResponse<bool>, String> {
    Ok(ApiResponse::ok(manager.is_hotkey_enabled()))
}
