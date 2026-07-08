pub mod commands;
pub mod core;
pub mod errors;
pub mod models;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

pub struct AppState {
    pub cancel_scan: AtomicBool,
    pub network_tasks: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub port_scanner_tasks: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

use commands::ai::{ask_ai, ask_ai_stream, ask_nginx_ai};
use commands::clicker::{
    get_clicker_hotkey_enabled, is_keyboard_clicker_running, is_mouse_clicker_running,
    send_text_input, set_clicker_hotkey_enabled, start_keyboard_clicker, start_mouse_clicker,
    stop_keyboard_clicker, stop_mouse_clicker,
};
use commands::clipboard::{
    clear_clipboard_history, copy_clipboard_item, delete_clipboard_item, get_clipboard_history,
    is_clipboard_enabled, set_clipboard_config, set_clipboard_enabled,
};
use commands::color::{get_mouse_pixel_color, pick_screen_color};
use commands::cron::{generate_cron_with_ai, get_cron_next_runs};
use commands::diff::diff_text;
use commands::dns::{flush_dns, get_dns_settings, set_dns};

use commands::file::{
    check_pkg_managers, delete_item, delete_node_modules, install_nvm_version, list_nvm_versions,
    pkg_install, pnpm_install, scan_folder_size, scan_node_modules, stop_scan,
    uninstall_nvm_version, use_nvm_version,
};
use commands::hash::find_duplicate_files;
use commands::hotkey::{register_global_hotkey, unregister_global_hotkey};
use commands::image_convert::convert_images;
use commands::ip_lookup::{
    batch_query_ips, check_ip_is_private, get_ip_special_info, parse_ip_range, query_ip_info,
    validate_ip_address,
};
use commands::network::{start_network_task, stop_network_task};
use commands::nginx::{
    create_nginx_backup, delete_nginx_backup, is_nginx_running, list_nginx_backups,
    read_nginx_config, restore_nginx_backup, scan_nginx_configs, start_nginx, stop_nginx,
    test_nginx_config, write_nginx_config,
};
use commands::notepad::{load_notepad_data, save_notepad_data, save_notepad_image, NotepadDbState};
use commands::ocr::{run_ocr, run_ocr_detailed};
use commands::port_scanner::{start_port_scan, stop_port_scan};
use commands::renamer::{
    clear_rename_history, execute_batch_rename, get_rename_history, preview_batch_rename,
    revert_batch_rename, revert_single_rename,
};
use commands::reveal_in_explorer;
use commands::settings::{
    check_latest_release, export_config, get_developer_logs, get_global_shortcut,
    get_silent_start, import_config, is_auto_start_enabled, is_run_as_admin, set_auto_start,
    set_developer_log_level, set_global_shortcut, set_run_as_admin, set_silent_start,
    test_ai_connection,
};
use commands::timestamp::{
    batch_convert_timestamps, convert_timestamp, get_current_datetime, get_current_timestamp,
};
use commands::translator::{check_translator_key, translate_text};
use commands::unit_converter::{convert_units, get_exchange_rates};
use commands::variable_naming::generate_variable_names;
use commands::web_server::{get_web_server_status, start_web_server, stop_web_server};
use core::clicker::ClickerManager;
use core::clipboard::{start_listening, ClipboardManager};
use core::hotkey::HotkeyManager;
use core::web_server::{SharedWebServerState, WebServerState};

pub struct AppSettings {
    pub close_behavior: Mutex<String>,
}

#[tauri::command]
fn get_close_behavior(state: tauri::State<AppSettings>) -> String {
    state.close_behavior.lock().unwrap().clone()
}

#[tauri::command]
fn set_close_behavior(state: tauri::State<AppSettings>, behavior: String) {
    *state.close_behavior.lock().unwrap() = behavior;
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("data"));
            crate::core::logging::init_logging(data_dir.join("logs"));

            let manager = Arc::new(ClipboardManager::new(app.handle()));
            app.manage(manager.clone());
            start_listening(app.handle().clone(), manager);

            let clicker_manager = ClickerManager::new(app.handle().clone());
            app.manage(clicker_manager);

            let web_server_state: SharedWebServerState =
                Arc::new(tokio::sync::RwLock::new(WebServerState::new()));
            app.manage(web_server_state);

            // 初始化全局快捷键管理器
            let hotkey_manager = HotkeyManager::new(app.handle().clone());
            app.manage(hotkey_manager.clone());

            // 从注册表加载并注册快捷键
            if let Ok(shortcut) = crate::core::settings::load_global_shortcut() {
                if !shortcut.is_empty() {
                    let _ = hotkey_manager.register(&shortcut);
                }
            }

            // System Tray setup
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show ToolDock", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _ = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;

            // 窗口默认 visible:false，根据启动方式决定是否显示
            let is_autostart = std::env::args().any(|arg| arg == "--autostart");
            if let Some(window) = app.get_webview_window("main") {
                if is_autostart {
                    let data_dir = app
                        .path()
                        .app_data_dir()
                        .unwrap_or_else(|_| std::path::PathBuf::from("data"));
                    let silent = crate::core::settings::load_silent_start(&data_dir);
                    if !silent {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .manage(AppState {
            cancel_scan: AtomicBool::new(false),
            network_tasks: Mutex::new(HashMap::new()),
            port_scanner_tasks: Mutex::new(HashMap::new()),
        })
        .manage(AppSettings {
            close_behavior: Mutex::new("minimize".to_string()),
        })
        .manage(NotepadDbState(Mutex::new(None)))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let app_handle = window.app_handle();
                    let state = app_handle.state::<AppSettings>();
                    let behavior = state.close_behavior.lock().unwrap();

                    if *behavior == "minimize" {
                        // 隐藏主窗口而不是退出程序
                        window.hide().unwrap();
                        // 阻止默认的关闭行为
                        api.prevent_close();
                    }
                    // 如果是 "exit" (或其它值)，则执行默认关闭行为（退出程序）
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_close_behavior,
            set_close_behavior,
            scan_folder_size,
            stop_scan,
            delete_item,
            diff_text,
            scan_node_modules,
            delete_node_modules,
            list_nvm_versions,
            use_nvm_version,
            install_nvm_version,
            uninstall_nvm_version,
            pnpm_install,
            check_pkg_managers,
            pkg_install,
            pick_screen_color,
            get_mouse_pixel_color,
            start_network_task,
            stop_network_task,
            flush_dns,
            get_dns_settings,
            set_dns,
            get_clipboard_history,
            set_clipboard_enabled,
            is_clipboard_enabled,
            set_clipboard_config,
            delete_clipboard_item,
            clear_clipboard_history,
            copy_clipboard_item,
            translate_text,
            check_translator_key,
            generate_variable_names,
            find_duplicate_files,
            preview_batch_rename,
            execute_batch_rename,
            get_rename_history,
            revert_single_rename,
            revert_batch_rename,
            clear_rename_history,
            read_nginx_config,
            write_nginx_config,
            test_nginx_config,
            create_nginx_backup,
            restore_nginx_backup,
            list_nginx_backups,
            delete_nginx_backup,
            start_nginx,
            stop_nginx,
            is_nginx_running,
            scan_nginx_configs,
            convert_units,
            get_exchange_rates,
            get_cron_next_runs,
            generate_cron_with_ai,
            ask_ai,
            ask_ai_stream,
            ask_nginx_ai,
            run_ocr,
            run_ocr_detailed,
            export_config,
            import_config,
            set_run_as_admin,
            is_run_as_admin,
            set_auto_start,
            is_auto_start_enabled,
            set_developer_log_level,
            get_developer_logs,
            test_ai_connection,
            get_global_shortcut,
            set_global_shortcut,
            set_silent_start,
            get_silent_start,
            check_latest_release,
            reveal_in_explorer,
            convert_images,
            convert_timestamp,
            get_current_timestamp,
            get_current_datetime,
            batch_convert_timestamps,
            validate_ip_address,
            check_ip_is_private,
            get_ip_special_info,
            query_ip_info,
            batch_query_ips,
            parse_ip_range,
            start_mouse_clicker,
            stop_mouse_clicker,
            is_mouse_clicker_running,
            start_keyboard_clicker,
            stop_keyboard_clicker,
            is_keyboard_clicker_running,
            send_text_input,
            set_clicker_hotkey_enabled,
            get_clicker_hotkey_enabled,
            start_web_server,
            stop_web_server,
            get_web_server_status,
            start_port_scan,
            stop_port_scan,
            register_global_hotkey,
            load_notepad_data,
            save_notepad_data,
            save_notepad_image,
            unregister_global_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
