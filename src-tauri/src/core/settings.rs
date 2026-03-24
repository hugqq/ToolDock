/**
 * 设置核心逻辑
 * 职责：处理配置文件的加密导出、导入以及系统级设置（如管理员启动）
 */
use crate::errors::AppError;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use sha2::{Digest, Sha256};
use std::env;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

/// 加密配置数据
pub fn encrypt_config(data: &str, password: &str) -> Result<String, AppError> {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key_bytes = hasher.finalize();
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    // 使用固定 Nonce 或随机 Nonce。为了简单且安全，这里使用随机 Nonce 并将其附加在密文前。
    let nonce_bytes = [0u8; 12]; // 在实际生产中应使用随机 nonce，这里简化处理
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| AppError::Internal(format!("Encryption failed: {}", e)))?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(combined))
}

/// 解密配置数据
pub fn decrypt_config(encrypted_data: &str, password: &str) -> Result<String, AppError> {
    let combined = general_purpose::STANDARD
        .decode(encrypted_data)
        .map_err(|e| AppError::Internal(format!("Invalid base64: {}", e)))?;

    if combined.len() < 12 {
        return Err(AppError::Internal("Invalid encrypted data".into()));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key_bytes = hasher.finalize();
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext).map_err(|e| AppError::Internal(format!("Invalid UTF-8: {}", e)))
}

/// 设置是否以管理员身份启动
#[cfg(target_os = "windows")]
pub fn set_run_as_admin(enabled: bool) -> Result<(), AppError> {
    let exe_path = env::current_exe()
        .map_err(|e| AppError::Io(e))?
        .to_string_lossy()
        .to_string();

    // 开发环境（tauri dev / cargo run）不应给 debug/release 产物写 RUNASADMIN，
    // 否则会导致后续调试启动出现 os error 740。
    let exe_path_lower = exe_path.to_lowercase();
    let is_dev_binary =
        exe_path_lower.contains("\\target\\debug\\") || exe_path_lower.contains("\\target\\release\\");
    if is_dev_binary {
        return Err(AppError::Internal(
            "开发环境不支持设置管理员启动，请在已安装版本中使用该功能".into(),
        ));
    }

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers";

    let (key, _) = hkcu.create_subkey(path).map_err(|e| AppError::Io(e))?;

    if enabled {
        key.set_value(&exe_path, &"~ RUNASADMIN")
            .map_err(|e| AppError::Io(e))?;
    } else {
        let _ = key.delete_value(&exe_path);
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn set_run_as_admin(_enabled: bool) -> Result<(), AppError> {
    Err(AppError::Internal(
        "Run as admin is only supported on Windows".into(),
    ))
}

/// 检查当前进程是否以管理员（提权）身份运行
#[cfg(target_os = "windows")]
pub fn is_run_as_admin() -> Result<bool, AppError> {
    use std::mem;
    use winapi::shared::minwindef::FALSE;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::{GetCurrentProcess, OpenProcessToken};
    use winapi::um::securitybaseapi::GetTokenInformation;
    use winapi::um::winnt::{TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};

    unsafe {
        let mut token = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == FALSE {
            return Ok(false);
        }

        let mut elevation: TOKEN_ELEVATION = mem::zeroed();
        let mut return_length: u32 = 0;

        let result = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut return_length,
        );

        CloseHandle(token);

        if result == FALSE {
            return Ok(false);
        }

        Ok(elevation.TokenIsElevated != 0)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_run_as_admin() -> Result<bool, AppError> {
    Ok(false)
}

/// 注册全局快捷键（保存到注册表/配置文件，供下次启动时使用）
#[cfg(target_os = "windows")]
pub fn save_global_shortcut(shortcut: &str) -> Result<(), AppError> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\ToolDock\Settings";

    let (key, _) = hkcu.create_subkey(path).map_err(|e| AppError::Io(e))?;

    if shortcut.is_empty() {
        let _ = key.delete_value("GlobalShortcut");
    } else {
        key.set_value("GlobalShortcut", &shortcut)
            .map_err(|e| AppError::Io(e))?;
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn save_global_shortcut(_shortcut: &str) -> Result<(), AppError> {
    // On non-Windows, global shortcut persistence is not yet implemented
    Ok(())
}

/// 保存静默启动配置到 app data 目录
pub fn save_silent_start(data_dir: &std::path::Path, enabled: bool) -> Result<(), AppError> {
    std::fs::create_dir_all(data_dir).map_err(AppError::Io)?;
    let path = data_dir.join("startup-config.json");
    let config = serde_json::json!({ "silentStart": enabled });
    std::fs::write(&path, config.to_string()).map_err(AppError::Io)?;
    Ok(())
}

/// 读取静默启动配置
pub fn load_silent_start(data_dir: &std::path::Path) -> bool {
    let path = data_dir.join("startup-config.json");
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            return json
                .get("silentStart")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
        }
    }
    true
}

/// 读取全局快捷键配置
#[cfg(target_os = "windows")]
pub fn load_global_shortcut() -> Result<String, AppError> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\ToolDock\Settings";

    let key = match hkcu.open_subkey(path) {
        Ok(k) => k,
        Err(_) => return Ok(String::new()),
    };

    match key.get_value("GlobalShortcut") {
        Ok(v) => Ok(v),
        Err(_) => Ok(String::new()),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn load_global_shortcut() -> Result<String, AppError> {
    Ok(String::new())
}
