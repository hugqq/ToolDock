pub mod ocr;
pub mod http_client;
pub mod port_scanner;
pub mod unit_converter;
pub mod variable_naming;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PkgManagerStatus {
    pub npm: bool,
    pub pnpm: bool,
    pub yarn: bool,
    pub bun: bool,
    pub deno: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ApiErrorDetail {
    pub code: String,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<ApiErrorDetail>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HashResult {
    pub path: String,
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameRuleDto {
    pub prefix: String,
    pub suffix: String,
    pub search: String,
    pub replace: String,
    pub use_regex: bool,
    pub case_sensitive: bool,
    pub auto_increment: bool,
    pub sequence_start: i32,
    pub sequence_step: i32,
    pub sequence_padding: usize,
    // 高级选项
    /// 应用对象: "both" | "name_only" | "extension_only"
    pub apply_to: String,
    /// 包含文件
    pub include_files: bool,
    /// 包含文件夹
    pub include_folders: bool,
    /// 包含子文件夹内容
    pub include_subfolders: bool,
    /// 文本格式: "none" | "lowercase" | "uppercase" | "titlecase" | "capitalize"
    pub text_formatting: String,
    /// 启用枚举项目模式 (支持 ${} 等变量)
    pub enumerate_items: bool,
    /// 启用随机字符串模式
    pub random_string: bool,
    /// 启用日期时间变量
    pub use_datetime: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenamePreview {
    pub old_path: String,
    pub new_name: String,
}

/// 重命名历史记录
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameHistoryItem {
    /// 当前完整路径（重命名后的路径）
    pub current_path: String,
    /// 原始文件名（不包含路径）
    pub original_name: String,
    /// 重命名时间戳（Unix 毫秒）
    pub timestamp: i64,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(ApiErrorDetail {
                code: code.into(),
                message: message.into(),
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationResult {
    pub translated_text: String,
    pub detected_source_language: Option<String>,
}
