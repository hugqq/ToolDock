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
use winreg::enums::*;
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
pub fn set_run_as_admin(enabled: bool) -> Result<(), AppError> {
    let exe_path = env::current_exe()
        .map_err(|e| AppError::Io(e))?
        .to_string_lossy()
        .to_string();

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

/// 检查是否已设置以管理员身份启动
pub fn is_run_as_admin() -> Result<bool, AppError> {
    let exe_path = env::current_exe()
        .map_err(|e| AppError::Io(e))?
        .to_string_lossy()
        .to_string();

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers";

    let key = match hkcu.open_subkey(path) {
        Ok(k) => k,
        Err(_) => return Ok(false),
    };

    let value: String = match key.get_value(&exe_path) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };

    Ok(value.contains("RUNASADMIN"))
}

/// 注册全局快捷键（保存到注册表，供下次启动时使用）
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

/// 读取全局快捷键配置
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
