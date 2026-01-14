/// 批量重命名核心逻辑
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::collections::HashMap;
use regex::Regex;
use chrono::{DateTime, Local};
use rand::Rng;
use uuid::Uuid;

/// 重命名历史记录项
#[derive(Debug, Clone)]
pub struct RenameHistoryEntry {
    /// 当前完整路径（重命名后的路径）
    pub current_path: String,
    /// 原始文件名（不包含路径）
    pub original_name: String,
    /// 重命名时间戳（Unix 毫秒）
    pub timestamp: i64,
}

/// 全局历史记录存储（使用 Mutex 保证线程安全）
/// key: 当前文件完整路径, value: 原始文件名
static RENAME_HISTORY: Mutex<Option<HashMap<String, RenameHistoryEntry>>> = Mutex::new(None);

/// 初始化历史记录存储
fn ensure_history_initialized() -> std::sync::MutexGuard<'static, Option<HashMap<String, RenameHistoryEntry>>> {
    let mut guard = RENAME_HISTORY.lock().unwrap();
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

#[derive(Debug, Clone)]
pub struct RenameRule {
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

/// 应用文本格式转换
fn apply_text_formatting(text: &str, formatting: &str) -> String {
    match formatting {
        "lowercase" => text.to_lowercase(),
        "uppercase" => text.to_uppercase(),
        "titlecase" => {
            // 句子首字母大写
            let mut chars = text.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str().to_lowercase().as_str(),
            }
        }
        "capitalize" => {
            // 每个单词首字母大写
            text.split_whitespace()
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str().to_lowercase().as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        }
        _ => text.to_string(),
    }
}

/// 处理枚举项目变量 (${}, ${start=X}, ${increment=X}, ${padding=X})
fn process_enumerate_variables(text: &str, index: usize) -> String {
    let mut result = text.to_string();
    
    // 处理复杂模式 ${padding=X;increment=X;start=X}
    // 只匹配包含 start/increment/padding 参数的枚举变量，排除随机字符串变量
    let complex_re = Regex::new(r"\$\{([^}]*(?:start|increment|padding)[^}]*)\}").unwrap();
    result = complex_re.replace_all(&result, |caps: &regex::Captures| {
        let params = &caps[1];
        let mut start = 0i32;
        let mut increment = 1i32;
        let mut padding = 1usize;
        
        for param in params.split(';') {
            let parts: Vec<&str> = param.trim().split('=').collect();
            if parts.len() == 2 {
                match parts[0].trim() {
                    "start" => start = parts[1].trim().parse().unwrap_or(0),
                    "increment" => increment = parts[1].trim().parse().unwrap_or(1),
                    "padding" => padding = parts[1].trim().parse().unwrap_or(1),
                    _ => {}
                }
            }
        }
        
        let value = start + (index as i32 * increment);
        format!("{:0width$}", value, width = padding)
    }).to_string();
    
    // 处理简单模式 ${}
    result = result.replace("${}", &index.to_string());
    
    result
}

/// 处理随机字符串变量
fn process_random_variables(text: &str) -> String {
    let mut result = text.to_string();
    let mut rng = rand::rng();
    
    // ${rstringalnum=X} - 字母数字混合
    let alnum_re = Regex::new(r"\$\{rstringalnum=(\d+)\}").unwrap();
    result = alnum_re.replace_all(&result, |caps: &regex::Captures| {
        let len: usize = caps[1].parse().unwrap_or(8);
        let chars: String = (0..len)
            .map(|_| {
                let idx = rng.random_range(0..62);
                match idx {
                    0..=9 => (b'0' + idx as u8) as char,
                    10..=35 => (b'A' + (idx - 10) as u8) as char,
                    _ => (b'a' + (idx - 36) as u8) as char,
                }
            })
            .collect();
        chars
    }).to_string();
    
    // ${rstringalpha=X} - 仅字母
    let alpha_re = Regex::new(r"\$\{rstringalpha=(\d+)\}").unwrap();
    result = alpha_re.replace_all(&result, |caps: &regex::Captures| {
        let len: usize = caps[1].parse().unwrap_or(8);
        let chars: String = (0..len)
            .map(|_| {
                let idx = rng.random_range(0..52);
                match idx {
                    0..=25 => (b'A' + idx as u8) as char,
                    _ => (b'a' + (idx - 26) as u8) as char,
                }
            })
            .collect();
        chars
    }).to_string();
    
    // ${rstringdigit=X} - 仅数字
    let digit_re = Regex::new(r"\$\{rstringdigit=(\d+)\}").unwrap();
    result = digit_re.replace_all(&result, |caps: &regex::Captures| {
        let len: usize = caps[1].parse().unwrap_or(8);
        let chars: String = (0..len)
            .map(|_| {
                let idx = rng.random_range(0..10);
                (b'0' + idx as u8) as char
            })
            .collect();
        chars
    }).to_string();
    
    // ${ruuidv4} - UUID v4
    result = result.replace("${ruuidv4}", &Uuid::new_v4().to_string());
    
    result
}

/// 处理日期时间变量
fn process_datetime_variables(text: &str, file_path: &Path) -> String {
    // 获取文件创建时间，失败则使用当前时间
    let datetime: DateTime<Local> = file_path
        .metadata()
        .ok()
        .and_then(|m| m.created().ok())
        .map(|t| DateTime::from(t))
        .unwrap_or_else(Local::now);
    
    let mut result = text.to_string();
    
    // 年份
    result = result.replace("$YYYY", &datetime.format("%Y").to_string());
    result = result.replace("$YY", &datetime.format("%y").to_string());
    result = result.replace("$Y", &(datetime.format("%Y").to_string().chars().last().unwrap_or('0').to_string()));
    
    // 月份
    result = result.replace("$MMMM", &datetime.format("%B").to_string());
    result = result.replace("$MMM", &datetime.format("%b").to_string());
    result = result.replace("$MM", &datetime.format("%m").to_string());
    result = result.replace("$M", &datetime.format("%-m").to_string());
    
    // 星期
    result = result.replace("$DDDD", &datetime.format("%A").to_string());
    result = result.replace("$DDD", &datetime.format("%a").to_string());
    
    // 日期
    result = result.replace("$DD", &datetime.format("%d").to_string());
    result = result.replace("$D", &datetime.format("%-d").to_string());
    
    // 时间
    result = result.replace("$hh", &datetime.format("%H").to_string());
    result = result.replace("$h", &datetime.format("%-H").to_string());
    result = result.replace("$mm", &datetime.format("%M").to_string());
    result = result.replace("$m", &datetime.format("%-M").to_string());
    result = result.replace("$ss", &datetime.format("%S").to_string());
    result = result.replace("$s", &datetime.format("%-S").to_string());
    
    // 毫秒
    let millis = datetime.format("%3f").to_string();
    result = result.replace("$fff", &millis);
    result = result.replace("$ff", &millis[..2.min(millis.len())].to_string());
    result = result.replace("$f", &millis[..1.min(millis.len())].to_string());
    
    result
}

pub fn preview_rename(paths: Vec<String>, rule: RenameRule) -> Vec<(String, String)> {
    let mut results = Vec::new();
    let mut counter = 0usize; // 用于枚举项目的计数器
    
    for path_str in paths.iter() {
        let path = Path::new(path_str);
        if path.file_name().and_then(|n| n.to_str()).is_none() {
            continue;
        }
        
        let is_dir = path.is_dir();
        
        // 根据包含选项过滤
        if is_dir && !rule.include_folders {
            continue;
        }
        if !is_dir && !rule.include_files {
            continue;
        }
        
        // 分离文件名和扩展名
        let (stem, extension) = if is_dir {
            (path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(), String::new())
        } else {
            let s = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let e = path.extension().and_then(|e| e.to_str()).map(|e| format!(".{}", e)).unwrap_or_default();
            (s, e)
        };
        
        // 根据 apply_to 决定处理目标
        let (mut working_name, mut working_ext) = match rule.apply_to.as_str() {
            "name_only" => (stem.clone(), extension.clone()),
            "extension_only" => (stem.clone(), extension.clone()),
            _ => (stem.clone(), extension.clone()), // "both"
        };
        
        // 准备序号字符串
        let seq_val = rule.sequence_start + (counter as i32 * rule.sequence_step);
        let seq_str = format!("{:0width$}", seq_val, width = rule.sequence_padding);
        
        // 处理替换文本中的高级变量
        let mut effective_replace = if rule.auto_increment && rule.replace.is_empty() {
            seq_str.clone()
        } else {
            rule.replace.clone()
        };
        
        // 处理枚举变量
        if rule.enumerate_items {
            effective_replace = process_enumerate_variables(&effective_replace, counter);
        }
        
        // 处理随机字符串变量
        if rule.random_string {
            effective_replace = process_random_variables(&effective_replace);
        }
        
        // 处理日期时间变量
        if rule.use_datetime {
            effective_replace = process_datetime_variables(&effective_replace, path);
        }
        
        // 根据 apply_to 应用替换规则
        match rule.apply_to.as_str() {
            "name_only" => {
                // 只处理文件名
                working_name = apply_rename_logic(&working_name, &rule, &effective_replace, &seq_str);
            }
            "extension_only" => {
                // 只处理扩展名（去掉前导点号处理，然后加回来）
                if !working_ext.is_empty() {
                    let ext_without_dot = &working_ext[1..]; // 去掉 "."
                    let new_ext = apply_rename_logic(ext_without_dot, &rule, &effective_replace, &seq_str);
                    working_ext = format!(".{}", new_ext);
                }
            }
            _ => {
                // 处理整个文件名（包含扩展名）
                let full_name = format!("{}{}", working_name, working_ext);
                let new_full = apply_rename_logic(&full_name, &rule, &effective_replace, &seq_str);
                // 对于 "both" 模式，直接使用结果
                working_name = new_full;
                working_ext = String::new();
            }
        }
        
        // 应用文本格式
        if rule.text_formatting != "none" {
            match rule.apply_to.as_str() {
                "name_only" => {
                    working_name = apply_text_formatting(&working_name, &rule.text_formatting);
                }
                "extension_only" => {
                    if !working_ext.is_empty() {
                        let ext_without_dot = &working_ext[1..];
                        let formatted = apply_text_formatting(ext_without_dot, &rule.text_formatting);
                        working_ext = format!(".{}", formatted);
                    }
                }
                _ => {
                    working_name = apply_text_formatting(&working_name, &rule.text_formatting);
                }
            }
        }
        
        // 组合最终文件名
        let new_name = format!("{}{}", working_name, working_ext);
        
        results.push((path_str.clone(), new_name));
        counter += 1;
    }
    
    results
}

/// 应用重命名逻辑（替换、前缀、后缀、序号）
/// 
/// # 正则捕获组支持
/// 当 `use_regex` 为 true 时，支持使用捕获组：
/// - 搜索: `(\d\d)-(\d\d)-(\d\d\d\d)` 
/// - 替换: `${3}-${2}-${1}` 会将 "12-25-2023" 转换为 "2023-25-12"
/// - 支持 `${1}`, `${2}`, ..., `${9}` 以及命名捕获组 `${name}`
/// - 注意：必须使用 `${}` 格式，不支持简写 `$1`
fn apply_rename_logic(name: &str, rule: &RenameRule, effective_replace: &str, seq_str: &str) -> String {
    let mut new_name = name.to_string();
    
    // 1. 替换逻辑
    if !rule.search.is_empty() {
        if rule.use_regex {
            if let Ok(re) = Regex::new(&rule.search) {
                // regex crate 的 replace_all 原生支持捕获组引用 ($1, $2, 等)
                new_name = re.replace_all(&new_name, effective_replace).to_string();
            }
        } else if rule.case_sensitive {
            new_name = new_name.replace(&rule.search, effective_replace);
        } else {
            // 不区分大小写替换
            let lower_name = new_name.to_lowercase();
            let lower_search = rule.search.to_lowercase();
            let mut result = String::new();
            let mut last_end = 0;
            for (start, _) in lower_name.match_indices(&lower_search) {
                result.push_str(&new_name[last_end..start]);
                result.push_str(effective_replace);
                last_end = start + rule.search.len();
            }
            result.push_str(&new_name[last_end..]);
            new_name = result;
        }
    } else if rule.auto_increment && rule.replace.is_empty() {
        // 如果 search 和 replace 都为空，且开启了自动步进，则直接将文件名改为序号
        new_name = seq_str.to_string();
    }
    
    // 2. 前缀
    if !rule.prefix.is_empty() {
        new_name = format!("{}{}", rule.prefix, new_name);
    }
    
    // 3. 后缀
    if !rule.suffix.is_empty() {
        new_name = format!("{}{}", new_name, rule.suffix);
    }
    
    // 4. 序号 (如果不是自动步进模式，或者 replace 不为空，则按原逻辑追加序号)
    if rule.sequence_step != 0 && (!rule.auto_increment || !rule.replace.is_empty()) {
        new_name = format!("{}{}", new_name, seq_str);
    }
    
    new_name
}

/// 执行重命名并返回历史记录
pub fn execute_rename(renames: Vec<(String, String)>) -> Result<Vec<RenameHistoryEntry>, String> {
    let mut history_entries = Vec::new();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    
    for (old_path_str, new_name) in renames {
        let old_path = Path::new(&old_path_str);
        if let Some(parent) = old_path.parent() {
            let new_path = parent.join(&new_name);
            if old_path != new_path {
                // 获取原始文件名
                let original_name = old_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                
                // 执行重命名
                fs::rename(old_path, &new_path).map_err(|e| e.to_string())?;
                
                // 记录历史
                let new_path_str = new_path.to_string_lossy().to_string();
                let entry = RenameHistoryEntry {
                    current_path: new_path_str.clone(),
                    original_name,
                    timestamp,
                };
                
                // 存储到全局历史记录
                {
                    let mut guard = ensure_history_initialized();
                    if let Some(ref mut map) = *guard {
                        map.insert(new_path_str, entry.clone());
                    }
                }
                
                history_entries.push(entry);
            }
        }
    }
    Ok(history_entries)
}

/// 获取指定文件的历史记录
pub fn get_rename_history(path: &str) -> Option<RenameHistoryEntry> {
    let guard = ensure_history_initialized();
    guard.as_ref()?.get(path).cloned()
}

/// 获取所有历史记录
pub fn get_all_rename_history() -> Vec<RenameHistoryEntry> {
    let guard = ensure_history_initialized();
    guard.as_ref()
        .map(|map| map.values().cloned().collect())
        .unwrap_or_default()
}

/// 还原单个文件的命名
pub fn revert_rename(current_path: &str) -> Result<String, String> {
    // 先获取历史记录
    let entry = {
        let guard = ensure_history_initialized();
        guard.as_ref()
            .and_then(|map| map.get(current_path).cloned())
    };
    
    let entry = entry.ok_or_else(|| "HISTORY_NOT_FOUND".to_string())?;
    
    let current = Path::new(current_path);
    let parent = current.parent().ok_or_else(|| "INVALID_PATH".to_string())?;
    let original_path = parent.join(&entry.original_name);
    
    // 检查目标文件是否已存在
    if original_path.exists() && current != original_path {
        return Err("TARGET_EXISTS".to_string());
    }
    
    // 执行还原
    fs::rename(current, &original_path).map_err(|e| e.to_string())?;
    
    // 从历史记录中移除
    {
        let mut guard = ensure_history_initialized();
        if let Some(ref mut map) = *guard {
            map.remove(current_path);
        }
    }
    
    Ok(original_path.to_string_lossy().to_string())
}

/// 批量还原文件命名
pub fn revert_renames(paths: Vec<String>) -> Result<Vec<(String, String)>, String> {
    let mut results = Vec::new();
    for path in paths {
        match revert_rename(&path) {
            Ok(new_path) => results.push((path, new_path)),
            Err(e) => return Err(format!("{}: {}", path, e)),
        }
    }
    Ok(results)
}

/// 清除所有历史记录
pub fn clear_rename_history() {
    let mut guard = ensure_history_initialized();
    if let Some(ref mut map) = *guard {
        map.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_regex_capture_groups() {
        // 测试日期重排序：12-25-2023 → 2023-25-12
        let rule = RenameRule {
            prefix: String::new(),
            suffix: String::new(),
            search: r"(\d\d)-(\d\d)-(\d\d\d\d)".to_string(),
            replace: "${3}-${2}-${1}".to_string(),
            use_regex: true,
            case_sensitive: true,
            auto_increment: false,
            sequence_start: 1,
            sequence_step: 0,
            sequence_padding: 1,
            apply_to: "name_only".to_string(),
            include_files: true,
            include_folders: false,
            include_subfolders: false,
            text_formatting: "none".to_string(),
            enumerate_items: false,
            random_string: false,
            use_datetime: false,
        };

        let result = apply_rename_logic("12-25-2023", &rule, "${3}-${2}-${1}", "");
        assert_eq!(result, "2023-25-12", "日期重排序失败");
    }

    #[test]
    fn test_regex_capture_groups_complex() {
        // 测试更复杂的捕获组：file_001_test → test_001_file
        let rule = RenameRule {
            prefix: String::new(),
            suffix: String::new(),
            search: r"([a-z]+)_(\d+)_([a-z]+)".to_string(),
            replace: "${3}_${2}_${1}".to_string(),
            use_regex: true,
            case_sensitive: true,
            auto_increment: false,
            sequence_start: 1,
            sequence_step: 0,
            sequence_padding: 1,
            apply_to: "name_only".to_string(),
            include_files: true,
            include_folders: false,
            include_subfolders: false,
            text_formatting: "none".to_string(),
            enumerate_items: false,
            random_string: false,
            use_datetime: false,
        };

        let result = apply_rename_logic("file_001_test", &rule, "${3}_${2}_${1}", "");
        assert_eq!(result, "test_001_file", "复杂捕获组重排失败");
    }

    #[test]
    fn test_regex_capture_groups_with_prefix_suffix() {
        // 测试捕获组 + 前后缀：test → prefix_(test)_suffix
        let rule = RenameRule {
            prefix: "prefix_".to_string(),
            suffix: "_suffix".to_string(),
            search: r"(.+)".to_string(),
            replace: "(${1})".to_string(),
            use_regex: true,
            case_sensitive: true,
            auto_increment: false,
            sequence_start: 1,
            sequence_step: 0,
            sequence_padding: 1,
            apply_to: "name_only".to_string(),
            include_files: true,
            include_folders: false,
            include_subfolders: false,
            text_formatting: "none".to_string(),
            enumerate_items: false,
            random_string: false,
            use_datetime: false,
        };

        let result = apply_rename_logic("test", &rule, "(${1})", "");
        assert_eq!(result, "prefix_(test)_suffix", "捕获组与前后缀组合失败");
    }

    #[test]
    fn test_regex_anchors_start() {
        // 测试 ^ 锚点：只匹配开头的 test
        let rule = RenameRule {
            prefix: String::new(),
            suffix: String::new(),
            search: r"^test".to_string(),
            replace: "start".to_string(),
            use_regex: true,
            case_sensitive: true,
            auto_increment: false,
            sequence_start: 1,
            sequence_step: 0,
            sequence_padding: 1,
            apply_to: "name_only".to_string(),
            include_files: true,
            include_folders: false,
            include_subfolders: false,
            text_formatting: "none".to_string(),
            enumerate_items: false,
            random_string: false,
            use_datetime: false,
        };

        let result1 = apply_rename_logic("test_file", &rule, "start", "");
        assert_eq!(result1, "start_file", "^ 锚点匹配开头失败");

        let result2 = apply_rename_logic("my_test", &rule, "start", "");
        assert_eq!(result2, "my_test", "^ 锚点不应匹配非开头");
    }

    #[test]
    fn test_regex_anchors_end() {
        // 测试 $ 锚点：只匹配末尾的 test
        let rule = RenameRule {
            prefix: String::new(),
            suffix: String::new(),
            search: r"test$".to_string(),
            replace: "end".to_string(),
            use_regex: true,
            case_sensitive: true,
            auto_increment: false,
            sequence_start: 1,
            sequence_step: 0,
            sequence_padding: 1,
            apply_to: "name_only".to_string(),
            include_files: true,
            include_folders: false,
            include_subfolders: false,
            text_formatting: "none".to_string(),
            enumerate_items: false,
            random_string: false,
            use_datetime: false,
        };

        let result1 = apply_rename_logic("file_test", &rule, "end", "");
        assert_eq!(result1, "file_end", "$ 锚点匹配末尾失败");

        let result2 = apply_rename_logic("test_file", &rule, "end", "");
        assert_eq!(result2, "test_file", "$ 锚点不应匹配非末尾");
    }

    #[test]
    fn test_regex_anchors_both() {
        // 测试 ^ 和 $ 组合：完全匹配整个字符串
        let rule = RenameRule {
            prefix: String::new(),
            suffix: String::new(),
            search: r"^test_(\d+)$".to_string(),
            replace: "file_${1}".to_string(),
            use_regex: true,
            case_sensitive: true,
            auto_increment: false,
            sequence_start: 1,
            sequence_step: 0,
            sequence_padding: 1,
            apply_to: "name_only".to_string(),
            include_files: true,
            include_folders: false,
            include_subfolders: false,
            text_formatting: "none".to_string(),
            enumerate_items: false,
            random_string: false,
            use_datetime: false,
        };

        let result1 = apply_rename_logic("test_123", &rule, "file_${1}", "");
        assert_eq!(result1, "file_123", "^$ 完全匹配失败");

        let result2 = apply_rename_logic("test_123_extra", &rule, "file_${1}", "");
        assert_eq!(result2, "test_123_extra", "^$ 不应匹配不完全符合的字符串");
    }
}
