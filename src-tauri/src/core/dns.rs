/*
 * @file dns.rs
 * @brief DNS 刷新与切换核心逻辑
 */

use crate::errors::{AppError, AppResult};
use serde::Serialize;
#[cfg(target_os = "windows")]
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
    #[cfg(target_os = "windows")]
    {
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
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("dscacheutil").arg("-flushcache").output()?;
        let _ = Command::new("sudo")
            .args(["killall", "-HUP", "mDNSResponder"])
            .output();
        if output.status.success() {
            Ok(())
        } else {
            Err(AppError::Internal("Failed to flush DNS cache".into()))
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err(AppError::Internal(
            "DNS flush not supported on this platform".into(),
        ))
    }
}

/// 获取所有网络接口及其 DNS 设置
#[cfg(target_os = "windows")]
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
#[cfg(target_os = "windows")]
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

#[cfg(not(target_os = "windows"))]
pub fn get_dns_settings() -> AppResult<Vec<NetworkInterface>> {
    // macOS: use scutil --dns or networksetup -getdnsservers
    let output = Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output()?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let services = String::from_utf8_lossy(&output.stdout);
    let mut interfaces = Vec::new();

    for service in services.lines().skip(1) {
        let service = service.trim();
        if service.is_empty() || service.starts_with('*') {
            continue;
        }
        let dns_output = Command::new("networksetup")
            .args(["-getdnsservers", service])
            .output()?;
        let dns_str = String::from_utf8_lossy(&dns_output.stdout);
        let dns_servers: Vec<String> = if dns_str.contains("There aren't any DNS Servers") {
            vec![]
        } else {
            dns_str
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        };
        interfaces.push(NetworkInterface {
            name: service.to_string(),
            dns_servers,
            is_dhcp: true,
        });
    }

    Ok(interfaces)
}

#[cfg(not(target_os = "windows"))]
pub fn set_dns(interface_name: &str, dns_servers: Vec<String>) -> AppResult<()> {
    if dns_servers.is_empty() {
        let output = Command::new("networksetup")
            .args(["-setdnsservers", interface_name, "Empty"])
            .output()?;
        if !output.status.success() {
            return Err(AppError::Internal(format!(
                "Failed to clear DNS for {}",
                interface_name
            )));
        }
    } else {
        let mut args = vec!["-setdnsservers".to_string(), interface_name.to_string()];
        args.extend(dns_servers);
        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let output = Command::new("networksetup").args(&args_refs).output()?;
        if !output.status.success() {
            return Err(AppError::Internal(format!(
                "Failed to set DNS for {}",
                interface_name
            )));
        }
    }
    Ok(())
}
