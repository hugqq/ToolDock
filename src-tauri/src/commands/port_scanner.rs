use crate::core::port_scanner;
use crate::models::port_scanner::{PortOccupancy, ScanProgress};
use crate::models::ApiResponse;
use crate::AppState;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
pub struct PortScannerPayload {
    pub task_id: String,
    pub progress: ScanProgress,
    pub status: String, // "running", "finished", "error", "stopped"
}

#[tauri::command]
pub async fn start_port_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    host: String,
    ports: Vec<u16>,
    timeout_ms: u64,
    concurrency: usize,
) -> Result<ApiResponse<()>, String> {
    let cancel_token = Arc::new(AtomicBool::new(false));

    {
        let mut tasks = state.port_scanner_tasks.lock().map_err(|e| e.to_string())?;
        tasks.insert(task_id.clone(), cancel_token.clone());
    }

    let task_id_clone = task_id.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let on_progress = |progress: ScanProgress| {
            let _ = app_clone.emit(
                "port-scanner-progress",
                PortScannerPayload {
                    task_id: task_id_clone.clone(),
                    progress,
                    status: "running".into(),
                },
            );
        };

        let result = port_scanner::run_port_scan(
            host,
            ports,
            timeout_ms,
            concurrency,
            cancel_token.clone(),
            on_progress,
        )
        .await;

        let status = if cancel_token.load(Ordering::SeqCst) {
            "stopped".to_string()
        } else if result.is_ok() {
            "finished".to_string()
        } else {
            "error".to_string()
        };

        let _ = app_clone.emit(
            "port-scanner-progress",
            PortScannerPayload {
                task_id: task_id_clone.clone(),
                progress: ScanProgress {
                    current_port: 0,
                    total_ports: 0,
                    scanned_count: 0,
                    result: None,
                },
                status,
            },
        );
    });

    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn stop_port_scan(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<ApiResponse<()>, String> {
    let mut tasks = state.port_scanner_tasks.lock().map_err(|e| e.to_string())?;
    if let Some(cancel_token) = tasks.remove(&task_id) {
        cancel_token.store(true, Ordering::SeqCst);
    }
    Ok(ApiResponse::ok(()))
}

#[tauri::command]
pub async fn find_port_occupancy(port: u16) -> Result<ApiResponse<Vec<PortOccupancy>>, String> {
    port_scanner::find_port_occupancy(port)
        .map(ApiResponse::ok)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_port_process(pid: u32) -> Result<ApiResponse<()>, String> {
    port_scanner::kill_port_process(pid)
        .map(ApiResponse::ok)
        .map_err(|e| e.to_string())
}
