/*
 * @file dns.rs
 * @brief DNS 刷新与切换核心逻辑
 */

use crate::errors::{AppError, AppResult};
use serde::Serialize;
use std::os::windows::process::CommandExt;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct NetworkInterface {
    pub name: String,
    pub dns_servers: Vec<String>,
    pub is_dhcp: bool,
}

/// 刷新 DNS 缓存
pub fn flush_dns() -> AppResult<()> {
    let output = Command::new("ipconfig")
        .arg("/flushdns")
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::Internal("Failed to flush DNS cache".into()))
    }
}

/// 获取所有网络接口及其 DNS 设置
pub fn get_dns_settings() -> AppResult<Vec<NetworkInterface>> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-NoLogo",
            "-ExecutionPolicy", "Bypass",
            "-WindowStyle", "Hidden",
            "-Command",
            "Get-NetIPConfiguration | Select-Object InterfaceAlias, DNSServer, IPv4DefaultGateway | ForEach-Object { [PSCustomObject]@{ Name = $_.InterfaceAlias; DNS = ($_.DNSServer.ServerAddresses -join ','); HasGateway = if ($_.IPv4DefaultGateway) { $true } else { $false } } } | ConvertTo-Json"
        ])
        .creation_flags(0x08000000 | 0x00000200)
        .output()?;

    if !output.status.success() {
        return Err(AppError::Internal("Failed to get DNS settings".into()));
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    if json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    let v: serde_json::Value = serde_json::from_str(&json_str)?;
    let mut interfaces = Vec::new();

    let items = if v.is_array() {
        v.as_array().unwrap().clone()
    } else {
        vec![v]
    };

    for item in items {
        let name = item["Name"].as_str().unwrap_or_default().to_string();
        let dns_str = item["DNS"].as_str().unwrap_or_default();
        let has_gateway = item["HasGateway"].as_bool().unwrap_or(false);

        // 只关注有网关的活跃接口
        if !name.is_empty() && has_gateway {
            let dns_servers = if dns_str.is_empty() {
                vec![]
            } else {
                dns_str.split(',').map(|s| s.trim().to_string()).collect()
            };

            interfaces.push(NetworkInterface {
                name,
                dns_servers,
                is_dhcp: true, // 简化处理，通常通过 netsh 检查更准确，但这里主要用于显示
            });
        }
    }

    Ok(interfaces)
}

/// 设置 DNS
pub fn set_dns(interface_name: &str, dns_servers: Vec<String>) -> AppResult<()> {
    if dns_servers.is_empty() {
        // 设置为 DHCP
        let output = Command::new("netsh")
            .args(["interface", "ip", "set", "dns", interface_name, "dhcp"])
            .creation_flags(0x08000000)
            .output()?;

        if !output.status.success() {
            return Err(AppError::Internal(format!(
                "Failed to set DHCP for {}",
                interface_name
            )));
        }
    } else {
        // 设置静态 DNS
        for (i, dns) in dns_servers.iter().enumerate() {
            let args = if i == 0 {
                vec![
                    "interface",
                    "ip",
                    "set",
                    "dns",
                    interface_name,
                    "static",
                    dns,
                    "primary",
                ]
            } else {
                vec![
                    "interface",
                    "ip",
                    "add",
                    "dns",
                    interface_name,
                    dns,
                    "index=2",
                ]
            };

            let output = Command::new("netsh")
                .args(&args)
                .creation_flags(0x08000000)
                .output()?;

            if !output.status.success() {
                return Err(AppError::Internal(format!(
                    "Failed to set DNS {} for {}",
                    dns, interface_name
                )));
            }
        }
    }

    Ok(())
}
