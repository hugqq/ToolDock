use rayon::prelude::*;
use std::fs;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::Path;
use walkdir::WalkDir;

pub fn get_folder_size<P: AsRef<Path>>(path: P) -> u64 {
    let path = path.as_ref();
    if path.is_file() {
        return fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    }

    fs::read_dir(path)
        .map(|read_dir| {
            read_dir
                .filter_map(|entry| entry.ok())
                .collect::<Vec<_>>()
                .into_par_iter()
                .map(|entry| {
                    let p = entry.path();
                    if p.is_dir() {
                        get_folder_size(p)
                    } else {
                        entry.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

#[derive(serde::Serialize)]
pub struct FolderInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
}

#[derive(serde::Serialize)]
pub struct NvmVersion {
    pub version: String,
    pub is_current: bool,
}

pub fn list_nvm_versions() -> Result<Vec<NvmVersion>, String> {
    use std::process::Command;
    let nvm_home = std::env::var("NVM_HOME")
        .or_else(|_| std::env::var("NVM_DIR"))
        .map_err(|_| "NVM_HOME/NVM_DIR not found".to_string())?;

    let mut versions = Vec::new();
    let entries = fs::read_dir(&nvm_home).map_err(|e| e.to_string())?;

    // 方案改进：直接运行 node -v 获取当前生效的版本，这是最准确的
    let mut cmd = Command::new("node");
    cmd.arg("-v");
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let output = cmd.output();

    let current_node_v = output
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default(); // 例如 "v20.19.6"

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('v')
                    && name.chars().nth(1).map(|c| c.is_digit(10)).unwrap_or(false)
                {
                    let version = name.to_string();
                    // 比较版本号，忽略可能的 'v' 前缀差异
                    let is_current = !current_node_v.is_empty()
                        && (current_node_v == version
                            || format!("v{}", current_node_v) == version
                            || current_node_v == format!("v{}", version));

                    versions.push(NvmVersion {
                        version,
                        is_current,
                    });
                }
            }
        }
    }

    // 排序版本号
    versions.sort_by(|a, b| {
        let parse = |v: &str| {
            v.trim_start_matches('v')
                .split('.')
                .map(|s| s.parse::<u32>().unwrap_or(0))
                .collect::<Vec<_>>()
        };
        parse(&b.version).cmp(&parse(&a.version))
    });

    Ok(versions)
}

pub fn use_nvm_version(version: String) -> Result<(), String> {
    use std::process::Command;
    #[cfg(windows)]
    let status = {
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", &format!("nvm use {} < nul", version)]);
        cmd.creation_flags(0x08000000);
        cmd.status()
    };
    #[cfg(not(windows))]
    let status = Command::new("nvm").args(&["use", &version]).status();
    let status = status.map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to switch to version {}", version))
    }
}

pub fn install_nvm_version(version: String) -> Result<(), String> {
    use std::process::Command;
    #[cfg(windows)]
    let status = {
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", &format!("nvm install {} < nul", version)]);
        cmd.creation_flags(0x08000000);
        cmd.status()
    };
    #[cfg(not(windows))]
    let status = Command::new("nvm").args(&["install", &version]).status();
    let status = status.map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to install version {}", version))
    }
}

pub fn uninstall_nvm_version(version: String) -> Result<(), String> {
    use std::process::Command;
    #[cfg(windows)]
    let status = {
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", &format!("nvm uninstall {} < nul", version)]);
        cmd.creation_flags(0x08000000);
        cmd.status()
    };
    #[cfg(not(windows))]
    let status = Command::new("nvm").args(&["uninstall", &version]).status();
    let status = status.map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to uninstall version {}", version))
    }
}

pub fn check_pkg_managers() -> (bool, bool, bool, bool, bool) {
    use std::process::Command;

    let check = |cmd: &str| -> bool {
        #[cfg(windows)]
        {
            #[allow(unused_imports)]
            use std::os::windows::process::CommandExt;
            let mut command = Command::new("cmd");
            command.args(&["/C", &format!("where {}", cmd)]);
            command.creation_flags(0x08000000);
            command.status().map(|s| s.success()).unwrap_or(false)
        }
        #[cfg(not(windows))]
        {
            Command::new("which")
                .arg(cmd)
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        }
    };

    (
        check("npm"),
        check("pnpm"),
        check("yarn"),
        check("bun"),
        check("deno"),
    )
}

pub fn pkg_install(path: String, command_str: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(windows)]
    let mut command = {
        #[allow(unused_imports)]
        use std::os::windows::process::CommandExt;
        let mut c = Command::new("cmd");
        c.args(&["/C", &command_str]);
        c.creation_flags(0x08000000);
        c
    };
    #[cfg(not(windows))]
    let mut command = {
        let mut c = Command::new("sh");
        c.args(&["-c", &command_str]);
        c
    };

    if !path.is_empty() {
        command.current_dir(path);
    }

    let status = command.status().map_err(|e| e.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to run {}", command_str))
    }
}

pub fn pnpm_install(path: String) -> Result<(), String> {
    pkg_install(path, "pnpm".to_string())
}

pub fn scan_subfolders<P: AsRef<Path>>(root: P) -> Vec<FolderInfo> {
    let entries: Vec<_> = fs::read_dir(root)
        .map(|read_dir| read_dir.filter_map(|entry| entry.ok()).collect())
        .unwrap_or_else(|_| vec![]);

    entries
        .into_par_iter()
        .map(|entry| {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = path.is_dir();
            let size = get_folder_size(&path);
            FolderInfo {
                path: path_str,
                name,
                size,
                is_dir,
            }
        })
        .collect()
}

pub fn delete_item<P: AsRef<Path>>(path: P) -> std::io::Result<()> {
    if path.as_ref().is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
}

pub fn scan_node_modules<P: AsRef<Path>>(root: P) -> Vec<FolderInfo> {
    let mut results = Vec::new();
    let root = root.as_ref();

    let mut it = WalkDir::new(root).into_iter();
    loop {
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
            let size = get_folder_size(path);
            results.push(FolderInfo {
                path: path.to_string_lossy().to_string(),
                name: "node_modules".to_string(),
                size,
                is_dir: true,
            });
            // 找到 node_modules 后停止向下递归，提高性能
            it.skip_current_dir();
        }
    }
    results
}

#[cfg(windows)]
pub fn fast_delete_dir<P: AsRef<Path>>(path: P) -> std::io::Result<()> {
    use std::process::Command;
    let path = path.as_ref();

    if !path.exists() {
        return Ok(());
    }

    // 1. 尝试重命名目录（立即释放原路径名，防止占用）
    let parent = path.parent().unwrap_or(Path::new("."));
    let temp_path = parent.join(format!(".deleting_{}", uuid::Uuid::new_v4()));

    let delete_target = if fs::rename(path, &temp_path).is_ok() {
        temp_path
    } else {
        path.to_path_buf()
    };

    // 2. 优先使用 rd /s /q，这是 Windows 最稳健的批量删除方式
    let _ = Command::new("cmd")
        .args(&["/C", "rd", "/s", "/q"])
        .arg(&delete_target)
        .creation_flags(0x08000000)
        .status();

    // 3. 如果 rd 没删掉（可能因为文件锁定或路径过长），尝试使用 robocopy 镜像空目录
    if delete_target.exists() {
        let empty_dir = parent.join(format!(".empty_{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&empty_dir);

        let _ = Command::new("robocopy")
            .arg(&empty_dir)
            .arg(&delete_target)
            .args(&[
                "/MIR", "/NJH", "/NJS", "/MT:16", "/R:0", "/W:0", "/NFL", "/NDL",
            ])
            .creation_flags(0x08000000)
            .status();

        let _ = fs::remove_dir_all(&empty_dir);

        // 再次尝试 rd
        let _ = Command::new("cmd")
            .args(&["/C", "rd", "/s", "/q"])
            .arg(&delete_target)
            .creation_flags(0x08000000)
            .status();
    }

    // 4. 最终检查
    if !delete_target.exists() {
        Ok(())
    } else {
        // 最后的兜底：标准递归删除
        fs::remove_dir_all(&delete_target)
    }
}

#[cfg(not(windows))]
pub fn fast_delete_dir<P: AsRef<Path>>(path: P) -> std::io::Result<()> {
    fs::remove_dir_all(path)
}
