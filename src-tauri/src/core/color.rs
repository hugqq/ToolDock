use device_query::{DeviceQuery, DeviceState, Keycode, MouseState};
use screenshots::Screen;
use std::{thread, time::Duration};

#[cfg(target_os = "windows")]
use winapi::um::wingdi::GetPixel;
#[cfg(target_os = "windows")]
use winapi::um::winuser::{GetAsyncKeyState, GetDC, ReleaseDC, VK_LBUTTON, VK_MBUTTON, VK_RBUTTON};

/// 使用 Windows API 直接检测鼠标按键状态
#[cfg(target_os = "windows")]
fn is_any_mouse_button_pressed() -> bool {
    unsafe {
        let left = GetAsyncKeyState(VK_LBUTTON);
        let right = GetAsyncKeyState(VK_RBUTTON);
        let middle = GetAsyncKeyState(VK_MBUTTON);
        // 检查最高位 (0x8000) 表示按键当前是否被按下
        (left as u16 & 0x8000) != 0 || (right as u16 & 0x8000) != 0 || (middle as u16 & 0x8000) != 0
    }
}

#[cfg(not(target_os = "windows"))]
fn is_any_mouse_button_pressed() -> bool {
    let device_state = DeviceState::new();
    let mouse: MouseState = device_state.get_mouse();
    !mouse.button_pressed.is_empty()
}

#[derive(serde::Serialize)]
pub struct PixelInfo {
    pub x: i32,
    pub y: i32,
    pub color: String,
}

pub fn get_mouse_pixel() -> Result<PixelInfo, String> {
    let device_state = DeviceState::new();
    let mouse: MouseState = device_state.get_mouse();
    let x = mouse.coords.0;
    let y = mouse.coords.1;

    #[cfg(target_os = "windows")]
    {
        unsafe {
            let hdc = GetDC(std::ptr::null_mut());
            if hdc.is_null() {
                return Err("Failed to get device context".to_string());
            }
            let pixel = GetPixel(hdc, x, y);
            ReleaseDC(std::ptr::null_mut(), hdc);

            if pixel == 0xFFFFFFFF {
                return Err("Failed to get pixel".to_string());
            }

            let r = (pixel & 0xFF) as u8;
            let g = ((pixel >> 8) & 0xFF) as u8;
            let b = ((pixel >> 16) & 0xFF) as u8;

            Ok(PixelInfo {
                x,
                y,
                color: format!("#{:02X}{:02X}{:02X}", r, g, b),
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let screens = Screen::all().map_err(|e| e.to_string())?;
        let screen = screens.iter().find(|s| {
            x >= s.display_info.x
                && x < s.display_info.x + s.display_info.width as i32
                && y >= s.display_info.y
                && y < s.display_info.y + s.display_info.height as i32
        });

        if let Some(screen) = screen {
            let relative_x = x - screen.display_info.x;
            let relative_y = y - screen.display_info.y;

            let image = screen
                .capture_area(relative_x, relative_y, 1, 1)
                .map_err(|e| e.to_string())?;

            let pixel = image.get_pixel(0, 0);
            let r = pixel[0];
            let g = pixel[1];
            let b = pixel[2];

            Ok(PixelInfo {
                x,
                y,
                color: format!("#{:02X}{:02X}{:02X}", r, g, b),
            })
        } else {
            Err("Screen not found".to_string())
        }
    }
}

pub fn pick_color() -> Result<String, String> {
    let device_state = DeviceState::new();

    // 1. 等待用户释放所有鼠标按键 (防止误触)
    // 必须等待用户松开“开始取色”的点击，否则会立即触发取色
    let start_wait_release = std::time::Instant::now();
    loop {
        if !is_any_mouse_button_pressed() {
            break;
        }
        // 如果超过 10 秒还没松开，可能是异常情况，退出
        if start_wait_release.elapsed() > Duration::from_secs(10) {
            return Err("Mouse button stuck or held too long".to_string());
        }
        thread::sleep(Duration::from_millis(50));
    }

    // 增加一个极短的缓冲期
    thread::sleep(Duration::from_millis(100));

    // 2. 等待用户点击
    let start_time = std::time::Instant::now();
    let timeout = Duration::from_secs(60);

    loop {
        if start_time.elapsed() > timeout {
            return Err("Pick timeout".to_string());
        }

        let mouse: MouseState = device_state.get_mouse();
        let keys = device_state.get_keys();

        // 使用 Windows API 检测鼠标按键 (更可靠)
        let any_mouse_click = is_any_mouse_button_pressed();
        let any_key = keys.contains(&Keycode::Enter) || keys.contains(&Keycode::Space);

        if any_mouse_click || any_key {
            let x = mouse.coords.0;
            let y = mouse.coords.1;

            // 找到鼠标所在的屏幕
            let screens = Screen::all().map_err(|e| e.to_string())?;
            let screen = screens.iter().find(|s| {
                x >= s.display_info.x
                    && x < s.display_info.x + s.display_info.width as i32
                    && y >= s.display_info.y
                    && y < s.display_info.y + s.display_info.height as i32
            });

            if let Some(screen) = screen {
                // 捕获 1x1 像素
                // 注意：capture_area 的坐标是相对于屏幕的
                let relative_x = x - screen.display_info.x;
                let relative_y = y - screen.display_info.y;

                let image = screen
                    .capture_area(relative_x, relative_y, 1, 1)
                    .map_err(|e| e.to_string())?;

                let pixel = image.get_pixel(0, 0);

                let r = pixel[0];
                let g = pixel[1];
                let b = pixel[2];
                return Ok(format!("#{:02X}{:02X}{:02X}", r, g, b));
            }

            // 如果点击了但没获取到颜色（比如在屏幕外？），返回错误以便退出循环
            return Err("Failed to find screen at mouse coordinates".to_string());
        }

        // 缩短轮询间隔，提高响应速度
        thread::sleep(Duration::from_millis(10));
    }
}
