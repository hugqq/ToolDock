use crate::errors::AppError;
use serde::Serialize;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::filter::LevelFilter;
use tracing_subscriber::prelude::*;
use tracing_subscriber::{reload, EnvFilter};

const RUN_LOG_PREFIX: &str = "run.log";
const ERROR_LOG_PREFIX: &str = "error.log";
const DEFAULT_LOG_LEVEL: &str = "info";
const MAX_LOG_BYTES: u64 = 128 * 1024;

type LogLevelSetter = Box<dyn Fn(&str) -> Result<(), String> + Send + Sync>;

static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();
static LOG_GUARDS: OnceLock<(WorkerGuard, WorkerGuard)> = OnceLock::new();
static LOG_LEVEL_SETTER: OnceLock<LogLevelSetter> = OnceLock::new();
static CURRENT_LOG_LEVEL: OnceLock<Mutex<String>> = OnceLock::new();

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperLogs {
    pub log_dir: String,
    pub run_log_path: Option<String>,
    pub error_log_path: Option<String>,
    pub run_log: String,
    pub error_log: String,
}

pub fn normalize_log_level(level: &str) -> Result<&'static str, AppError> {
    match level.trim().to_ascii_lowercase().as_str() {
        "error" => Ok("error"),
        "warn" | "warning" => Ok("warn"),
        "info" => Ok("info"),
        "debug" => Ok("debug"),
        "trace" => Ok("trace"),
        _ => Err(AppError::Internal(format!(
            "Unsupported log level: {}",
            level
        ))),
    }
}

fn build_env_filter(level: &str) -> Result<EnvFilter, AppError> {
    let normalized = normalize_log_level(level)?;
    EnvFilter::try_new(format!("{},tao=error,winit=error", normalized))
        .map_err(|e| AppError::Internal(format!("Invalid log filter: {}", e)))
}

pub fn init_logging(log_dir: PathBuf) {
    let _ = fs::create_dir_all(&log_dir);
    let _ = LOG_DIR.set(log_dir.clone());
    let _ = CURRENT_LOG_LEVEL.set(Mutex::new(DEFAULT_LOG_LEVEL.to_string()));

    let initial_level =
        std::env::var("TOOLDOCK_LOG").unwrap_or_else(|_| DEFAULT_LOG_LEVEL.to_string());
    let env_filter = build_env_filter(&initial_level)
        .unwrap_or_else(|_| build_env_filter(DEFAULT_LOG_LEVEL).expect("default log level is valid"));
    if let Ok(normalized) = normalize_log_level(&initial_level) {
        if let Some(current) = CURRENT_LOG_LEVEL.get() {
            if let Ok(mut current) = current.lock() {
                *current = normalized.to_string();
            }
        }
    }

    let (filter_layer, reload_handle) = reload::Layer::new(env_filter);
    let run_appender = tracing_appender::rolling::daily(&log_dir, RUN_LOG_PREFIX);
    let error_appender = tracing_appender::rolling::daily(&log_dir, ERROR_LOG_PREFIX);
    let (run_writer, run_guard) = tracing_appender::non_blocking(run_appender);
    let (error_writer, error_guard) = tracing_appender::non_blocking(error_appender);

    let subscriber = tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(run_writer)
                .with_filter(filter_layer),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(error_writer)
                .with_filter(LevelFilter::ERROR),
        );

    if subscriber.try_init().is_ok() {
        let _ = LOG_GUARDS.set((run_guard, error_guard));
        let _ = LOG_LEVEL_SETTER.set(Box::new(move |level: &str| {
            let filter = build_env_filter(level).map_err(|e| e.to_string())?;
            reload_handle.reload(filter).map_err(|e| e.to_string())
        }));
    }

    tracing::info!("ToolDock logging initialized");
}

pub fn set_log_level(level: &str) -> Result<String, AppError> {
    let normalized = normalize_log_level(level)?.to_string();
    if let Some(setter) = LOG_LEVEL_SETTER.get() {
        setter(&normalized).map_err(AppError::Internal)?;
    }
    if let Some(current) = CURRENT_LOG_LEVEL.get() {
        if let Ok(mut current) = current.lock() {
            *current = normalized.clone();
        }
    }
    tracing::info!("Developer log level changed to {}", normalized);
    Ok(normalized)
}

pub fn read_developer_logs(fallback_log_dir: PathBuf) -> Result<DeveloperLogs, AppError> {
    let log_dir = LOG_DIR.get().cloned().unwrap_or(fallback_log_dir);
    fs::create_dir_all(&log_dir).map_err(AppError::Io)?;

    let run_log_path = find_latest_log(&log_dir, RUN_LOG_PREFIX)?;
    let error_log_path = find_latest_log(&log_dir, ERROR_LOG_PREFIX)?;
    let run_log = read_tail_optional(run_log_path.as_deref())?;
    let error_log = read_tail_optional(error_log_path.as_deref())?;

    Ok(DeveloperLogs {
        log_dir: log_dir.to_string_lossy().to_string(),
        run_log_path: run_log_path.map(|path| path.to_string_lossy().to_string()),
        error_log_path: error_log_path.map(|path| path.to_string_lossy().to_string()),
        run_log,
        error_log,
    })
}

fn find_latest_log(log_dir: &Path, prefix: &str) -> Result<Option<PathBuf>, AppError> {
    let mut candidates = Vec::new();
    for entry in fs::read_dir(log_dir).map_err(AppError::Io)? {
        let entry = entry.map_err(AppError::Io)?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if name.starts_with(prefix) {
            let modified = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .ok();
            candidates.push((modified, path));
        }
    }

    candidates.sort_by_key(|(modified, _)| *modified);
    Ok(candidates.pop().map(|(_, path)| path))
}

fn read_tail_optional(path: Option<&Path>) -> Result<String, AppError> {
    match path {
        Some(path) => read_tail(path, MAX_LOG_BYTES),
        None => Ok(String::new()),
    }
}

fn read_tail(path: &Path, max_bytes: u64) -> Result<String, AppError> {
    let mut file = fs::File::open(path).map_err(AppError::Io)?;
    let len = file.metadata().map_err(AppError::Io)?.len();
    if len > max_bytes {
        file.seek(SeekFrom::Start(len - max_bytes))
            .map_err(AppError::Io)?;
    }

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(AppError::Io)?;
    Ok(String::from_utf8_lossy(&buffer).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_supported_log_levels() {
        assert_eq!(normalize_log_level("ERROR").unwrap(), "error");
        assert_eq!(normalize_log_level("warning").unwrap(), "warn");
        assert_eq!(normalize_log_level("debug").unwrap(), "debug");
    }

    #[test]
    fn rejects_unknown_log_levels() {
        assert!(normalize_log_level("verbose").is_err());
    }
}
