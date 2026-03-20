/**
 * 微信助手核心逻辑
 * 职责：提供微信窗口捕获、消息提取、文本填充功能
 */
use crate::errors::AppError;

#[cfg(target_os = "windows")]
use std::ffi::OsString;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;
#[cfg(target_os = "windows")]
use std::ptr::null_mut;
#[cfg(target_os = "windows")]
use std::thread;
#[cfg(target_os = "windows")]
use std::time::Duration;
#[cfg(target_os = "windows")]
use winapi::shared::minwindef::{DWORD, MAX_PATH};
#[cfg(target_os = "windows")]
use winapi::shared::windef::HWND;
#[cfg(target_os = "windows")]
use winapi::um::handleapi::CloseHandle;
#[cfg(target_os = "windows")]
use winapi::um::processthreadsapi::OpenProcess;
#[cfg(target_os = "windows")]
use winapi::um::psapi::GetModuleFileNameExW;
#[cfg(target_os = "windows")]
use winapi::um::winbase::{GlobalAlloc, GlobalFree, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
#[cfg(target_os = "windows")]
use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData, CF_UNICODETEXT,
};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    EnumChildWindows, EnumWindows, GetClassNameW, GetCursorPos, GetWindowTextLengthW,
    GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, SendMessageW, SetFocus,
    SetForegroundWindow, WindowFromPoint,
};

// Windows消息常量
#[cfg(target_os = "windows")]
const WM_SETTEXT: u32 = 0x000C;

#[derive(Debug, Clone)]
pub struct WeChatWindow {
    pub hwnd: isize,
    pub title: String,
}

/// 等待用户点击并获取窗口句柄
#[cfg(target_os = "windows")]
pub fn wait_for_window_click(timeout_secs: u64) -> Result<WeChatWindow, AppError> {
    thread::sleep(Duration::from_millis(500)); // 给用户一点反应时间

    let start = std::time::Instant::now();
    let mut last_pos = None;

    while start.elapsed().as_secs() < timeout_secs {
        unsafe {
            let mut point: winapi::shared::windef::POINT = std::mem::zeroed();
            GetCursorPos(&mut point);

            // 检测鼠标位置是否改变（用户点击）
            if let Some(last) = last_pos {
                if last != (point.x, point.y) {
                    let hwnd = WindowFromPoint(point);
                    if !hwnd.is_null() {
                        // 获取顶层窗口（防止点击到子控件）
                        use winapi::um::winuser::GetAncestor;
                        use winapi::um::winuser::GA_ROOT;
                        let root_hwnd = GetAncestor(hwnd, GA_ROOT);
                        let target_hwnd = if root_hwnd.is_null() { hwnd } else { root_hwnd };

                        // 获取窗口标题
                        let mut buffer = [0u16; 512];
                        let len =
                            GetWindowTextW(target_hwnd, buffer.as_mut_ptr(), buffer.len() as i32);

                        let title = if len > 0 {
                            String::from_utf16_lossy(&buffer[..len as usize])
                        } else {
                            String::new()
                        };

                        // 验证是否是微信窗口（通过进程名判断）
                        if let Some(process_name) = get_process_name(target_hwnd) {
                            if process_name == "wechat.exe"
                                || process_name == "wechatappex.exe"
                                || process_name == "weixin.exe"
                            {
                                return Ok(WeChatWindow {
                                    hwnd: target_hwnd as isize,
                                    title: if title.is_empty() {
                                        format!("微信 ({})", process_name)
                                    } else {
                                        title
                                    },
                                });
                            }
                        }
                    }
                }
            }
            last_pos = Some((point.x, point.y));
        }

        thread::sleep(Duration::from_millis(100));
    }

    tracing::error!("等待点击超时");
    Err(AppError::Internal(
        "等待窗口点击超时，未检测到点击微信窗口".to_string(),
    ))
}

/// 从微信窗口捕获最新消息
#[cfg(target_os = "windows")]
pub fn capture_wechat_message(hwnd: isize) -> Result<String, AppError> {
    if hwnd == 0 {
        return Err(AppError::Internal("无效的窗口句柄".to_string()));
    }

    tracing::info!("开始捕获微信消息，窗口句柄: {}", hwnd);

    unsafe {
        let hwnd_ptr = hwnd as HWND;

        // 激活窗口
        tracing::debug!("激活微信窗口...");
        SetForegroundWindow(hwnd_ptr);
        thread::sleep(Duration::from_millis(500));

        // 提示：直接从剪贴板读取（用户应该已经手动复制了消息）
        tracing::debug!("读取剪贴板内容...");
        let text = get_clipboard_text()?;

        if text.is_empty() {
            return Err(AppError::Internal(
                "剪贴板内容为空。\n\n请先在微信中：\n1. 选中要回复的消息（单击或按住鼠标左键拖动选择）\n2. 右键点击消息选择\"复制\"，或按 Ctrl+C\n3. 然后再点击\"捕获消息\"按钮".to_string()
            ));
        }

        Ok(text)
    }
}

/// 仅读取剪贴板内容（不激活窗口）
#[cfg(target_os = "windows")]
pub fn read_clipboard_silent() -> Result<String, AppError> {
    unsafe {
        let text = get_clipboard_text()?;
        Ok(text)
    }
}

/// 将文本填充到微信输入框
#[cfg(target_os = "windows")]
pub fn fill_wechat_input(text: &str) -> Result<(), AppError> {
    if text.is_empty() {
        return Err(AppError::Internal("填充内容为空".to_string()));
    }

    unsafe {
        // 设置剪贴板内容
        set_clipboard_text(text)?;
        thread::sleep(Duration::from_millis(200));

        // 模拟 Ctrl+V 粘贴
        simulate_key_combination(&[0x11, 0x56])?; // VK_CONTROL + 'V'
        thread::sleep(Duration::from_millis(100));

        Ok(())
    }
}

/// 模拟按键组合
#[cfg(target_os = "windows")]
unsafe fn simulate_key_combination(keys: &[i32]) -> Result<(), AppError> {
    use winapi::um::winuser::{SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP};

    let mut inputs: Vec<INPUT> = Vec::new();

    // 按下所有按键
    for &key in keys.iter() {
        let mut input: INPUT = std::mem::zeroed();
        input.type_ = INPUT_KEYBOARD;
        *input.u.ki_mut() = KEYBDINPUT {
            wVk: key as u16,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0,
        };
        inputs.push(input);
    }

    // 释放所有按键（逆序）
    for &key in keys.iter().rev() {
        let mut input: INPUT = std::mem::zeroed();
        input.type_ = INPUT_KEYBOARD;
        *input.u.ki_mut() = KEYBDINPUT {
            wVk: key as u16,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };
        inputs.push(input);
    }

    let sent = SendInput(
        inputs.len() as u32,
        inputs.as_mut_ptr(),
        std::mem::size_of::<INPUT>() as i32,
    );

    if sent == 0 {
        return Err(AppError::Internal("发送按键失败".to_string()));
    }

    Ok(())
}

/// 获取剪贴板文本
#[cfg(target_os = "windows")]
unsafe fn get_clipboard_text() -> Result<String, AppError> {
    use winapi::um::winuser::{CloseClipboard, GetClipboardData, OpenClipboard, CF_UNICODETEXT};

    if OpenClipboard(null_mut()) == 0 {
        return Err(AppError::Internal("无法打开剪贴板".to_string()));
    }

    let h_data = GetClipboardData(CF_UNICODETEXT);
    if h_data.is_null() {
        CloseClipboard();
        return Ok(String::new());
    }

    let p_data = GlobalLock(h_data) as *const u16;
    if p_data.is_null() {
        CloseClipboard();
        return Err(AppError::Internal("无法锁定剪贴板数据".to_string()));
    }

    // 计算字符串长度
    let mut len = 0;
    while *p_data.add(len) != 0 {
        len += 1;
    }

    let slice = std::slice::from_raw_parts(p_data, len);
    let text = String::from_utf16_lossy(slice);

    GlobalUnlock(h_data);
    CloseClipboard();

    Ok(text)
}

/// 设置剪贴板文本
#[cfg(target_os = "windows")]
unsafe fn set_clipboard_text(text: &str) -> Result<(), AppError> {
    if OpenClipboard(null_mut()) == 0 {
        return Err(AppError::Internal("无法打开剪贴板".to_string()));
    }

    EmptyClipboard();

    // 转换为 UTF-16
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let size = wide.len() * 2;

    let h_mem = GlobalAlloc(GMEM_MOVEABLE, size);
    if h_mem.is_null() {
        CloseClipboard();
        return Err(AppError::Internal("无法分配内存".to_string()));
    }

    let p_mem = GlobalLock(h_mem) as *mut u16;
    if p_mem.is_null() {
        GlobalFree(h_mem);
        CloseClipboard();
        return Err(AppError::Internal("无法锁定内存".to_string()));
    }

    std::ptr::copy_nonoverlapping(wide.as_ptr(), p_mem, wide.len());
    GlobalUnlock(h_mem);

    if SetClipboardData(CF_UNICODETEXT, h_mem).is_null() {
        GlobalFree(h_mem);
        CloseClipboard();
        return Err(AppError::Internal("无法设置剪贴板数据".to_string()));
    }

    CloseClipboard();
    Ok(())
}

/// 获取窗口的进程名
#[cfg(target_os = "windows")]
unsafe fn get_process_name(hwnd: HWND) -> Option<String> {
    let mut process_id: DWORD = 0;
    GetWindowThreadProcessId(hwnd, &mut process_id);

    if process_id == 0 {
        return None;
    }

    // 首先尝试使用完整权限
    let mut process_handle =
        OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, process_id);

    // 如果失败，尝试使用更低权限
    if process_handle.is_null() {
        process_handle = OpenProcess(PROCESS_QUERY_INFORMATION, 0, process_id);
        if process_handle.is_null() {
            return None;
        }
    }

    let mut path_buffer = [0u16; MAX_PATH];
    let len = GetModuleFileNameExW(
        process_handle,
        null_mut(),
        path_buffer.as_mut_ptr(),
        MAX_PATH as DWORD,
    );

    CloseHandle(process_handle);

    if len > 0 {
        let path = OsString::from_wide(&path_buffer[..len as usize]);
        let path_str = path.to_string_lossy().to_string();

        // 提取文件名
        if let Some(filename) = path_str.split('\\').last() {
            let name = filename.to_lowercase();
            return Some(name);
        }
    }

    None
}

/// 查找微信窗口
#[cfg(target_os = "windows")]
pub fn find_wechat_window() -> Result<WeChatWindow, AppError> {
    unsafe {
        use std::sync::Mutex;

        #[derive(Clone)]
        struct WindowInfo {
            hwnd: isize,
            title: String,
            process: String,
        }

        static FOUND_WINDOWS: Mutex<Vec<WindowInfo>> = Mutex::new(Vec::new());

        unsafe extern "system" fn enum_window_callback(hwnd: HWND, _lparam: isize) -> i32 {
            // 只查找可见窗口
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }

            // 获取窗口标题
            let title_len = GetWindowTextLengthW(hwnd);
            let title = if title_len > 0 {
                let mut title_buffer = vec![0u16; (title_len + 1) as usize];
                let len =
                    GetWindowTextW(hwnd, title_buffer.as_mut_ptr(), title_buffer.len() as i32);
                if len > 0 {
                    String::from_utf16_lossy(&title_buffer[..len as usize])
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            // 获取进程名
            if let Some(process_name) = get_process_name(hwnd) {
                // 记录所有可能相关的窗口
                if process_name.contains("wechat") || process_name.contains("weixin") {
                    let mut windows = FOUND_WINDOWS.lock().unwrap();
                    windows.push(WindowInfo {
                        hwnd: hwnd as isize,
                        title: title.clone(),
                        process: process_name.clone(),
                    });
                }

                // 检查是否是微信进程
                if process_name == "wechat.exe"
                    || process_name == "wechatappex.exe"
                    || process_name == "weixin.exe"
                {
                    let mut windows = FOUND_WINDOWS.lock().unwrap();
                    // 优先选择有标题的窗口
                    if !title.is_empty() {
                        windows.insert(
                            0,
                            WindowInfo {
                                hwnd: hwnd as isize,
                                title: title.clone(),
                                process: process_name,
                            },
                        );
                        return 0; // 找到有标题的窗口，停止枚举
                    }
                }
            }

            1 // 继续枚举
        }

        // 清空之前的结果
        {
            let mut windows = FOUND_WINDOWS.lock().unwrap();
            windows.clear();
        }

        // 枚举所有顶级窗口
        EnumWindows(Some(enum_window_callback), 0);

        let windows = FOUND_WINDOWS.lock().unwrap();

        if windows.is_empty() {
            return Err(AppError::Internal(
                "未找到微信窗口。\n\n请确保：\n1. 微信已启动\n2. 微信窗口可见（未最小化）\n\n支持的微信进程：\n- WeChat.exe\n- WeChatAppEx.exe\n- Weixin.exe".to_string()
            ));
        }

        // 返回第一个找到的窗口
        let window = &windows[0];

        Ok(WeChatWindow {
            hwnd: window.hwnd,
            title: if window.title.is_empty() {
                format!("微信 ({})", window.process)
            } else {
                window.title.clone()
            },
        })
    }
}

/// 查找窗口的输入框控件（多种策略）
#[cfg(target_os = "windows")]
unsafe fn find_edit_control(parent_hwnd: HWND) -> Option<HWND> {
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Debug)]
    struct ControlInfo {
        hwnd: isize,
        class_name: String,
        priority: i32, // 优先级，越小越优先
    }

    let found_controls: Arc<Mutex<Vec<ControlInfo>>> = Arc::new(Mutex::new(Vec::new()));
    let found_controls_clone = Arc::clone(&found_controls);

    unsafe extern "system" fn enum_child_callback(hwnd: HWND, lparam: isize) -> i32 {
        let found_ptr = lparam as *const Arc<Mutex<Vec<ControlInfo>>>;
        let found = unsafe { &*found_ptr };

        // 获取控件类名
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(hwnd, class_name.as_mut_ptr(), class_name.len() as i32);

        if len > 0 {
            let class_str = String::from_utf16_lossy(&class_name[..len as usize]);
            let class_lower = class_str.to_lowercase();

            // 多种匹配策略，按优先级
            let priority = if class_lower == "edit" {
                1 // 标准 Edit 控件，最高优先级
            } else if class_lower.contains("edit") {
                2 // 包含 edit 的自定义控件
            } else if class_lower.contains("richedit") {
                3 // RichEdit 控件
            } else if class_lower.contains("text") {
                4 // 包含 text 的控件
            } else if class_lower.contains("input") {
                5 // 包含 input 的控件
            } else {
                return 1; // 不匹配，继续枚举
            };

            let mut controls = found.lock().unwrap();
            controls.push(ControlInfo {
                hwnd: hwnd as isize,
                class_name: class_str,
                priority,
            });
        }

        1 // 继续枚举所有控件
    }

    // 枚举子窗口
    EnumChildWindows(
        parent_hwnd,
        Some(enum_child_callback),
        &*found_controls_clone as *const _ as isize,
    );

    let mut controls = found_controls.lock().unwrap();

    if controls.is_empty() {
        tracing::warn!("未找到任何可能的输入框控件");
        return None;
    }

    // 按优先级排序
    controls.sort_by_key(|c| c.priority);

    // 记录找到的控件
    for (i, ctrl) in controls.iter().enumerate() {
        tracing::debug!(
            "找到候选控件 #{}: HWND={}, 类名={}, 优先级={}",
            i + 1,
            ctrl.hwnd,
            ctrl.class_name,
            ctrl.priority
        );
    }

    // 返回优先级最高的控件
    Some(controls[0].hwnd as HWND)
}

/// 直接填充文本到微信输入框（通过窗口句柄）
#[cfg(target_os = "windows")]
pub fn fill_text_to_wechat(hwnd: isize, text: &str) -> Result<(), AppError> {
    if text.is_empty() {
        return Err(AppError::Internal("填充内容为空".to_string()));
    }

    tracing::info!("开始填充文本到微信，文本长度: {}", text.len());

    unsafe {
        let target_hwnd = hwnd as HWND;

        // 策略1: 激活窗口
        tracing::debug!("策略1: 激活微信窗口...");
        SetForegroundWindow(target_hwnd);
        thread::sleep(Duration::from_millis(500)); // 增加等待时间

        // 策略2: 查找输入框控件并尝试直接设置
        tracing::debug!("策略2: 查找输入框控件...");
        let edit_hwnd = find_edit_control(target_hwnd);

        if let Some(edit) = edit_hwnd {
            tracing::info!("找到输入框控件: {:?}", edit);

            // 将文本转换为 UTF-16
            let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();

            // 尝试设置焦点
            tracing::debug!("尝试设置焦点到输入框...");
            SetFocus(edit);
            thread::sleep(Duration::from_millis(200));

            // 尝试使用 WM_SETTEXT 消息设置文本
            tracing::debug!("尝试使用 WM_SETTEXT 设置文本...");
            let result = SendMessageW(edit, WM_SETTEXT, 0, wide.as_ptr() as isize);

            if result != 0 {
                tracing::info!("WM_SETTEXT 成功设置文本");
                return Ok(());
            } else {
                tracing::warn!("WM_SETTEXT 失败，尝试剪贴板方式...");
            }
        } else {
            tracing::warn!("未找到输入框控件，将使用剪贴板方式");
        }

        // 策略3: 使用剪贴板 + Ctrl+V（通用回退方案）
        tracing::debug!("策略3: 使用剪贴板方式填充...");

        // 设置剪贴板内容
        set_clipboard_text(text)?;
        thread::sleep(Duration::from_millis(200));

        // 再次确保窗口激活
        SetForegroundWindow(target_hwnd);
        thread::sleep(Duration::from_millis(300));

        // 策略3a: 尝试点击输入框区域（如果找到了控件）
        if let Some(edit) = edit_hwnd {
            tracing::debug!("尝试点击输入框控件...");
            use winapi::um::winuser::{WM_LBUTTONDOWN, WM_LBUTTONUP};
            SendMessageW(edit, WM_LBUTTONDOWN, 0, 0);
            thread::sleep(Duration::from_millis(50));
            SendMessageW(edit, WM_LBUTTONUP, 0, 0);
            thread::sleep(Duration::from_millis(100));
        }

        // 模拟 Ctrl+V 粘贴
        tracing::debug!("模拟 Ctrl+V 粘贴...");
        simulate_key_combination(&[0x11, 0x56])?; // VK_CONTROL + V
        thread::sleep(Duration::from_millis(300));

        // 策略4: 如果上面都失败，尝试 Ctrl+A 全选后再粘贴
        tracing::debug!("策略4: 尝试全选后粘贴...");
        simulate_key_combination(&[0x11, 0x41])?; // Ctrl+A 全选
        thread::sleep(Duration::from_millis(100));
        simulate_key_combination(&[0x11, 0x56])?; // Ctrl+V 粘贴
        thread::sleep(Duration::from_millis(200));

        tracing::info!("文本填充流程完成");
        Ok(())
    }
}

// Non-Windows stubs
#[cfg(not(target_os = "windows"))]
pub fn wait_for_window_click(_timeout_secs: u64) -> Result<WeChatWindow, AppError> {
    Err(AppError::Internal(
        "WeChat assistant is only supported on Windows".into(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn capture_wechat_message(_hwnd: isize) -> Result<String, AppError> {
    Err(AppError::Internal(
        "WeChat assistant is only supported on Windows".into(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn read_clipboard_silent() -> Result<String, AppError> {
    Err(AppError::Internal(
        "WeChat assistant is only supported on Windows".into(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn fill_wechat_input(_text: &str) -> Result<(), AppError> {
    Err(AppError::Internal(
        "WeChat assistant is only supported on Windows".into(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn find_wechat_window() -> Result<WeChatWindow, AppError> {
    Err(AppError::Internal(
        "WeChat assistant is only supported on Windows".into(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn fill_text_to_wechat(_hwnd: isize, _text: &str) -> Result<(), AppError> {
    Err(AppError::Internal(
        "WeChat assistant is only supported on Windows".into(),
    ))
}
