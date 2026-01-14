use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 解析 B站短链接，获取重定向后的真实 URL
#[tauri::command]
pub async fn resolve_bilibili_short_url(url: String) -> Result<String, String> {
    // 检查是否是 b23.tv 短链接
    if !url.contains("b23.tv") {
        return Ok(url);
    }

    // 使用 reqwest 获取重定向后的 URL
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    // 获取重定向的 Location 头
    if let Some(location) = response.headers().get("location") {
        let redirect_url = location
            .to_str()
            .map_err(|e| format!("Failed to parse location header: {}", e))?;
        Ok(redirect_url.to_string())
    } else {
        Err("No redirect location found".to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipWindowConfig {
    pub width: f64,
    pub height: f64,
    pub always_on_top: bool,
    pub auto_pip: bool, // 是否自动开启B站画中画
}

impl Default for PipWindowConfig {
    fn default() -> Self {
        Self {
            width: 1000.0,
            height: 600.0,
            always_on_top: false, // 默认不置顶
            auto_pip: true,       // 默认自动开启画中画
        }
    }
}

/// 获取 cookie 存储路径
fn get_cookie_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app dir: {}", e))?;

    Ok(app_dir.join("bilibili_cookie.txt"))
}

/// 保存 B站 cookie
#[tauri::command]
pub async fn save_bilibili_cookie(app: AppHandle, cookie: String) -> Result<(), String> {
    let cookie_path = get_cookie_path(&app)?;
    fs::write(&cookie_path, cookie).map_err(|e| format!("Failed to save cookie: {}", e))?;
    Ok(())
}

/// 读取 B站 cookie
#[tauri::command]
pub async fn get_bilibili_cookie(app: AppHandle) -> Result<String, String> {
    let cookie_path = get_cookie_path(&app)?;
    if !cookie_path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&cookie_path).map_err(|e| format!("Failed to read cookie: {}", e))
}

/// 检查是否有 cookie
#[tauri::command]
pub async fn has_bilibili_cookie(app: AppHandle) -> Result<bool, String> {
    let cookie_path = get_cookie_path(&app)?;
    Ok(cookie_path.exists())
}

/// 清除 B站 cookie
#[tauri::command]
pub async fn clear_bilibili_cookie(app: AppHandle) -> Result<(), String> {
    let cookie_path = get_cookie_path(&app)?;
    if cookie_path.exists() {
        fs::remove_file(&cookie_path).map_err(|e| format!("Failed to remove cookie: {}", e))?;
    }
    Ok(())
}

/// 打开 B站登录窗口（用于扫码登录）
#[tauri::command]
pub async fn open_bilibili_login_window(app: AppHandle) -> Result<(), String> {
    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window("bilibili-login") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // 创建一个新的 webview 窗口，直接加载 B站首页
    WebviewWindowBuilder::new(
        &app,
        "bilibili-login",
        WebviewUrl::External("https://www.bilibili.com".parse().unwrap()),
    )
    .title("B站登录 - 登录后点击主界面的'保存登录'按钮")
    .inner_size(1000.0, 750.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| format!("Failed to create login window: {}", e))?;

    Ok(())
}

/// 从登录窗口提取 cookie 并保存
#[tauri::command]
pub async fn extract_and_save_cookies(app: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::sync::{Arc, Mutex};
        use tauri::Emitter;
        use webview2_com::{
            pwstr_from_str, GetCookiesCompletedHandler,
            Microsoft::Web::WebView2::Win32::ICoreWebView2_2,
        };
        // 直接使用与 webview2-com-sys 相同版本的 windows_core
        use windows_core::{Interface, PWSTR};

        if let Some(window) = app.get_webview_window("bilibili-login") {
            // 使用 Arc<Mutex<Option<Result>>> 来跨线程传递结果
            let result_holder: Arc<Mutex<Option<Result<String, String>>>> =
                Arc::new(Mutex::new(None));
            let result_clone = result_holder.clone();

            window
                .with_webview(move |webview| {
                    #[cfg(windows)]
                    unsafe {
                        let core_webview = webview.controller().CoreWebView2().unwrap();

                        // 获取 ICoreWebView2_2 接口来访问 cookie manager
                        let webview2: ICoreWebView2_2 = core_webview.cast().unwrap();
                        let cookie_manager = webview2.CookieManager().unwrap();

                        let uri = pwstr_from_str("https://www.bilibili.com");

                        // 创建异步回调处理程序
                        let result_for_handler = result_clone.clone();
                        let handler =
                            GetCookiesCompletedHandler::create(Box::new(move |hr, cookie_list| {
                                let mut cookie_strings = Vec::new();
                                let mut all_cookies_debug = Vec::new();

                                if hr.is_ok() {
                                    if let Some(cookies) = cookie_list {
                                        let mut count = 0u32;
                                        let _ = cookies.Count(&mut count);

                                        for i in 0..count {
                                            // GetValueAtIndex 返回 Result<ICoreWebView2Cookie>
                                            if let Ok(cookie) = cookies.GetValueAtIndex(i) {
                                                let mut name_ptr = PWSTR::null();
                                                let mut value_ptr = PWSTR::null();

                                                if cookie.Name(&mut name_ptr as *mut _).is_ok()
                                                    && cookie
                                                        .Value(&mut value_ptr as *mut _)
                                                        .is_ok()
                                                {
                                                    let name_str =
                                                        name_ptr.to_string().unwrap_or_default();
                                                    let value_str =
                                                        value_ptr.to_string().unwrap_or_default();

                                                    // 调试：记录所有 cookie 名称
                                                    all_cookies_debug.push(name_str.clone());

                                                    // 保存所有非空的 cookie（排除一些无用的）
                                                    if !name_str.is_empty()
                                                        && !value_str.is_empty()
                                                        && !name_str.starts_with("_")
                                                    // 排除临时 cookie
                                                    {
                                                        cookie_strings.push(format!(
                                                            "{}={}",
                                                            name_str, value_str
                                                        ));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                let result = if !cookie_strings.is_empty() {
                                    Ok(cookie_strings.join("; "))
                                } else {
                                    // 返回更详细的错误信息
                                    Err(format!(
                                        "未找到登录 cookie。共发现 {} 个 cookie: {:?}",
                                        all_cookies_debug.len(),
                                        all_cookies_debug
                                    ))
                                };

                                if let Ok(mut guard) = result_for_handler.lock() {
                                    *guard = Some(result);
                                }

                                Ok(())
                            }));

                        // 调用异步 GetCookies
                        let _ = cookie_manager.GetCookies(PWSTR(uri.as_ptr() as _), &handler);
                    }
                })
                .map_err(|e| format!("Webview error: {}", e))?;

            // 等待回调完成（最多等待 5 秒）
            for _ in 0..50 {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                if let Ok(guard) = result_holder.lock() {
                    if guard.is_some() {
                        break;
                    }
                }
            }

            // 获取结果
            let result = result_holder
                .lock()
                .map_err(|_| "Failed to get result".to_string())?
                .take()
                .ok_or_else(|| "Cookie 获取超时，请确保登录窗口已打开".to_string())??;

            // 保存 cookies
            save_bilibili_cookie(app.clone(), result.clone()).await?;

            // 验证保存是否成功
            let saved = get_bilibili_cookie(app.clone()).await?;
            if saved.is_empty() {
                return Err("Cookie 保存失败".to_string());
            }

            // 发送登录成功事件
            let _ = app.emit("bilibili-login-success", ());
            Ok(format!(
                "成功保存 {} 个 cookie: {}",
                result.split(';').count(),
                result
                    .split(';')
                    .map(|s| s.split('=').next().unwrap_or(""))
                    .collect::<Vec<_>>()
                    .join(", ")
            ))
        } else {
            Err("登录窗口未打开".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅支持 Windows".to_string())
    }
}

/// 打开画中画窗口
#[tauri::command]
pub async fn open_pip_window(
    app: AppHandle,
    video_url: String,
    config: Option<PipWindowConfig>,
) -> Result<(), String> {
    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window("pip-player") {
        // 如果已存在，关闭旧窗口
        window.close().map_err(|e| e.to_string())?;
    }

    let config = config.unwrap_or_default();

    // 读取保存的 cookie
    let saved_cookies = get_bilibili_cookie(app.clone()).await.unwrap_or_default();

    // 先注入 cookie，再创建窗口
    #[cfg(target_os = "windows")]
    if !saved_cookies.is_empty() {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_2;
        use windows_core::Interface;

        // 创建临时窗口用于设置 cookie
        let temp_window = WebviewWindowBuilder::new(
            &app,
            "temp-cookie-setter",
            WebviewUrl::External("https://www.bilibili.com".parse().unwrap()),
        )
        .title("设置Cookie...")
        .inner_size(1.0, 1.0)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create temp window: {}", e))?;

        // 等待 webview 初始化
        tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

        let cookies_to_inject = saved_cookies.clone();
        let inject_result = temp_window.with_webview(move |webview| {
            #[cfg(windows)]
            unsafe {
                let core_webview = webview.controller().CoreWebView2().unwrap();
                let webview2: ICoreWebView2_2 = core_webview.cast().unwrap();
                let cookie_manager = webview2.CookieManager().unwrap();
                // 解析并添加每个 cookie
                for cookie_pair in cookies_to_inject.split("; ") {
                    if let Some((name, value)) = cookie_pair.split_once('=') {
                        // 为 bilibili.com 域创建 cookie
                        if let Ok(cookie) = cookie_manager.CreateCookie(
                            &windows_core::HSTRING::from(name.trim()),
                            &windows_core::HSTRING::from(value.trim()),
                            &windows_core::HSTRING::from(".bilibili.com"),
                            &windows_core::HSTRING::from("/"),
                        ) {
                            let _ = cookie.SetIsSecure(false); // 改为 false，因为本地可能是 http
                            let _ = cookie_manager.AddOrUpdateCookie(&cookie);
                        } else {
                        }
                    }
                }
            }
        });

        // 关闭临时窗口
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        let _ = temp_window.close();

        if inject_result.is_err() {
            println!("Cookie 注入出错: {:?}", inject_result);
        }
    }

    // 创建新的画中画窗口
    let webview_window = WebviewWindowBuilder::new(
        &app,
        "pip-player",
        WebviewUrl::External(video_url.parse().unwrap()),
    )
    .title("画中画播放器 - B站")
    .inner_size(config.width, config.height)
    .min_inner_size(0.0, 0.0) // 允许更小的尺寸 - 最小 200x150
    .resizable(true)
    .always_on_top(config.always_on_top)
    .decorations(true)
    .transparent(false)
    .build()
    .map_err(|e| format!("Failed to create PIP window: {}", e))?;

    // 如果配置了自动画中画，等待页面加载后自动点击画中画按钮
    if config.auto_pip {
        tokio::time::sleep(tokio::time::Duration::from_millis(3000)).await;
        let _ = webview_window.eval(
            r#"
            (function() {
                let attemptCount = 0;
                const maxAttempts = 10;
                
                function tryClickPip() {
                    attemptCount++;
                    console.log(`尝试点击画中画按钮 (${attemptCount}/${maxAttempts})...`);
                    
                    // 多种选择器尝试，按优先级排序（基于实际DOM结构）
                    const selectors = [
                        '.bpx-player-ctrl-btn.bpx-player-ctrl-pip[role="button"]',
                        '[aria-label="画中画"][role="button"]',
                        '.bpx-player-ctrl-pip',
                        '[aria-label="画中画"]',
                        'button[title*="画中画"]',
                        '[class*="bpx-player-ctrl-pip"]'
                    ];
                    
                    let pipButton = null;
                    for (const selector of selectors) {
                        pipButton = document.querySelector(selector);
                        if (pipButton) {
                            console.log('找到画中画按钮，使用选择器:', selector);
                            break;
                        }
                    }
                    
                    if (pipButton) {
                        try {
                            // 确保按钮可见且可点击
                            if (pipButton.offsetParent !== null) {
                                pipButton.click();
                                console.log('✅ 画中画按钮已点击');
                                return true;
                            } else {
                                console.log('按钮存在但不可见，继续等待...');
                            }
                        } catch (e) {
                            console.error('点击失败:', e);
                        }
                    } else {
                        console.log('未找到画中画按钮');
                    }
                    
                    // 如果未成功且未达到最大尝试次数，继续重试
                    if (attemptCount < maxAttempts) {
                        setTimeout(tryClickPip, 2000);
                    } else {
                        console.warn('已达到最大尝试次数，放弃点击画中画按钮');
                    }
                    
                    return false;
                }
                
                // 等待页面完全加载
                if (document.readyState === 'complete') {
                    tryClickPip();
                } else {
                    window.addEventListener('load', () => {
                        setTimeout(tryClickPip, 1000);
                    });
                }
            })();
            "#,
        );
    }

    Ok(())
}

/// 关闭画中画窗口
#[tauri::command]
pub async fn close_pip_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pip-player") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
