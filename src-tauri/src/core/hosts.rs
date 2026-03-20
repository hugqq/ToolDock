/*
 * @file hosts.rs
 * @brief Hosts 文件读写与备份核心逻辑
 */

use crate::errors::AppResult;
use chrono::Local;
use std::fs;
use std::path::{Path, PathBuf};

/// 获取系统 Hosts 文件路径
pub fn get_hosts_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        Path::new(&system_root).join("System32\\drivers\\etc\\hosts")
    }
    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("/etc/hosts")
    }
}

/// 读取 Hosts 文件内容
pub fn read_hosts() -> AppResult<String> {
    let path = get_hosts_path();
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(fs::read_to_string(path)?)
}

/// 写入 Hosts 文件内容
pub fn write_hosts(content: &str) -> AppResult<()> {
    let path = get_hosts_path();
    // 尝试移除只读属性
    if let Ok(metadata) = fs::metadata(&path) {
        let mut permissions = metadata.permissions();
        if permissions.readonly() {
            permissions.set_readonly(false);
            let _ = fs::set_permissions(&path, permissions);
        }
    }
    fs::write(path, content)?;
    Ok(())
}

/// 创建 Hosts 备份
pub fn create_backup(backup_dir: &Path) -> AppResult<String> {
    if !backup_dir.exists() {
        fs::create_dir_all(backup_dir)?;
    }

    let hosts_path = get_hosts_path();
    if !hosts_path.exists() {
        return Err(crate::errors::AppError::Internal(
            "Hosts file not found".into(),
        ));
    }

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_filename = format!("hosts_{}.bak", timestamp);
    let backup_path = backup_dir.join(&backup_filename);

    fs::copy(hosts_path, backup_path)?;
    Ok(backup_filename)
}

/// 获取备份列表
pub fn list_backups(backup_dir: &Path) -> AppResult<Vec<String>> {
    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = vec![];
    for entry in fs::read_dir(backup_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                if filename.starts_with("hosts_") && filename.ends_with(".bak") {
                    backups.push(filename.to_string());
                }
            }
        }
    }
    backups.sort_by(|a, b| b.cmp(a)); // 按时间倒序排列
    Ok(backups)
}

/// 从备份还原
pub fn restore_backup(backup_dir: &Path, filename: &str) -> AppResult<()> {
    let backup_path = backup_dir.join(filename);
    if !backup_path.exists() {
        return Err(crate::errors::AppError::Internal(
            "Backup file not found".into(),
        ));
    }

    let hosts_path = get_hosts_path();
    // 尝试移除只读属性
    if let Ok(metadata) = fs::metadata(&hosts_path) {
        let mut permissions = metadata.permissions();
        if permissions.readonly() {
            permissions.set_readonly(false);
            let _ = fs::set_permissions(&hosts_path, permissions);
        }
    }
    fs::copy(backup_path, hosts_path)?;
    Ok(())
}

/// 删除备份
pub fn delete_backup(backup_dir: &Path, filename: &str) -> AppResult<()> {
    let backup_path = backup_dir.join(filename);
    if backup_path.exists() {
        fs::remove_file(backup_path)?;
    }
    Ok(())
}
