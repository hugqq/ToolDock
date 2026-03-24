use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    GetAsyncKeyState, MapVirtualKeyW, SendInput, INPUT, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, MAPVK_VK_TO_VSC, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
    MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
    MOUSEINPUT,
};

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum ClickType {
    Single,
    Double,
}

pub struct ClickerManager {
    mouse_running: Arc<AtomicBool>,
    keyboard_running: Arc<AtomicBool>,
    /// F8/F9 全局热键是否启用，默认 false（关闭），避免干扰日常使用
    hotkey_enabled: Arc<AtomicBool>,
    mouse_settings: Arc<Mutex<Option<(u64, MouseButton, ClickType)>>>,
    keyboard_settings: Arc<Mutex<Option<(u64, u16)>>>,
    app_handle: AppHandle,
}

impl ClickerManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            mouse_running: Arc::new(AtomicBool::new(false)),
            keyboard_running: Arc::new(AtomicBool::new(false)),
            hotkey_enabled: Arc::new(AtomicBool::new(false)),
            mouse_settings: Arc::new(Mutex::new(Some((
                100,
                MouseButton::Left,
                ClickType::Single,
            )))),
            keyboard_settings: Arc::new(Mutex::new(Some((100, 0x20)))),
            app_handle,
        }
        // Note: hotkey listener NOT started at init, started on-demand via set_hotkey_enabled
    }

    /// 设置热键启用状态，首次启用时启动监听线程
    pub fn set_hotkey_enabled(&self, enabled: bool) {
        let was_enabled = self.hotkey_enabled.swap(enabled, Ordering::SeqCst);
        tracing::info!(
            "Clicker hotkeys (F8/F9) {}",
            if enabled { "enabled" } else { "disabled" }
        );
        if enabled && !was_enabled {
            self.start_hotkey_listener();
        }
    }

    /// 获取热键启用状态
    pub fn is_hotkey_enabled(&self) -> bool {
        self.hotkey_enabled.load(Ordering::SeqCst)
    }

    fn start_hotkey_listener(&self) {
        #[cfg(target_os = "windows")]
        {
            let mouse_running = self.mouse_running.clone();
            let mouse_settings = self.mouse_settings.clone();
            let keyboard_running = self.keyboard_running.clone();
            let keyboard_settings = self.keyboard_settings.clone();
            let hotkey_enabled = self.hotkey_enabled.clone();
            let app_handle = self.app_handle.clone();

            std::thread::spawn(move || {
                let mut f8_pressed = false;
                let mut f9_pressed = false;
                loop {
                    // 热键被禁用后退出线程（下次启用会重新 spawn）
                    if !hotkey_enabled.load(Ordering::SeqCst) {
                        tracing::info!("Clicker hotkey thread exiting (disabled)");
                        break;
                    }

                    unsafe {
                        // F8 切换鼠标连点
                        let state_f8 = GetAsyncKeyState(0x77); // VK_F8
                        let is_down_f8 = (state_f8 as u16 & 0x8000) != 0;

                        if is_down_f8 && !f8_pressed {
                            f8_pressed = true;

                            let currently_running = mouse_running.load(Ordering::SeqCst);
                            if currently_running {
                                mouse_running.store(false, Ordering::SeqCst);
                                let _ = app_handle.emit("clicker://mouse-status-changed", false);
                            } else {
                                let settings = mouse_settings.lock().unwrap();
                                if let Some((interval, button, type_)) = *settings {
                                    mouse_running.store(true, Ordering::SeqCst);
                                    let running_clone = mouse_running.clone();

                                    tauri::async_runtime::spawn(async move {
                                        let mut interval_timer =
                                            tokio::time::interval(Duration::from_millis(interval));
                                        interval_timer.set_missed_tick_behavior(
                                            tokio::time::MissedTickBehavior::Burst,
                                        );

                                        while running_clone.load(Ordering::SeqCst) {
                                            interval_timer.tick().await;
                                            match type_ {
                                                ClickType::Single => simulate_mouse_click(button),
                                                ClickType::Double => {
                                                    simulate_mouse_click(button);
                                                    sleep(Duration::from_millis(50)).await;
                                                    simulate_mouse_click(button);
                                                }
                                            }
                                        }
                                    });
                                    let _ = app_handle.emit("clicker://mouse-status-changed", true);
                                }
                            }
                        } else if !is_down_f8 {
                            f8_pressed = false;
                        }

                        // F9 切换键盘连点
                        let state_f9 = GetAsyncKeyState(0x78); // VK_F9
                        let is_down_f9 = (state_f9 as u16 & 0x8000) != 0;

                        if is_down_f9 && !f9_pressed {
                            f9_pressed = true;

                            let currently_running = keyboard_running.load(Ordering::SeqCst);
                            if currently_running {
                                keyboard_running.store(false, Ordering::SeqCst);
                                let _ = app_handle.emit("clicker://keyboard-status-changed", false);
                            } else {
                                let settings = keyboard_settings.lock().unwrap();
                                if let Some((interval, key_code)) = *settings {
                                    keyboard_running.store(true, Ordering::SeqCst);
                                    let running_clone = keyboard_running.clone();

                                    tauri::async_runtime::spawn(async move {
                                        let mut interval_timer =
                                            tokio::time::interval(Duration::from_millis(interval));
                                        interval_timer.set_missed_tick_behavior(
                                            tokio::time::MissedTickBehavior::Burst,
                                        );

                                        while running_clone.load(Ordering::SeqCst) {
                                            interval_timer.tick().await;
                                            simulate_key_press(key_code);
                                        }
                                    });
                                    let _ =
                                        app_handle.emit("clicker://keyboard-status-changed", true);
                                }
                            }
                        } else if !is_down_f9 {
                            f9_pressed = false;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
            });
        } // cfg(windows) end
    }

    pub fn start_mouse_clicker(
        &self,
        interval_ms: u64,
        button: MouseButton,
        click_type: ClickType,
    ) {
        if self.mouse_running.load(Ordering::SeqCst) {
            return;
        }

        if let Ok(mut settings) = self.mouse_settings.lock() {
            *settings = Some((interval_ms, button, click_type));
        }

        self.mouse_running.store(true, Ordering::SeqCst);
        let running = self.mouse_running.clone();

        tokio::spawn(async move {
            // Add delay to prevent immediate stop if clicking the button
            sleep(Duration::from_millis(500)).await;

            let mut interval_timer = tokio::time::interval(Duration::from_millis(interval_ms));
            interval_timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Burst);

            while running.load(Ordering::SeqCst) {
                interval_timer.tick().await;
                match click_type {
                    ClickType::Single => {
                        simulate_mouse_click(button);
                    }
                    ClickType::Double => {
                        simulate_mouse_click(button);
                        sleep(Duration::from_millis(50)).await;
                        simulate_mouse_click(button);
                    }
                }
            }
        });
    }

    pub fn stop_mouse_clicker(&self) {
        self.mouse_running.store(false, Ordering::SeqCst);
    }

    pub fn is_mouse_running(&self) -> bool {
        self.mouse_running.load(Ordering::SeqCst)
    }

    pub fn start_keyboard_clicker(&self, interval_ms: u64, key_code: u16) {
        if self.keyboard_running.load(Ordering::SeqCst) {
            return;
        }

        if let Ok(mut settings) = self.keyboard_settings.lock() {
            *settings = Some((interval_ms, key_code));
        }

        self.keyboard_running.store(true, Ordering::SeqCst);
        let running = self.keyboard_running.clone();

        tokio::spawn(async move {
            // Add delay to prevent immediate stop if clicking the button
            sleep(Duration::from_millis(500)).await;

            let mut interval_timer = tokio::time::interval(Duration::from_millis(interval_ms));
            interval_timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Burst);

            while running.load(Ordering::SeqCst) {
                interval_timer.tick().await;
                simulate_key_press(key_code);
            }
        });
    }

    pub fn stop_keyboard_clicker(&self) {
        self.keyboard_running.store(false, Ordering::SeqCst);
    }

    pub fn is_keyboard_running(&self) -> bool {
        self.keyboard_running.load(Ordering::SeqCst)
    }
}

#[cfg(target_os = "windows")]
fn simulate_mouse_click(button: MouseButton) {
    let (down_flag, up_flag) = match button {
        MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    };

    unsafe {
        let mut inputs: [INPUT; 2] = std::mem::zeroed();

        inputs[0].type_ = INPUT_MOUSE;
        let mut mi_down: MOUSEINPUT = std::mem::zeroed();
        mi_down.dwFlags = down_flag;
        *inputs[0].u.mi_mut() = mi_down;

        inputs[1].type_ = INPUT_MOUSE;
        let mut mi_up: MOUSEINPUT = std::mem::zeroed();
        mi_up.dwFlags = up_flag;
        *inputs[1].u.mi_mut() = mi_up;

        SendInput(2, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
    }
}

#[cfg(not(target_os = "windows"))]
fn simulate_mouse_click(_button: MouseButton) {
    // Not supported on this platform
}

#[cfg(target_os = "windows")]
fn simulate_key_press(vk: u16) {
    unsafe {
        let mut inputs: [INPUT; 2] = std::mem::zeroed();
        let scan_code = MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) as u16;

        inputs[0].type_ = INPUT_KEYBOARD;
        let mut ki_down: KEYBDINPUT = std::mem::zeroed();
        ki_down.wVk = vk;
        ki_down.wScan = scan_code;
        *inputs[0].u.ki_mut() = ki_down;

        inputs[1].type_ = INPUT_KEYBOARD;
        let mut ki_up: KEYBDINPUT = std::mem::zeroed();
        ki_up.wVk = vk;
        ki_up.wScan = scan_code;
        ki_up.dwFlags = KEYEVENTF_KEYUP;
        *inputs[1].u.ki_mut() = ki_up;

        SendInput(2, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
    }
}

#[cfg(not(target_os = "windows"))]
fn simulate_key_press(_vk: u16) {
    // Not supported on this platform
}

/// Simulate typing text using Unicode input
pub fn simulate_text_input(text: &str, delay_ms: u64) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        for ch in text.chars() {
            simulate_unicode_char(ch);
            if delay_ms > 0 {
                std::thread::sleep(Duration::from_millis(delay_ms));
            }
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (text, delay_ms);
        Err("Text input simulation is only supported on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
fn simulate_unicode_char(ch: char) {
    unsafe {
        let mut inputs: [INPUT; 2] = std::mem::zeroed();

        // Key down
        inputs[0].type_ = INPUT_KEYBOARD;
        let mut ki_down: KEYBDINPUT = std::mem::zeroed();
        ki_down.wScan = ch as u16;
        ki_down.dwFlags = KEYEVENTF_UNICODE;
        *inputs[0].u.ki_mut() = ki_down;

        // Key up
        inputs[1].type_ = INPUT_KEYBOARD;
        let mut ki_up: KEYBDINPUT = std::mem::zeroed();
        ki_up.wScan = ch as u16;
        ki_up.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        *inputs[1].u.ki_mut() = ki_up;

        SendInput(2, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
    }
}
