use crate::errors::AppResult;
use crate::models::port_scanner::{ScanProgress, ScanResult};
use futures_util::stream::{self, StreamExt};
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
