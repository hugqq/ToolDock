/*
 * @file dns.rs
 * @brief DNS 助手命令接口层
 */

use crate::errors::AppResult;
use crate::core::dns::{self, NetworkInterface};

#[tauri::command]
pub async fn flush_dns() -> AppResult<()> {
    dns::flush_dns()
}

#[tauri::command]
pub async fn get_dns_settings() -> AppResult<Vec<NetworkInterface>> {
    dns::get_dns_settings()
}

#[tauri::command]
pub async fn set_dns(interface_name: String, dns_servers: Vec<String>) -> AppResult<()> {
    dns::set_dns(&interface_name, dns_servers)
}
