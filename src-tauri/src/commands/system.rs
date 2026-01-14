use crate::core::system;
use crate::models::system::{DiskSpeedResult, SystemInfo};
use crate::models::ApiResponse;
use tauri::Manager;

#[tauri::command]
pub async fn get_system_info() -> ApiResponse<SystemInfo> {
    // 使用 spawn_blocking 避免在异步上下文中调用 blocking 代码
    match tokio::task::spawn_blocking(|| system::get_system_info()).await {
        Ok(Ok(info)) => ApiResponse::ok(info),
        Ok(Err(e)) => ApiResponse::error("GET_SYSTEM_INFO_FAILED", e.to_string()),
        Err(e) => ApiResponse::error("GET_SYSTEM_INFO_FAILED", format!("Task join error: {}", e)),
    }
}

#[tauri::command]
pub async fn toggle_floating_window(app: tauri::AppHandle) -> ApiResponse<bool> {
    if let Some(window) = app.get_webview_window("floating_widget") {
        let _ = window.close();
        ApiResponse::ok(false)
    } else {
        let window_result = tauri::WebviewWindowBuilder::new(
            &app,
            "floating_widget",
            tauri::WebviewUrl::App("/floating-widget".into()),
        )
        .title("ToolDock Widget")
        .inner_size(220.0, 120.0)
        .resizable(false)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .build();

        match window_result {
            Ok(_) => ApiResponse::ok(true),
            Err(e) => ApiResponse::error("CREATE_WINDOW_FAILED", e.to_string()),
        }
    }
}

#[tauri::command]
pub async fn test_disk_speed(mount_point: String) -> ApiResponse<DiskSpeedResult> {
    match system::test_disk_speed(&mount_point) {
        Ok(result) => ApiResponse::ok(result),
        Err(e) => ApiResponse::error("DISK_SPEED_TEST_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn find_occupying_processes(path: String) -> ApiResponse<Vec<u32>> {
    match system::find_occupying_processes(&path) {
        Ok(pids) => ApiResponse::ok(pids),
        Err(e) => ApiResponse::error("FIND_OCCUPANCY_FAILED", e.to_string()),
    }
}

#[tauri::command]
pub async fn is_admin() -> ApiResponse<bool> {
    ApiResponse::ok(system::is_admin())
}
