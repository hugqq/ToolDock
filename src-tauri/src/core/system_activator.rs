/*
 * 系统激活核心逻辑
 * 负责启动 PowerShell 进程并管理其输入输出
 */

use crate::errors::AppResult;
use std::os::windows::process::CommandExt;
use std::process::{Child, Command};

/// 启动系统激活进程，弹出一个新的控制台窗口
pub fn spawn_activation_process() -> AppResult<Child> {
    // CREATE_NEW_CONSOLE 标志用于在 Windows 上启动一个新的控制台窗口
    const CREATE_NEW_CONSOLE: u32 = 0x00000010;

    let child = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "irm https://get.activated.win | iex",
        ])
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()?;

    Ok(child)
}
