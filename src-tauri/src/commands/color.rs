use crate::core::color;

#[tauri::command]
pub async fn pick_screen_color() -> Result<String, String> {
    // 在异步线程中运行阻塞的 pick_color
    // 使用 spawn_blocking 避免阻塞 Tauri 主线程
    tauri::async_runtime::spawn_blocking(|| {
        color::pick_color()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_mouse_pixel_color() -> Result<color::PixelInfo, String> {
    tauri::async_runtime::spawn_blocking(|| {
        color::get_mouse_pixel()
    }).await.map_err(|e| e.to_string())?
}
