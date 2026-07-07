use crate::models::ApiResponse;
use crate::core::network;
use crate::AppState;
use tauri::{State, Emitter, AppHandle, Manager};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct NetworkTaskPayload {
    pub id: String,
    pub line: String,
    pub status: String, // "running", "finished", "error", "stopped"
    pub percentage: Option<f64>,
    pub speed_mbps: Option<f64>,
    pub downloaded_bytes: Option<u64>,
    pub upload_speed_mbps: Option<f64>,
    pub uploaded_bytes: Option<u64>,
}

#[tauri::command]
pub async fn start_network_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    task_type: String, // "ping" or "tracert"
    target: String,
) -> Result<ApiResponse<()>, String> {
    let cancel_token = Arc::new(AtomicBool::new(false));
    
    {
        let mut tasks = state.network_tasks.lock().map_err(|e| e.to_string())?;
        tasks.insert(task_id.clone(), cancel_token.clone());
    }

    let task_id_clone = task_id.clone();
    let app_clone = app.clone();
    
    if task_type == "speedtest" {
        let cancel_token_clone = cancel_token.clone();
        
        tauri::async_runtime::spawn(async move {
            let mut last_down_speed = 0.0;
            let mut last_downloaded = 0;
            let mut last_up_speed = 0.0;
            let mut last_uploaded = 0;
            
            // 1. 下载测试
            let on_down_progress = |percentage: f64, speed_mbps: f64, downloaded_bytes: u64| {
                last_down_speed = speed_mbps;
                last_downloaded = downloaded_bytes;
                let _ = app_clone.emit("network-task-progress", NetworkTaskPayload {
                    id: task_id_clone.clone(),
                    line: "".into(),
                    status: "running".into(),
                    percentage: Some(percentage * 0.5), // 下载占 50%
                    speed_mbps: Some(speed_mbps),
                    downloaded_bytes: Some(downloaded_bytes),
                    upload_speed_mbps: None,
                    uploaded_bytes: None,
                });
            };

            let down_result = network::run_professional_speed_test(cancel_token_clone.clone(), on_down_progress).await;
            
            if cancel_token_clone.load(Ordering::SeqCst) {
                let _ = app_clone.emit("network-task-progress", NetworkTaskPayload {
                    id: task_id_clone.clone(),
                    line: "".into(),
                    status: "stopped".into(),
                    percentage: None,
                    speed_mbps: None,
                    downloaded_bytes: None,
                    upload_speed_mbps: None,
                    uploaded_bytes: None,
                });
                return;
            }

            // 2. 上传测试
            let on_up_progress = |percentage: f64, speed_mbps: f64, uploaded_bytes: u64| {
                last_up_speed = speed_mbps;
                last_uploaded = uploaded_bytes;
                let _ = app_clone.emit("network-task-progress", NetworkTaskPayload {
                    id: task_id_clone.clone(),
                    line: "".into(),
                    status: "running".into(),
                    percentage: Some(50.0 + percentage * 0.5), // 上传占后 50%
                    speed_mbps: Some(last_down_speed),
                    downloaded_bytes: Some(last_downloaded),
                    upload_speed_mbps: Some(speed_mbps),
                    uploaded_bytes: Some(uploaded_bytes),
                });
            };

            let up_result = network::run_upload_speed_test(cancel_token_clone.clone(), on_up_progress).await;

            let status = if cancel_token_clone.load(Ordering::SeqCst) {
                "stopped"
            } else {
                match (down_result, up_result) {
                    (Ok(_), Ok(_)) => "finished",
                    _ => "error",
                }
            };

            let _ = app_clone.emit("network-task-progress", NetworkTaskPayload {
                id: task_id_clone.clone(),
                line: "".into(),
                status: status.into(),
                percentage: Some(100.0),
                speed_mbps: Some(last_down_speed),
                downloaded_bytes: Some(last_downloaded),
                upload_speed_mbps: Some(last_up_speed),
                uploaded_bytes: Some(last_uploaded),
            });

            // Clean up
            if let Ok(mut tasks) = app_clone.state::<AppState>().network_tasks.lock() {
                tasks.remove(&task_id_clone);
            }
        });
    } else {
        std::thread::spawn(move || {
            let on_line = |line: String| {
                let _ = app_clone.emit("network-task-progress", NetworkTaskPayload {
                    id: task_id_clone.clone(),
                    line,
                    status: "running".into(),
                    percentage: None,
                    speed_mbps: None,
                    downloaded_bytes: None,
                    upload_speed_mbps: None,
                    uploaded_bytes: None,
                });
            };

            let result = if task_type == "ping" {
                network::run_ping(&target, cancel_token.clone(), on_line)
            } else {
                network::run_tracert(&target, cancel_token.clone(), on_line)
            };

            let status = if cancel_token.load(Ordering::SeqCst) {
                "stopped"
            } else {
                match result {
                    Ok(_) => "finished",
                    Err(_) => "error",
                }
            };

            let _ = app_clone.emit("network-task-progress", NetworkTaskPayload {
                id: task_id_clone.clone(),
                line: "".into(),
                status: status.into(),
                percentage: None,
                speed_mbps: None,
                downloaded_bytes: None,
                upload_speed_mbps: None,
                uploaded_bytes: None,
            });

            // Clean up
            if let Ok(mut tasks) = app_clone.state::<AppState>().network_tasks.lock() {
                tasks.remove(&task_id_clone);
            }
        });
    }

    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn stop_network_task(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<ApiResponse<()>, String> {
    let mut tasks = state.network_tasks.lock().map_err(|e| e.to_string())?;
    if let Some(cancel_token) = tasks.remove(&task_id) {
        cancel_token.store(true, Ordering::SeqCst);
    }
    Ok(ApiResponse::ok(()))
}
