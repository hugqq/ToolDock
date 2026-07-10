use crate::errors::AppError;
use serde::Serialize;
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

const NAMESPACE_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\MyComputer\NameSpace";

#[derive(Debug, Clone, Serialize)]
pub struct MyComputerNamespaceItem {
    pub key_name: String,
    pub display_name: String,
    pub namespace_value: Option<String>,
    pub clsid_value: Option<String>,
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteMyComputerNamespaceResult {
    pub deleted_count: usize,
    pub failed_items: Vec<String>,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MyComputerNamespaceBackup {
    pub path: String,
    pub file_name: String,
    pub modified_at: Option<i64>,
}

#[cfg(target_os = "windows")]
fn read_default_string(key: &winreg::RegKey) -> Option<String> {
    key.get_value::<String, _>("")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

#[cfg(target_os = "windows")]
fn read_string_value(key: &winreg::RegKey, name: &str) -> Option<String> {
    key.get_value::<String, _>(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn is_guid_key(value: &str) -> bool {
    let text = value.trim();
    if !(text.starts_with('{') && text.ends_with('}') && text.len() == 38) {
        return false;
    }

    let inner = &text[1..text.len() - 1];
    let parts: Vec<&str> = inner.split('-').collect();
    if parts.len() != 5 {
        return false;
    }

    let lengths = [8, 4, 4, 4, 12];
    parts.iter().zip(lengths).all(|(part, len)| {
        part.len() == len && part.chars().all(|ch| ch.is_ascii_hexdigit())
    })
}

#[cfg(target_os = "windows")]
fn read_clsid_value(guid: &str) -> Option<(String, Option<String>)> {
    use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    let paths = [
        (hkcu, format!(r"Software\Classes\CLSID\{}", guid)),
        (hkcr, format!(r"CLSID\{}", guid)),
    ];

    for (root, path) in paths {
        if let Ok(key) = root.open_subkey_with_flags(path, KEY_READ) {
            let display_name = read_default_string(&key);
            let target = key
                .open_subkey_with_flags(r"Instance\InitPropertyBag", KEY_READ)
                .ok()
                .and_then(|subkey| read_string_value(&subkey, "TargetFolderPath"));

            if let Some(name) = display_name {
                return Some((name, target));
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
pub fn scan_icons() -> Result<Vec<MyComputerNamespaceItem>, AppError> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let namespace = match hkcu.open_subkey_with_flags(NAMESPACE_KEY, KEY_READ) {
        Ok(key) => key,
        Err(_) => return Ok(Vec::new()),
    };

    let mut items = Vec::new();

    for key_name in namespace.enum_keys().flatten() {
        let namespace_value = namespace
            .open_subkey_with_flags(&key_name, KEY_READ)
            .ok()
            .and_then(|key| read_default_string(&key));
        let clsid_info = read_clsid_value(&key_name);
        let clsid_value = clsid_info.as_ref().map(|(name, _)| name.clone());
        let target = clsid_info.as_ref().and_then(|(_, target)| target.clone());
        let display_name = namespace_value
            .clone()
            .or_else(|| clsid_value.clone())
            .unwrap_or_else(|| key_name.clone());

        items.push(MyComputerNamespaceItem {
            key_name,
            display_name,
            namespace_value,
            clsid_value,
            target,
        });
    }

    items.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    Ok(items)
}

#[cfg(not(target_os = "windows"))]
pub fn scan_icons() -> Result<Vec<MyComputerNamespaceItem>, AppError> {
    Err(AppError::Internal(
        "This tool is only supported on Windows".into(),
    ))
}

fn backup_file_path(data_dir: &Path) -> Result<PathBuf, AppError> {
    std::fs::create_dir_all(data_dir).map_err(AppError::Io)?;
    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    Ok(data_dir.join(format!("my-computer-namespace-backup-{}.reg", timestamp)))
}

fn is_namespace_backup_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with("my-computer-namespace-backup-") && name.ends_with(".reg"))
        .unwrap_or(false)
}

pub fn list_backups(data_dir: &Path) -> Result<Vec<MyComputerNamespaceBackup>, AppError> {
    let entries = match std::fs::read_dir(data_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(AppError::Io(error)),
    };

    let mut backups = Vec::new();

    for entry in entries {
        let entry = entry.map_err(AppError::Io)?;
        let path = entry.path();
        if !is_namespace_backup_file(&path) {
            continue;
        }

        let metadata = entry.metadata().ok();
        let modified_at = metadata
            .and_then(|meta| meta.modified().ok())
            .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64);
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();

        backups.push(MyComputerNamespaceBackup {
            path: path.to_string_lossy().to_string(),
            file_name,
            modified_at,
        });
    }

    backups.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(backups)
}

fn backup_files(data_dir: &Path) -> Result<Vec<PathBuf>, AppError> {
    let entries = match std::fs::read_dir(data_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(AppError::Io(error)),
    };

    let mut paths = Vec::new();
    for entry in entries {
        let entry = entry.map_err(AppError::Io)?;
        let path = entry.path();
        if is_namespace_backup_file(&path) {
            paths.push(path);
        }
    }

    paths.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
    Ok(paths)
}

fn prune_old_backups(data_dir: &Path, keep_path: Option<&Path>) -> Result<(), AppError> {
    let keep_path = match keep_path {
        Some(path) => path.to_path_buf(),
        None => match backup_files(data_dir)?.into_iter().next() {
            Some(path) => path,
            None => return Ok(()),
        },
    };

    for path in backup_files(data_dir)? {
        if path != keep_path {
            std::fs::remove_file(path).map_err(AppError::Io)?;
        }
    }

    Ok(())
}

pub fn list_latest_backup(data_dir: &Path) -> Result<Vec<MyComputerNamespaceBackup>, AppError> {
    prune_old_backups(data_dir, None)?;
    list_backups(data_dir)
}

fn is_path_inside(parent: &Path, child: &Path) -> Result<bool, AppError> {
    let parent = parent.canonicalize().map_err(AppError::Io)?;
    let child = child.canonicalize().map_err(AppError::Io)?;
    Ok(child.starts_with(parent))
}

#[cfg(target_os = "windows")]
pub fn restore_backup(data_dir: &Path, backup_path: &Path) -> Result<(), AppError> {
    if !is_namespace_backup_file(backup_path) || !is_path_inside(data_dir, backup_path)? {
        return Err(AppError::PermissionDenied(
            "Only ToolDock registry backups can be restored".into(),
        ));
    }

    let status = Command::new("reg")
        .args(["import", &backup_path.to_string_lossy()])
        .status()
        .map_err(AppError::Io)?;

    if !status.success() {
        return Err(AppError::Internal("Failed to import registry backup".into()));
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn restore_backup(_data_dir: &Path, _backup_path: &Path) -> Result<(), AppError> {
    Err(AppError::Internal(
        "This tool is only supported on Windows".into(),
    ))
}

#[cfg(target_os = "windows")]
fn export_namespace_backup(path: &Path) -> Result<(), AppError> {
    let status = Command::new("reg")
        .args([
            "export",
            &format!(r"HKCU\{}", NAMESPACE_KEY),
            &path.to_string_lossy(),
            "/y",
        ])
        .status()
        .map_err(AppError::Io)?;

    if !status.success() {
        return Err(AppError::Internal(
            "Failed to export registry backup before deletion".into(),
        ));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn delete_icons(
    data_dir: &Path,
    key_names: Vec<String>,
) -> Result<DeleteMyComputerNamespaceResult, AppError> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_ALL_ACCESS};
    use winreg::RegKey;

    let selected: Vec<String> = key_names
        .into_iter()
        .filter(|key_name| is_guid_key(key_name))
        .collect();

    if selected.is_empty() {
        return Err(AppError::Internal("No valid registry keys selected".into()));
    }

    let backup_path = backup_file_path(data_dir)?;
    export_namespace_backup(&backup_path)?;
    prune_old_backups(data_dir, Some(&backup_path))?;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let namespace = hkcu
        .open_subkey_with_flags(NAMESPACE_KEY, KEY_ALL_ACCESS)
        .map_err(AppError::Io)?;

    let mut deleted_count = 0;
    let mut failed_items = Vec::new();

    for key_name in selected {
        match namespace.delete_subkey_all(&key_name) {
            Ok(_) => deleted_count += 1,
            Err(_) => failed_items.push(key_name),
        }
    }

    Ok(DeleteMyComputerNamespaceResult {
        deleted_count,
        failed_items,
        backup_path: backup_path.to_string_lossy().to_string(),
    })
}

#[cfg(not(target_os = "windows"))]
pub fn delete_icons(
    _data_dir: &Path,
    _key_names: Vec<String>,
) -> Result<DeleteMyComputerNamespaceResult, AppError> {
    Err(AppError::Internal(
        "This tool is only supported on Windows".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::{is_guid_key, is_namespace_backup_file, list_backups, prune_old_backups};
    use std::path::{Path, PathBuf};

    #[test]
    fn accepts_registry_guid_subkey() {
        assert!(is_guid_key("{01234567-89AB-CDEF-0123-456789ABCDEF}"));
    }

    #[test]
    fn rejects_non_guid_subkey() {
        assert!(!is_guid_key(r"..\Run"));
        assert!(!is_guid_key("plain-text"));
    }

    #[test]
    fn recognizes_namespace_backup_files_only() {
        assert!(is_namespace_backup_file(Path::new(
            "my-computer-namespace-backup-20260709-120000.reg"
        )));
        assert!(!is_namespace_backup_file(Path::new("other-backup.reg")));
        assert!(!is_namespace_backup_file(Path::new(
            "my-computer-namespace-backup-20260709-120000.txt"
        )));
    }

    fn test_backup_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "tooldock-backup-test-{}",
            uuid::Uuid::new_v4()
        ))
    }

    #[test]
    fn prunes_old_backups_and_keeps_latest_only() {
        let dir = test_backup_dir();
        std::fs::create_dir_all(&dir).unwrap();
        let old_backup = dir.join("my-computer-namespace-backup-20260709-120000.reg");
        let latest_backup = dir.join("my-computer-namespace-backup-20260709-121000.reg");
        std::fs::write(&old_backup, "old").unwrap();
        std::fs::write(&latest_backup, "latest").unwrap();

        prune_old_backups(&dir, Some(&latest_backup)).unwrap();
        let backups = list_backups(&dir).unwrap();

        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].file_name, "my-computer-namespace-backup-20260709-121000.reg");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
