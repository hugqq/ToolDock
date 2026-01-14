use crate::core::file::FolderInfo;
use crate::errors::{AppError, AppResult};
use crate::models::PkgManagerStatus;
use crate::AppState;
use rayon::prelude::*;
use std::fs;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{Emitter, State, Window};
use walkdir::WalkDir;

#[derive(serde::Serialize, Clone)]
struct ProgressPayload {
    current: usize,
    total: usize,
    folder_name: String,
}

#[tauri::command]
pub async fn stop_scan(state: State<'_, AppState>) -> AppResult<()> {
    state.cancel_scan.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn scan_folder_size(
    window: Window,
    state: State<'_, AppState>,
    path: String,
) -> AppResult<Vec<FolderInfo>> {
    use std::sync::atomic::AtomicU64;

    // Reset cancel flag
    state.cancel_scan.store(false, Ordering::SeqCst);

    // 获取直接子项
    let entries: Vec<_> = std::fs::read_dir(&path)?
        .filter_map(|entry| entry.ok())
        .collect();

    if entries.is_empty() {
        return Ok(vec![]);
    }

    let file_counter = Arc::new(AtomicUsize::new(0));
    let last_emit_time = Arc::new(AtomicU64::new(0));

    // 并行计算每个直接子项的大小
    let results: Vec<FolderInfo> = entries
        .into_par_iter()
        .filter_map(|entry| {
            if state.cancel_scan.load(Ordering::SeqCst) {
                return None;
            }

            let item_path = entry.path();
            let item_name = entry.file_name().to_string_lossy().to_string();
            let is_dir = item_path.is_dir();
            let path_str = item_path.to_string_lossy().to_string();

            // 递归计算大小（并行执行）
            let size = if is_dir {
                calculate_dir_size_parallel(
                    &item_path,
                    &state.cancel_scan,
                    &file_counter,
                    &last_emit_time,
                    &window,
                )
            } else {
                fs::metadata(&item_path).map(|m| m.len()).unwrap_or(0)
            };

            if state.cancel_scan.load(Ordering::SeqCst) {
                return None;
            }

            Some(FolderInfo {
                path: path_str,
                name: item_name,
                size,
                is_dir,
            })
        })
        .collect();

    if state.cancel_scan.load(Ordering::SeqCst) {
        return Ok(vec![]);
    }

    let mut sorted_results = results;
    sorted_results.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(sorted_results)
}

// 并行计算目录大小的辅助函数
fn calculate_dir_size_parallel(
    dir: &std::path::Path,
    cancel_flag: &AtomicBool,
    file_counter: &Arc<AtomicUsize>,
    last_emit_time: &Arc<AtomicU64>,
    window: &Window,
) -> u64 {
    use std::sync::atomic::AtomicU64;

    let total_size = Arc::new(AtomicU64::new(0));

    // 使用 WalkDir 遍历，但使用 Rayon 并行处理
    let entries: Vec<_> = WalkDir::new(dir)
        .min_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .collect();

    entries.par_iter().for_each(|entry| {
        if cancel_flag.load(Ordering::Relaxed) {
            return;
        }

        let entry_path = entry.path();
        let count = file_counter.fetch_add(1, Ordering::Relaxed) + 1;

        // 节流：每1000个文件或每300ms发送一次进度
        if count % 1000 == 0 {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            let last_emit = last_emit_time.load(Ordering::Relaxed);

            if now - last_emit > 300 {
                last_emit_time.store(now, Ordering::Relaxed);
                let _ = window.emit(
                    "scan-progress",
                    ProgressPayload {
                        current: count,
                        total: 0,
                        folder_name: entry_path.to_string_lossy().to_string(),
                    },
                );
            }
        }

        // 只统计文件大小
        if entry_path.is_file() {
            if let Ok(metadata) = fs::metadata(entry_path) {
                total_size.fetch_add(metadata.len(), Ordering::Relaxed);
            }
        }
    });

    total_size.load(Ordering::Relaxed)
}

#[tauri::command]
pub async fn scan_node_modules(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<Vec<FolderInfo>> {
    state.cancel_scan.store(false, Ordering::SeqCst);

    let mut results = Vec::new();
    let root = std::path::Path::new(&path);

    let mut it = walkdir::WalkDir::new(root).into_iter();
    loop {
        if state.cancel_scan.load(Ordering::SeqCst) {
            break;
        }

        let entry = match it.next() {
            None => break,
            Some(Err(_)) => continue,
            Some(Ok(entry)) => entry,
        };

        let path = entry.path();
        if path.is_dir()
            && path
                .file_name()
                .map(|n| n == "node_modules")
                .unwrap_or(false)
        {
            let size = crate::core::file::get_folder_size(path);
            results.push(FolderInfo {
                path: path.to_string_lossy().to_string(),
                name: "node_modules".to_string(),
                size,
                is_dir: true,
            });
            it.skip_current_dir();
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn delete_node_modules(path: String) -> AppResult<()> {
    crate::core::file::fast_delete_dir(path)?;
    Ok(())
}

#[tauri::command]
pub async fn list_nvm_versions() -> Result<Vec<crate::core::file::NvmVersion>, String> {
    crate::core::file::list_nvm_versions()
}

#[tauri::command]
pub async fn use_nvm_version(version: String) -> Result<(), String> {
    crate::core::file::use_nvm_version(version)
}

#[tauri::command]
pub async fn install_nvm_version(version: String) -> Result<(), String> {
    crate::core::file::install_nvm_version(version)
}

#[tauri::command]
pub async fn uninstall_nvm_version(version: String) -> Result<(), String> {
    crate::core::file::uninstall_nvm_version(version)
}

#[tauri::command]
pub async fn check_pkg_managers() -> AppResult<PkgManagerStatus> {
    let (npm, pnpm, yarn, bun, deno) = crate::core::file::check_pkg_managers();
    Ok(PkgManagerStatus {
        npm,
        pnpm,
        yarn,
        bun,
        deno,
    })
}

#[tauri::command]
pub async fn pkg_install(window: Window, path: String, command: String) -> AppResult<()> {
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let mut cmd = Command::new("cmd");
    cmd.args(&["/C", &command])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if !path.is_empty() {
        cmd.current_dir(&path);
    }

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| AppError::Io(e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let window_clone = window.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = window_clone.emit("pkg-log", line);
            }
        }
    });

    let window_clone = window.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = window_clone.emit("pkg-log", line);
            }
        }
    });

    let status = child.wait().map_err(|e| AppError::Io(e))?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::Internal(format!("{} failed", command)))
    }
}

#[tauri::command]
pub async fn pnpm_install(window: Window, path: String) -> AppResult<()> {
    pkg_install(window, path, "pnpm install".to_string()).await
}

#[tauri::command]
pub async fn delete_item(path: String) -> AppResult<()> {
    crate::core::file::delete_item(path)?;
    Ok(())
}
