/*
 * 系统激活命令层
 * 负责处理前端请求，管理进程生命周期
 */

use tauri::{AppHandle, Emitter, State, Manager};
use std::process::{Child, ExitStatus};
use std::thread;
use crate::core::system_activator::spawn_activation_process;
use crate::errors::{AppResult, AppError};
use crate::AppState;

#[tauri::command]
pub async fn start_activation(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut child_lock = state.activation_child.lock().unwrap();
    
    // 如果已经在运行，先停止（或者返回错误）
    if child_lock.is_some() {
        return Err(AppError::Internal("Activation process is already running".into()));
    }

    let child = spawn_activation_process()?;
    *child_lock = Some(child);
    drop(child_lock); // 释放锁，让其他命令可以使用

    // 监控进程结束
    let app_clone = app.clone();
    thread::spawn(move || {
        loop {
            thread::sleep(std::time::Duration::from_millis(500));
            let state = app_clone.state::<AppState>();
            let mut lock = state.activation_child.lock().unwrap();
            if let Some(child) = lock.as_mut() {
                let child: &mut Child = child;
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let status: ExitStatus = status;
                        let code = status.code().unwrap_or(-1);
                        let _ = app_clone.emit("activation://done", code);
                        *lock = None;
                        break;
                    }
                    Ok(None) => {
                        // 还在运行
                    }
                    Err(_) => {
                        let _ = app_clone.emit("activation://done", -1);
                        *lock = None;
                        break;
                    }
                }
            } else {
                // 进程已被外部停止
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_activation(
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut lock = state.activation_child.lock().unwrap();
    if let Some(mut child) = lock.take() {
        let _ = child.kill();
        Ok(())
    } else {
        Ok(())
    }
}
