/**
 * 设置命令接口
 * 职责：暴露配置导出、导入及管理员模式设置给前端
 */
use crate::core::hotkey::HotkeyManager;
use crate::core::logging::DeveloperLogs;
use crate::core::settings;
use crate::models::ApiResponse;
use tauri::{Manager, State};

#[tauri::command]
pub async fn export_config(data: String, password: Option<String>) -> ApiResponse<String> {
    let result = if let Some(pwd) = password {
        if pwd.is_empty() {
            Ok(data)
        } else {
            settings::encrypt_config(&data, &pwd)
        }
    } else {
        Ok(data)
    };

    match result {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("EXPORT_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn import_config(
    encrypted_data: String,
    password: Option<String>,
) -> ApiResponse<String> {
    let result = if let Some(pwd) = password {
        if pwd.is_empty() {
            Ok(encrypted_data)
        } else {
            settings::decrypt_config(&encrypted_data, &pwd)
        }
    } else {
        Ok(encrypted_data)
    };

    match result {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("IMPORT_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn set_run_as_admin(enabled: bool) -> ApiResponse<()> {
    match settings::set_run_as_admin(enabled) {
        Ok(_) => ApiResponse::ok(()),
        Err(e) => ApiResponse::error("SET_ADMIN_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn test_ai_connection(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> ApiResponse<String> {
    match crate::core::ai::test_connection(
        &provider,
        &api_key,
        &model,
        base_url.as_deref().unwrap_or(""),
    )
    .await
    {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("AI_TEST_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn is_run_as_admin() -> ApiResponse<bool> {
    match settings::is_run_as_admin() {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("CHECK_ADMIN_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn set_auto_start(enabled: bool) -> ApiResponse<()> {
    match settings::set_auto_start(enabled) {
        Ok(_) => ApiResponse::ok(()),
        Err(e) => ApiResponse::error("SET_AUTO_START_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn is_auto_start_enabled() -> ApiResponse<bool> {
    match settings::is_auto_start_enabled() {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("CHECK_AUTO_START_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn set_developer_log_level(level: String) -> ApiResponse<String> {
    match crate::core::logging::set_log_level(&level) {
        Ok(level) => ApiResponse::ok(level),
        Err(e) => ApiResponse::error("SET_LOG_LEVEL_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn get_developer_logs(app: tauri::AppHandle) -> ApiResponse<DeveloperLogs> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("data"));
    match crate::core::logging::read_developer_logs(data_dir.join("logs")) {
        Ok(logs) => ApiResponse::ok(logs),
        Err(e) => ApiResponse::error("READ_LOGS_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn set_global_shortcut(
    manager: State<'_, HotkeyManager>,
    shortcut: String,
) -> Result<ApiResponse<()>, String> {
    // 先注销旧的快捷键
    let _ = manager.unregister();

    // 保存到注册表
    if let Err(e) = settings::save_global_shortcut(&shortcut) {
        return Ok(ApiResponse::error("SET_SHORTCUT_FAILED", e.to_string()));
    }

    // 如果快捷键不为空，注册新的快捷键
    if !shortcut.is_empty() {
        if let Err(e) = manager.register(&shortcut) {
            return Ok(ApiResponse::error("REGISTER_HOTKEY_FAILED", e.to_string()));
        }
    }

    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn get_global_shortcut() -> ApiResponse<String> {
    match settings::load_global_shortcut() {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("GET_SHORTCUT_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn set_silent_start(app: tauri::AppHandle, enabled: bool) -> ApiResponse<()> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("data"));
    match settings::save_silent_start(&data_dir, enabled) {
        Ok(_) => ApiResponse::ok(()),
        Err(e) => ApiResponse::error("SET_SILENT_START_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn get_silent_start(app: tauri::AppHandle) -> ApiResponse<bool> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("data"));
    ApiResponse::ok(settings::load_silent_start(&data_dir))
}

#[tauri::command]
pub async fn check_latest_release() -> ApiResponse<crate::core::update::LatestRelease> {
    match crate::core::update::check_latest_release().await {
        Ok(val) => ApiResponse::ok(val),
        Err(e) => ApiResponse::error("CHECK_UPDATE_FAILED", e),
    }
}
