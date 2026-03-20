/**
 * 全局快捷键核心逻辑
 * 职责：使用 Windows API 注册和监听全局热键
 */
use crate::errors::AppError;
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    RegisterHotKey, UnregisterHotKey, MOD_ALT, MOD_CONTROL, MOD_SHIFT, MOD_WIN,
};

const HOTKEY_ID: i32 = 1;

#[allow(dead_code)]
enum HotkeyCommand {
    Register { modifiers: u32, vk: u32 },
    Unregister,
    Stop,
}

#[derive(Clone)]
pub struct HotkeyManager {
    #[allow(dead_code)]
    app_handle: AppHandle,
    registered: Arc<Mutex<bool>>,
    current_shortcut: Arc<Mutex<String>>,
    command_sender: Arc<Mutex<Option<Sender<HotkeyCommand>>>>,
}

impl HotkeyManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, rx) = channel::<HotkeyCommand>();
        let app_handle_clone = app_handle.clone();

        // 启动专用的热键线程
        std::thread::spawn(move || {
            Self::hotkey_thread_loop(app_handle_clone, rx);
        });

        Self {
            app_handle,
            registered: Arc::new(Mutex::new(false)),
            current_shortcut: Arc::new(Mutex::new(String::new())),
            command_sender: Arc::new(Mutex::new(Some(tx))),
        }
    }

    /// 解析快捷键字符串，返回修饰键和虚拟键码
    fn parse_shortcut(shortcut: &str) -> Result<(u32, u32), AppError> {
        let parts: Vec<&str> = shortcut.split('+').collect();
        if parts.is_empty() {
            return Err(AppError::Internal("Invalid shortcut format".to_string()));
        }

        let mut modifiers: u32 = 0;
        let key_str = parts.last().unwrap();

        for part in &parts[..parts.len() - 1] {
            match *part {
                "Ctrl" => modifiers |= MOD_CONTROL as u32,
                "Shift" => modifiers |= MOD_SHIFT as u32,
                "Alt" => modifiers |= MOD_ALT as u32,
                "Meta" | "Win" => modifiers |= MOD_WIN as u32,
                _ => {}
            }
        }

        // 将按键字符串转换为虚拟键码
        let vk = Self::key_to_vk(key_str)?;

        Ok((modifiers, vk))
    }

    /// 将按键字符串转换为 Windows 虚拟键码
    fn key_to_vk(key: &str) -> Result<u32, AppError> {
        match key {
            "A" | "a" => Ok(0x41),
            "B" | "b" => Ok(0x42),
            "C" | "c" => Ok(0x43),
            "D" | "d" => Ok(0x44),
            "E" | "e" => Ok(0x45),
            "F" | "f" => Ok(0x46),
            "G" | "g" => Ok(0x47),
            "H" | "h" => Ok(0x48),
            "I" | "i" => Ok(0x49),
            "J" | "j" => Ok(0x4A),
            "K" | "k" => Ok(0x4B),
            "L" | "l" => Ok(0x4C),
            "M" | "m" => Ok(0x4D),
            "N" | "n" => Ok(0x4E),
            "O" | "o" => Ok(0x4F),
            "P" | "p" => Ok(0x50),
            "Q" | "q" => Ok(0x51),
            "R" | "r" => Ok(0x52),
            "S" | "s" => Ok(0x53),
            "T" | "t" => Ok(0x54),
            "U" | "u" => Ok(0x55),
            "V" | "v" => Ok(0x56),
            "W" | "w" => Ok(0x57),
            "X" | "x" => Ok(0x58),
            "Y" | "y" => Ok(0x59),
            "Z" | "z" => Ok(0x5A),
            "0" => Ok(0x30),
            "1" => Ok(0x31),
            "2" => Ok(0x32),
            "3" => Ok(0x33),
            "4" => Ok(0x34),
            "5" => Ok(0x35),
            "6" => Ok(0x36),
            "7" => Ok(0x37),
            "8" => Ok(0x38),
            "9" => Ok(0x39),
            "F1" => Ok(0x70),
            "F2" => Ok(0x71),
            "F3" => Ok(0x72),
            "F4" => Ok(0x73),
            "F5" => Ok(0x74),
            "F6" => Ok(0x75),
            "F7" => Ok(0x76),
            "F8" => Ok(0x77),
            "F9" => Ok(0x78),
            "F10" => Ok(0x79),
            "F11" => Ok(0x7A),
            "F12" => Ok(0x7B),
            "Space" => Ok(0x20),
            "Enter" => Ok(0x0D),
            "Escape" => Ok(0x1B),
            "Tab" => Ok(0x09),
            _ => Err(AppError::Internal(format!("Unsupported key: {}", key))),
        }
    }

    /// 注册全局热键
    pub fn register(&self, shortcut: &str) -> Result<(), AppError> {
        if shortcut.is_empty() {
            return Ok(());
        }

        // 解析快捷键
        let (modifiers, vk) = Self::parse_shortcut(shortcut)?;

        // 发送注册命令到热键线程
        if let Some(sender) = self.command_sender.lock().unwrap().as_ref() {
            sender
                .send(HotkeyCommand::Register { modifiers, vk })
                .map_err(|e| {
                    AppError::Internal(format!("Failed to send register command: {}", e))
                })?;
        }

        *self.registered.lock().unwrap() = true;
        *self.current_shortcut.lock().unwrap() = shortcut.to_string();

        Ok(())
    }

    /// 注销全局热键
    pub fn unregister(&self) -> Result<(), AppError> {
        if !*self.registered.lock().unwrap() {
            return Ok(());
        }

        // 发送注销命令到热键线程
        if let Some(sender) = self.command_sender.lock().unwrap().as_ref() {
            sender.send(HotkeyCommand::Unregister).map_err(|e| {
                AppError::Internal(format!("Failed to send unregister command: {}", e))
            })?;
        }

        *self.registered.lock().unwrap() = false;
        *self.current_shortcut.lock().unwrap() = String::new();

        Ok(())
    }

    /// 启动 Windows 消息循环监听热键
    #[cfg(target_os = "windows")]
    fn hotkey_thread_loop(app_handle: AppHandle, rx: std::sync::mpsc::Receiver<HotkeyCommand>) {
        use std::sync::mpsc::TryRecvError;
        use winapi::um::winuser::{
            DispatchMessageW, PeekMessageW, TranslateMessage, MSG, PM_REMOVE, WM_HOTKEY,
        };

        unsafe {
            let mut msg: MSG = std::mem::zeroed();
            let mut running = true;

            while running {
                // 检查命令
                match rx.try_recv() {
                    Ok(HotkeyCommand::Register { modifiers, vk }) => {
                        // 先注销旧热键
                        UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID);

                        // 注册新热键
                        if RegisterHotKey(std::ptr::null_mut(), HOTKEY_ID, modifiers, vk) == 0 {
                            tracing::error!(
                                "Failed to register hotkey: {}",
                                std::io::Error::last_os_error()
                            );
                        } else {
                            tracing::info!("Hotkey registered successfully");
                        }
                    }
                    Ok(HotkeyCommand::Unregister) => {
                        UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID);
                        tracing::info!("Hotkey unregistered");
                    }
                    Ok(HotkeyCommand::Stop) => {
                        UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID);
                        running = false;
                    }
                    Err(TryRecvError::Disconnected) => {
                        running = false;
                    }
                    Err(TryRecvError::Empty) => {}
                }

                // 处理 Windows 消息
                while PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                    if msg.message == WM_HOTKEY && msg.wParam == HOTKEY_ID as usize {
                        tracing::info!("Hotkey triggered!");

                        // 发送事件到前端
                        let _ = app_handle.emit("hotkey_triggered", ());

                        // 显示并聚焦主窗口
                        if let Some(main_window) = app_handle.get_webview_window("main") {
                            let _ = main_window.show();
                            let _ = main_window.set_focus();
                            let _ = main_window.unminimize();
                        }
                    }

                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                // 避免 CPU 占用过高
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
        }
    }

    /// 获取当前注册的快捷键
    pub fn get_current(&self) -> String {
        self.current_shortcut.lock().unwrap().clone()
    }

    #[cfg(not(target_os = "windows"))]
    fn hotkey_thread_loop(_app_handle: AppHandle, rx: std::sync::mpsc::Receiver<HotkeyCommand>) {
        use std::sync::mpsc::TryRecvError;
        loop {
            match rx.try_recv() {
                Ok(HotkeyCommand::Stop) | Err(TryRecvError::Disconnected) => break,
                _ => {}
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }
}
