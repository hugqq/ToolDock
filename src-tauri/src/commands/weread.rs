use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn execute_weread_script(
    app: AppHandle,
    window_label: String,
    script: String,
) -> Result<(), String> {
    let webview = app
        .get_webview_window(&window_label)
        .ok_or("Window not found")?;

    webview
        .eval(&script)
        .map_err(|e| format!("Failed to execute script: {}", e))?;

    Ok(())
}
