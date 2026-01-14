/**
 * 全局快捷键命令接口
 * 职责：暴露全局快捷键注册/注销接口给前端
 */
use crate::core::hotkey::HotkeyManager;
use crate::models::ApiResponse;
use tauri::State;

#[tauri::command]
pub async fn register_global_hotkey(
    manager: State<'_, HotkeyManager>,
    shortcut: String,
) -> Result<ApiResponse<()>, String> {
    match manager.register(&shortcut) {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Ok(ApiResponse::error("REGISTER_HOTKEY_FAILED", e.to_string())),
    }
}

#[tauri::command]
pub async fn unregister_global_hotkey(
    manager: State<'_, HotkeyManager>,
) -> Result<ApiResponse<()>, String> {
    match manager.unregister() {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Ok(ApiResponse::error(
            "UNREGISTER_HOTKEY_FAILED",
            e.to_string(),
        )),
    }
}
