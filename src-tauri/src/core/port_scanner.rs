use crate::errors::AppResult;
use crate::errors::AppError;
use crate::models::port_scanner::{PortOccupancy, ScanProgress, ScanResult};
use futures_util::stream::{self, StreamExt};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;

pub async fn run_port_scan<F>(
    host: String,
    ports: Vec<u16>,
    timeout_ms: u64,
    concurrency: usize,
    cancel_token: Arc<AtomicBool>,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(ScanProgress),
{
    let total_ports = ports.len();
    let mut scanned_count = 0;

    let mut stream = stream::iter(ports)
        .map(|port| {
            let host = host.clone();
            async move {
                let result = scan_port(&host, port, timeout_ms).await;
                result
            }
        })
        .buffer_unordered(concurrency);

    while let Some(result) = stream.next().await {
        if cancel_token.load(Ordering::SeqCst) {
            break;
        }
        scanned_count += 1;
        on_progress(ScanProgress {
            current_port: result.port,
            total_ports,
            scanned_count,
            result: Some(result),
        });
    }

    Ok(())
}

async fn scan_port(host: &str, port: u16, timeout_ms: u64) -> ScanResult {
    let addr = format!("{}:{}", host, port);
    let service = get_service_name(port).to_string();

    match timeout(Duration::from_millis(timeout_ms), TcpStream::connect(&addr)).await {
        Ok(Ok(_)) => ScanResult {
            port,
            status: "open".to_string(),
            service,
        },
        Ok(Err(_)) => ScanResult {
            port,
            status: "closed".to_string(),
            service,
        },
        Err(_) => ScanResult {
            port,
            status: "timeout".to_string(),
            service,
        },
    }
}

fn get_service_name(port: u16) -> &'static str {
    match port {
        7 => "Echo",
        20 => "FTP-Data",
        21 => "FTP",
        22 => "SSH",
        23 => "Telnet",
        25 => "SMTP",
        53 => "DNS",
        67 => "DHCP-Server",
        68 => "DHCP-Client",
        69 => "TFTP",
        80 => "HTTP",
        88 => "Kerberos",
        110 => "POP3",
        119 => "NNTP",
        123 => "NTP",
        135 => "RPC",
        137 => "NetBIOS-NS",
        138 => "NetBIOS-DGM",
        139 => "NetBIOS-SSN",
        143 => "IMAP",
        161 => "SNMP",
        162 => "SNMP-Trap",
        389 => "LDAP",
        443 => "HTTPS",
        445 => "Microsoft-DS",
        465 => "SMTPS",
        514 => "Syslog",
        515 => "LPD",
        548 => "AFP",
        587 => "SMTP-Submission",
        631 => "IPP",
        636 => "LDAPS",
        873 => "Rsync",
        993 => "IMAPS",
        995 => "POP3S",
        1080 => "Socks",
        1433 => "MSSQL",
        1521 => "Oracle",
        1723 => "PPTP",
        2049 => "NFS",
        2181 => "ZooKeeper",
        3306 => "MySQL",
        3389 => "RDP",
        3690 => "SVN",
        4444 => "Metasploit",
        5000 => "UPnP",
        5432 => "PostgreSQL",
        5672 => "RabbitMQ",
        5900 => "VNC",
        6379 => "Redis",
        7001 => "WebLogic",
        8000 => "HTTP-Alt",
        8080 => "HTTP-Proxy",
        8443 => "HTTPS-Alt",
        8888 => "HTTP-Alt",
        9000 => "SonarQube",
        9092 => "Kafka",
        9200 => "Elasticsearch",
        11211 => "Memcached",
        27017 => "MongoDB",
        _ => "Unknown",
    }
}

pub fn find_port_occupancy(port: u16) -> Result<Vec<PortOccupancy>, AppError> {
    if port == 0 {
        return Err(AppError::Internal("Invalid port".into()));
    }

    #[cfg(target_os = "windows")]
    {
        find_port_occupancy_windows(port)
    }

    #[cfg(target_os = "macos")]
    {
        find_port_occupancy_macos(port)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err(AppError::Internal(
            "Port occupancy lookup is only supported on Windows and macOS".into(),
        ))
    }
}

pub fn kill_port_process(pid: u32) -> Result<(), AppError> {
    if pid == 0 {
        return Err(AppError::Internal("Invalid pid".into()));
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status()
            .map_err(|e| AppError::Internal(format!("Failed to run taskkill: {}", e)))?;

        if status.success() {
            Ok(())
        } else {
            Err(AppError::Internal(format!(
                "Failed to terminate process {}",
                pid
            )))
        }
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status()
            .map_err(|e| AppError::Internal(format!("Failed to run kill: {}", e)))?;

        if status.success() {
            Ok(())
        } else {
            Err(AppError::Internal(format!(
                "Failed to terminate process {}",
                pid
            )))
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err(AppError::Internal(
            "Ending a port process is only supported on Windows and macOS".into(),
        ))
    }
}

#[cfg(target_os = "windows")]
fn find_port_occupancy_windows(port: u16) -> Result<Vec<PortOccupancy>, AppError> {
    let output = Command::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .output()
        .map_err(|e| AppError::Internal(format!("Failed to run netstat: {}", e)))?;

    if !output.status.success() {
        return Err(AppError::Internal("Failed to inspect ports with netstat".into()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();
    for line in stdout.lines() {
        if let Some((protocol, local_address, pid)) = parse_windows_netstat_line(line, port) {
            let process_name = get_windows_process_name(pid);
            entries.push(PortOccupancy {
                protocol,
                local_address,
                port,
                pid,
                process_name,
            });
        }
    }

    Ok(entries)
}

#[cfg(target_os = "macos")]
fn find_port_occupancy_macos(port: u16) -> Result<Vec<PortOccupancy>, AppError> {
    let port_filter = format!("-iTCP:{}", port);
    let output = Command::new("lsof")
        .args(["-nP", &port_filter, "-sTCP:LISTEN"])
        .output()
        .map_err(|e| AppError::Internal(format!("Failed to run lsof: {}", e)))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .skip(1)
        .filter_map(|line| parse_macos_lsof_line(line, port))
        .collect())
}

#[cfg(target_os = "windows")]
fn parse_windows_netstat_line(line: &str, target_port: u16) -> Option<(String, String, u32)> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 5 || !parts[0].eq_ignore_ascii_case("TCP") {
        return None;
    }

    if !parts[3].eq_ignore_ascii_case("LISTENING") {
        return None;
    }

    let local_address = parts[1];
    if extract_port(local_address)? != target_port {
        return None;
    }

    let pid = parts[4].parse().ok()?;
    Some((parts[0].to_string(), local_address.to_string(), pid))
}

#[cfg(target_os = "windows")]
fn get_windows_process_name(pid: u32) -> String {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
        .output();

    let Ok(output) = output else {
        return "Unknown".into();
    };

    if !output.status.success() {
        return "Unknown".into();
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_tasklist_process_name(&stdout).unwrap_or_else(|| "Unknown".into())
}

#[cfg(target_os = "windows")]
fn parse_tasklist_process_name(output: &str) -> Option<String> {
    let line = output.lines().next()?.trim();
    if line.is_empty() || line.contains("INFO:") {
        return None;
    }
    Some(
        line.split(',')
            .next()?
            .trim_matches('"')
            .trim()
            .to_string(),
    )
}

#[cfg(target_os = "macos")]
fn parse_macos_lsof_line(line: &str, target_port: u16) -> Option<PortOccupancy> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 9 {
        return None;
    }

    let pid = parts[1].parse().ok()?;
    let protocol = parts[7].to_string();
    let local_address = parts[8].to_string();
    if extract_port(&local_address)? != target_port {
        return None;
    }

    Some(PortOccupancy {
        protocol,
        local_address,
        port: target_port,
        pid,
        process_name: parts[0].to_string(),
    })
}

fn extract_port(address: &str) -> Option<u16> {
    let port = address.rsplit(':').next()?;
    port.trim_end_matches("->").parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "windows")]
    fn parses_windows_listening_port() {
        let line = "  TCP    127.0.0.1:1543         0.0.0.0:0              LISTENING       1234";
        let parsed = parse_windows_netstat_line(line, 1543);
        assert_eq!(
            parsed,
            Some(("TCP".into(), "127.0.0.1:1543".into(), 1234))
        );
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn ignores_windows_established_port() {
        let line = "  TCP    127.0.0.1:1543         127.0.0.1:9000         ESTABLISHED     1234";
        assert_eq!(parse_windows_netstat_line(line, 1543), None);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn parses_macos_lsof_line() {
        let line = "node    1234 user   23u  IPv4 0xabc      0t0  TCP 127.0.0.1:1543 (LISTEN)";
        let parsed = parse_macos_lsof_line(line, 1543).unwrap();
        assert_eq!(parsed.process_name, "node");
        assert_eq!(parsed.pid, 1234);
        assert_eq!(parsed.local_address, "127.0.0.1:1543");
    }

    #[test]
    fn extracts_ipv4_and_ipv6_ports() {
        assert_eq!(extract_port("127.0.0.1:8080"), Some(8080));
        assert_eq!(extract_port("[::1]:3000"), Some(3000));
        assert_eq!(extract_port("*:5432"), Some(5432));
    }
}
