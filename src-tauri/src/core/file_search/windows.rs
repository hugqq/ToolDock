use crate::errors::AppError;
use crate::models::search::{FileSearchResponse, FileSearchResult};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use everything_ipc::wm::{EverythingClient, RequestFlags, Sort};
use image::{DynamicImage, ImageFormat, RgbaImage};
use std::collections::HashMap;
use std::io::Cursor;
use std::iter::once;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::ptr::null_mut;
use std::sync::{Mutex, OnceLock};
use winapi::ctypes::c_void;
use winapi::shared::windef::{HBITMAP, HICON};
use winapi::um::shellapi::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use winapi::um::wingdi::{
    DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BI_RGB, DIB_RGB_COLORS,
};
use winapi::um::winuser::{DestroyIcon, GetDC, GetIconInfo, ReleaseDC, ICONINFO};

const ICON_CACHE_LIMIT: usize = 256;
type IconCacheKey = (PathBuf, Option<i64>);
type IconCache = HashMap<IconCacheKey, Option<String>>;
static ICON_CACHE: OnceLock<Mutex<IconCache>> = OnceLock::new();

fn error_response(error_code: &str, available: bool) -> FileSearchResponse {
    FileSearchResponse {
        provider: "everything".into(),
        available,
        results: vec![],
        error_code: Some(error_code.into()),
    }
}

fn is_shortcut_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("lnk"))
}

fn shortcut_icon_data_url(path: &Path, modified_at: Option<i64>) -> Option<String> {
    shortcut_icon_data_url_with(path, modified_at, extract_shell_icon_data_url)
}

fn shortcut_icon_data_url_with<F>(
    path: &Path,
    modified_at: Option<i64>,
    extractor: F,
) -> Option<String>
where
    F: FnOnce(&Path) -> Option<String>,
{
    if !is_shortcut_path(path) {
        return None;
    }

    let key = (path.to_path_buf(), modified_at);
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(values) = cache.lock() {
        if let Some(value) = values.get(&key) {
            return value.clone();
        }
    }

    let icon = extractor(path);
    if let Ok(mut values) = cache.lock() {
        if values.len() >= ICON_CACHE_LIMIT {
            values.clear();
        }
        values.insert(key, icon.clone());
    }
    icon
}

fn extract_shell_icon_data_url(path: &Path) -> Option<String> {
    let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();
    let mut file_info: SHFILEINFOW = unsafe { zeroed() };
    let found = unsafe {
        SHGetFileInfoW(
            wide_path.as_ptr(),
            0,
            &mut file_info,
            size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        )
    };
    if found == 0 || file_info.hIcon.is_null() {
        return None;
    }

    let result = unsafe { encode_icon(file_info.hIcon) };
    unsafe { DestroyIcon(file_info.hIcon) };
    result
}

unsafe fn bitmap_dimensions(bitmap: HBITMAP) -> Option<(i32, i32)> {
    if bitmap.is_null() {
        return None;
    }
    let mut info: BITMAP = zeroed();
    if GetObjectW(
        bitmap as _,
        size_of::<BITMAP>() as i32,
        &mut info as *mut BITMAP as *mut c_void,
    ) == 0
    {
        return None;
    }
    let height = info.bmHeight.abs();
    (info.bmWidth > 0 && height > 0).then_some((info.bmWidth, height))
}

unsafe fn read_bitmap_bgra(bitmap: HBITMAP, width: i32, height: i32) -> Option<Vec<u8>> {
    let dc = GetDC(null_mut());
    if dc.is_null() {
        return None;
    }

    let mut info: BITMAPINFO = zeroed();
    info.bmiHeader.biSize = size_of_val(&info.bmiHeader) as u32;
    info.bmiHeader.biWidth = width;
    info.bmiHeader.biHeight = -height;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    let mut pixels = vec![0_u8; width as usize * height as usize * 4];
    let rows = GetDIBits(
        dc,
        bitmap,
        0,
        height as u32,
        pixels.as_mut_ptr() as *mut c_void,
        &mut info,
        DIB_RGB_COLORS,
    );
    ReleaseDC(null_mut(), dc);
    (rows == height).then_some(pixels)
}

unsafe fn encode_icon(icon: HICON) -> Option<String> {
    let mut icon_info: ICONINFO = zeroed();
    if GetIconInfo(icon, &mut icon_info) == 0 {
        return None;
    }

    let result = (|| {
        let (width, height) = bitmap_dimensions(icon_info.hbmColor)?;
        let mut pixels = read_bitmap_bgra(icon_info.hbmColor, width, height)?;
        if pixels.chunks_exact(4).all(|pixel| pixel[3] == 0) {
            if let Some(mask) = read_bitmap_bgra(icon_info.hbmMask, width, height) {
                for (pixel, mask_pixel) in
                    pixels.chunks_exact_mut(4).zip(mask.chunks_exact(4))
                {
                    pixel[3] = if mask_pixel[..3].iter().any(|value| *value != 0) {
                        0
                    } else {
                        255
                    };
                }
            } else {
                for pixel in pixels.chunks_exact_mut(4) {
                    pixel[3] = 255;
                }
            }
        }
        for pixel in pixels.chunks_exact_mut(4) {
            pixel.swap(0, 2);
        }

        let rgba = RgbaImage::from_raw(width as u32, height as u32, pixels)?;
        let mut png = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(rgba)
            .write_to(&mut png, ImageFormat::Png)
            .ok()?;
        Some(format!(
            "data:image/png;base64,{}",
            STANDARD.encode(png.into_inner())
        ))
    })();

    if !icon_info.hbmColor.is_null() {
        DeleteObject(icon_info.hbmColor as _);
    }
    if !icon_info.hbmMask.is_null() {
        DeleteObject(icon_info.hbmMask as _);
    }
    result
}

fn normalize_item(
    name: &str,
    parent: &str,
    is_directory: bool,
    size: Option<u64>,
    modified_at: Option<i64>,
) -> FileSearchResult {
    let path = PathBuf::from(parent).join(name);
    FileSearchResult {
        kind: if is_directory { "directory" } else { "file" }.into(),
        name: name.into(),
        path: path.to_string_lossy().into_owned(),
        modified_at,
        size: if is_directory { None } else { size },
        icon_data_url: if is_directory {
            None
        } else {
            shortcut_icon_data_url(&path, modified_at)
        },
    }
}

pub async fn provider_status() -> FileSearchResponse {
    match tauri::async_runtime::spawn_blocking(|| EverythingClient::new().is_ok()).await {
        Ok(true) => FileSearchResponse {
            provider: "everything".into(),
            available: true,
            results: vec![],
            error_code: None,
        },
        _ => error_response("provider_unavailable", false),
    }
}

pub async fn search(query: &str, limit: usize) -> Result<FileSearchResponse, AppError> {
    let query = query.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let client = match EverythingClient::new() {
            Ok(client) => client,
            Err(_) => return error_response("provider_unavailable", false),
        };
        let list = match client
            .query_wait(&query)
            .request_flags(
                RequestFlags::FileName
                    | RequestFlags::Path
                    | RequestFlags::Size
                    | RequestFlags::DateModified,
            )
            .sort(Sort::NameAscending)
            .max_results(limit as u32)
            .call()
        {
            Ok(list) => list,
            Err(_) => return error_response("query_failed", true),
        };

        let results = list
            .iter()
            .filter_map(|item| {
                let name = item.get_string(RequestFlags::FileName)?;
                let parent = item.get_string(RequestFlags::Path)?;
                let full_path = Path::new(&parent).join(&name);
                let is_directory = full_path.is_dir();
                let size = item.get_size(RequestFlags::Size);
                let modified_at = item.get_time(RequestFlags::DateModified).and_then(|time| {
                    const WINDOWS_TO_UNIX_EPOCH_TICKS: u64 = 116_444_736_000_000_000;
                    let ticks = ((time.dwHighDateTime as u64) << 32) | time.dwLowDateTime as u64;
                    ticks
                        .checked_sub(WINDOWS_TO_UNIX_EPOCH_TICKS)
                        .map(|value| (value / 10_000) as i64)
                });
                Some(normalize_item(&name, &parent, is_directory, size, modified_at))
            })
            .collect();

        FileSearchResponse {
            provider: "everything".into(),
            available: true,
            results,
            error_code: None,
        }
    })
    .await
    .map_err(|error| AppError::Internal(format!("Everything search worker failed: {error}")))
}

#[cfg(test)]
mod tests {
    use super::{is_shortcut_path, normalize_item, shortcut_icon_data_url_with};
    use std::cell::Cell;
    use std::path::Path;

    #[test]
    fn recognizes_shortcut_extensions_case_insensitively() {
        assert!(is_shortcut_path(Path::new(r"C:\Apps\Tool.lnk")));
        assert!(is_shortcut_path(Path::new(r"C:\Apps\Tool.LNK")));
        assert!(!is_shortcut_path(Path::new(r"C:\Apps\Tool.exe")));
    }

    #[test]
    fn ordinary_results_do_not_receive_shell_icon_data() {
        let item = normalize_item("notes.txt", r"C:\Users\me", false, Some(42), Some(7));
        assert_eq!(item.icon_data_url, None);
    }

    #[test]
    fn reuses_cached_shortcut_icon_for_same_path_and_modified_time() {
        let calls = Cell::new(0);
        let path = Path::new(r"C:\Apps\ToolDock-cache-test.lnk");
        let first = shortcut_icon_data_url_with(path, Some(12345), |_| {
            calls.set(calls.get() + 1);
            Some("data:image/png;base64,AA==".into())
        });
        let second = shortcut_icon_data_url_with(path, Some(12345), |_| {
            calls.set(calls.get() + 1);
            Some("different".into())
        });

        assert_eq!(first, second);
        assert_eq!(calls.get(), 1);
    }

    #[test]
    fn joins_everything_name_and_parent_path() {
        let item = normalize_item("notes.txt", r"C:\Users\me", false, Some(42), Some(7));
        assert_eq!(item.path, r"C:\Users\me\notes.txt");
        assert_eq!(item.kind, "file");
        assert_eq!(item.size, Some(42));

        let directory = normalize_item("docs", r"C:\Users\me", true, Some(42), None);
        assert_eq!(directory.kind, "directory");
        assert_eq!(directory.size, None);
    }
}
