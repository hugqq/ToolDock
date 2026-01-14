use hex;
use md5::{Digest, Md5};
use serde::Serialize;
use sha1::Sha1;
use sha2::Sha256;
use std::collections::HashMap;
/// 文件哈希计算和重复文件查找核心逻辑
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct DuplicateFile {
    pub path: String,
    pub size: u64,
    pub hash: String,
}

#[derive(Serialize, Clone)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub count: usize,
    pub files: Vec<DuplicateFile>,
}

pub fn calculate_md5(path: &str) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Md5::new();
    let mut buffer = [0; 8192];
    while let Ok(count) = file.read(&mut buffer) {
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn calculate_sha1(path: &str) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha1::new();
    let mut buffer = [0; 8192];
    while let Ok(count) = file.read(&mut buffer) {
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn calculate_sha256(path: &str) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    while let Ok(count) = file.read(&mut buffer) {
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn find_duplicates<F>(root_path: &str, mut on_progress: F) -> io::Result<Vec<DuplicateGroup>>
where
    F: FnMut(usize, usize, f64, &str),
{
    // 第一阶段：计数总文件数
    let total_files = count_files(root_path)?;

    if total_files == 0 {
        return Ok(Vec::new());
    }

    let mut file_hashes: HashMap<String, Vec<(String, u64)>> = HashMap::new();
    let mut file_count = 0;

    // 第二阶段：递归遍历目录并计算哈希
    walk_dir(
        root_path,
        &mut file_hashes,
        &mut file_count,
        total_files,
        &mut on_progress,
    )?;

    // 筛选重复文件
    let mut duplicates: Vec<DuplicateGroup> = Vec::new();

    for (hash, files) in file_hashes {
        if files.len() > 1 {
            // 获取文件大小（都相同）
            let size = std::fs::metadata(&files[0].0).map(|m| m.len()).unwrap_or(0);

            let duplicate_files: Vec<DuplicateFile> = files
                .into_iter()
                .map(|(path, _)| DuplicateFile {
                    path,
                    size,
                    hash: hash.clone(),
                })
                .collect();

            let count = duplicate_files.len();
            duplicates.push(DuplicateGroup {
                hash,
                size,
                count,
                files: duplicate_files,
            });
        }
    }

    // 按重复数量倒序排列
    duplicates.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(duplicates)
}

fn count_files(dir_path: &str) -> io::Result<usize> {
    let mut total = 0;
    let path = Path::new(dir_path);

    if !path.is_dir() {
        return Ok(0);
    }

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            if let Some(path_str) = path.to_str() {
                total += count_files(path_str)?;
            }
        } else if path.is_file() {
            total += 1;
        }
    }

    Ok(total)
}

fn walk_dir<F>(
    dir_path: &str,
    file_hashes: &mut HashMap<String, Vec<(String, u64)>>,
    file_count: &mut usize,
    total_files: usize,
    on_progress: &mut F,
) -> io::Result<()>
where
    F: FnMut(usize, usize, f64, &str),
{
    let path = Path::new(dir_path);

    if !path.is_dir() {
        return Ok(());
    }

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // 递归处理子目录
            if let Some(path_str) = path.to_str() {
                let _ = walk_dir(path_str, file_hashes, file_count, total_files, on_progress);
            }
        } else if path.is_file() {
            // 计算文件哈希
            if let Some(path_str) = path.to_str() {
                if let Ok(hash) = calculate_sha256(path_str) {
                    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

                    file_hashes
                        .entry(hash)
                        .or_insert_with(Vec::new)
                        .push((path_str.to_string(), size));

                    *file_count += 1;
                    // 每处理 5 个文件报告进度
                    if *file_count % 5 == 0 {
                        let percentage = (*file_count as f64 / total_files as f64) * 100.0;
                        on_progress(*file_count, total_files, percentage, path_str);
                    }
                }
            }
        }
    }

    Ok(())
}
