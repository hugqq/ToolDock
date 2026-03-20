use crate::errors::AppResult;
use chrono::Local;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub filename: String,
    pub created_at: String,
}

/// 读取 Nginx 配置文件
pub fn read_config(path: PathBuf) -> AppResult<String> {
    if !path.exists() {
        return Err(crate::errors::AppError::Internal("File not found".into()));
    }
    Ok(fs::read_to_string(path)?)
}

/// 写入 Nginx 配置文件
pub fn write_config(path: PathBuf, content: &str) -> AppResult<()> {
    fs::write(path, content)?;
    Ok(())
}

/// 检测 Nginx 配置语法
pub fn test_config(path: PathBuf, nginx_path: Option<String>) -> AppResult<String> {
    let cmd_path = nginx_path.unwrap_or_else(|| "nginx".to_string());
    let mut command = Command::new(&cmd_path);

    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW

    // 尝试确定 Nginx 的根目录 (prefix)
    let mut prefix: Option<PathBuf> = None;

    if let Ok(full_path) = fs::canonicalize(&cmd_path) {
        // 如果提供了 nginx.exe 的完整路径，其父目录通常是根目录（或 bin 目录）
        if let Some(parent) = full_path.parent() {
            let mut p_str = parent.to_string_lossy().to_string();
            // Windows 下 fs::canonicalize 会添加 \\?\ 前缀，Nginx 不支持这种 UNC 路径格式
            if p_str.starts_with(r"\\?\") {
                p_str = p_str.replace(r"\\?\", "");
            }
            prefix = Some(PathBuf::from(p_str));
        }
    }

    if prefix.is_none() {
        if let Some(conf_parent) = path.parent() {
            let mut p_str = conf_parent.to_string_lossy().to_string();
            if p_str.starts_with(r"\\?\") {
                p_str = p_str.replace(r"\\?\", "");
            }
            let clean_conf_parent = PathBuf::from(&p_str);

            // 如果配置文件在 conf 目录下，则其父目录通常是 Nginx 根目录
            if clean_conf_parent.ends_with("conf") {
                prefix = clean_conf_parent.parent().map(|p| p.to_path_buf());
            } else {
                prefix = Some(clean_conf_parent);
            }
        }
    }

    // 同样处理配置文件路径，防止出现混合路径或 UNC 路径
    let mut clean_path = path.to_string_lossy().to_string();
    if clean_path.starts_with(r"\\?\") {
        clean_path = clean_path.replace(r"\\?\", "");
    }

    command.arg("-t").arg("-c").arg(clean_path);

    // 如果找到了可能的根目录，使用 -p 参数设置 Nginx 的 prefix
    if let Some(p) = prefix {
        let mut p_str = p.to_string_lossy().to_string();
        if p_str.starts_with(r"\\?\") {
            p_str = p_str.replace(r"\\?\", "");
        }
        command.arg("-p").arg(p_str);
    }

    let output = command.output();

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if output.status.success() {
                Ok(stderr) // nginx -t 成功时通常输出到 stderr
            } else {
                // 返回详细错误信息
                let error_msg = if !stderr.is_empty() { stderr } else { stdout };
                Err(crate::errors::AppError::Internal(error_msg))
            }
        }
        Err(e) => {
            Err(crate::errors::AppError::Internal(format!("Failed to execute {}: {}. Please ensure it is installed and in your PATH, or specify the path in settings.", cmd_path, e)))
        }
    }
}

/// 创建备份
pub fn create_backup(path: PathBuf) -> AppResult<String> {
    if !path.exists() {
        return Err(crate::errors::AppError::Internal("File not found".into()));
    }

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = path
        .file_name()
        .ok_or_else(|| crate::errors::AppError::Internal("Invalid filename".into()))?
        .to_string_lossy();
    let mut backup_path = path.clone();
    backup_path.set_file_name(format!("{}.bak.{}", filename, timestamp));

    fs::copy(&path, &backup_path)?;
    Ok(backup_path.to_string_lossy().to_string())
}

/// 恢复备份
pub fn restore_backup(path: PathBuf, backup_path: PathBuf) -> AppResult<()> {
    if !backup_path.exists() {
        return Err(crate::errors::AppError::Internal(
            "Backup file not found".into(),
        ));
    }
    fs::copy(backup_path, path)?;
    Ok(())
}

/// 列出备份文件
pub fn list_backups(path: PathBuf) -> AppResult<Vec<BackupInfo>> {
    let parent = path
        .parent()
        .ok_or_else(|| crate::errors::AppError::Internal("Invalid path".into()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| crate::errors::AppError::Internal("Invalid filename".into()))?
        .to_string_lossy();
    let file_stem = path
        .file_stem()
        .ok_or_else(|| crate::errors::AppError::Internal("Invalid filename".into()))?
        .to_string_lossy();

    let mut backups = Vec::new();
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                // 支持两种格式：filename.bak.timestamp 和 filestem.bak.timestamp
                if name.starts_with(&format!("{}.bak.", file_name))
                    || name.starts_with(&format!("{}.bak.", file_stem))
                {
                    if let Ok(metadata) = entry.metadata() {
                        let created_at = metadata
                            .modified()
                            .unwrap_or_else(|_| metadata.created().unwrap());
                        let datetime: chrono::DateTime<Local> = created_at.into();
                        backups.push(BackupInfo {
                            path: path.to_string_lossy().to_string(),
                            filename: name.to_string(),
                            created_at: datetime.format("%Y-%m-%d %H:%M:%S").to_string(),
                        });
                    }
                }
            }
        }
    }

    // 按时间倒序排序
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

/// 删除备份
pub fn delete_backup(backup_path: PathBuf) -> AppResult<()> {
    if backup_path.exists() {
        fs::remove_file(backup_path)?;
    }
    Ok(())
}

/// 启动 Nginx
pub fn start_nginx(path: PathBuf, nginx_path: Option<String>) -> AppResult<()> {
    let cmd_path = nginx_path.unwrap_or_else(|| "nginx".to_string());
    let mut command = Command::new(&cmd_path);

    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut prefix: Option<PathBuf> = None;
    if let Ok(full_path) = fs::canonicalize(&cmd_path) {
        prefix = full_path.parent().map(|p| p.to_path_buf());
    }

    if prefix.is_none() {
        if let Some(conf_parent) = path.parent() {
            if conf_parent.ends_with("conf") {
                prefix = conf_parent.parent().map(|p| p.to_path_buf());
            } else {
                prefix = Some(conf_parent.to_path_buf());
            }
        }
    }

    let mut clean_path = path.to_string_lossy().to_string();
    if clean_path.starts_with(r"\\?\") {
        clean_path = clean_path.replace(r"\\?\", "");
    }

    command.arg("-c").arg(clean_path);

    if let Some(p) = prefix {
        let mut p_str = p.to_string_lossy().to_string();
        if p_str.starts_with(r"\\?\") {
            p_str = p_str.replace(r"\\?\", "");
        }
        command.arg("-p").arg(p_str);
    }

    // 在 Windows 上，nginx 启动后会立即返回，所以我们不需要等待它结束
    command
        .spawn()
        .map_err(|e| crate::errors::AppError::Internal(format!("Failed to start Nginx: {}", e)))?;
    Ok(())
}

/// 停止 Nginx
pub fn stop_nginx(nginx_path: Option<String>) -> AppResult<()> {
    let cmd_path = nginx_path.unwrap_or_else(|| "nginx".to_string());

    // 尝试使用 nginx -s stop
    let mut command = Command::new(&cmd_path);

    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW

    command.arg("-s").arg("stop");

    if let Ok(full_path) = fs::canonicalize(&cmd_path) {
        if let Some(parent) = full_path.parent() {
            let mut p_str = parent.to_string_lossy().to_string();
            if p_str.starts_with(r"\\?\") {
                p_str = p_str.replace(r"\\?\", "");
            }
            command.arg("-p").arg(p_str);
        }
    }

    let output = command.output();

    match output {
        Ok(out) if out.status.success() => Ok(()),
        _ => {
            // 如果 nginx -s stop 失败，尝试强制结束
            #[cfg(target_os = "windows")]
            {
                Command::new("taskkill")
                    .arg("/F")
                    .arg("/IM")
                    .arg("nginx.exe")
                    .output()
                    .map_err(|e| {
                        crate::errors::AppError::Internal(format!("Failed to stop Nginx: {}", e))
                    })?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                Command::new("killall").arg("nginx").output().map_err(|e| {
                    crate::errors::AppError::Internal(format!("Failed to stop Nginx: {}", e))
                })?;
            }
            Ok(())
        }
    }
}

/// 检查 Nginx 是否正在运行
pub fn is_nginx_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("tasklist");
        command.creation_flags(0x08000000);
        let output = command
            .arg("/FI")
            .arg("IMAGENAME eq nginx.exe")
            .arg("/NH")
            .output();
        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains("nginx.exe")
        } else {
            false
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("pgrep").arg("-x").arg("nginx").output();
        if let Ok(out) = output {
            out.status.success()
        } else {
            false
        }
    }
}

/// 扫描常见的 Nginx 配置文件路径
pub fn scan_configs() -> Vec<String> {
    let mut configs = Vec::new();

    #[cfg(target_os = "windows")]
    let common_roots: Vec<&str> = vec![
        "C:\\nginx",
        "D:\\nginx",
        "E:\\nginx",
        "C:\\Program Files\\nginx",
        "C:\\Program Files (x86)\\nginx",
    ];

    #[cfg(not(target_os = "windows"))]
    let common_roots: Vec<&str> = vec![
        "/usr/local/nginx",
        "/opt/nginx",
        "/opt/homebrew/etc/nginx",
        "/usr/local/etc/nginx",
    ];

    for root in common_roots {
        let root_path = PathBuf::from(root);
        if root_path.exists() {
            let conf_path = root_path.join("conf").join("nginx.conf");
            if conf_path.exists() {
                configs.push(conf_path.to_string_lossy().to_string());
            }
            // macOS Homebrew 等安装方式的配置文件可能直接在目录下
            let direct_conf = root_path.join("nginx.conf");
            if direct_conf.exists() {
                let s = direct_conf.to_string_lossy().to_string();
                if !configs.contains(&s) {
                    configs.push(s);
                }
            }
        }
    }

    // 从 PATH 环境变量中查找 nginx 可执行文件
    #[cfg(target_os = "windows")]
    let nginx_name = "nginx.exe";
    #[cfg(not(target_os = "windows"))]
    let nginx_name = "nginx";

    if let Ok(path_env) = std::env::var("PATH") {
        for p in std::env::split_paths(&path_env) {
            let nginx_exe = p.join(nginx_name);
            if nginx_exe.exists() {
                if let Some(parent) = nginx_exe.parent() {
                    let conf_path = parent.join("conf").join("nginx.conf");
                    if conf_path.exists() {
                        let s = conf_path.to_string_lossy().to_string();
                        if !configs.contains(&s) {
                            configs.push(s);
                        }
                    }
                }
            }
        }
    }

    configs
}
