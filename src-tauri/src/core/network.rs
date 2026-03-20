use crate::errors::{AppError, AppResult};
use crate::models::PortInfo;
use bytes::Bytes;
use futures_util::stream::FuturesUnordered;
use futures_util::{stream, StreamExt};
use rand::RngCore;
use std::io::{BufRead, BufReader};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use sysinfo::{Pid, ProcessesToUpdate, System};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 执行 Ping 命令并实时返回输出
pub fn run_ping<F>(target: &str, cancel_token: Arc<AtomicBool>, mut on_line: F) -> AppResult<()>
where
    F: FnMut(String),
{
    #[cfg(target_os = "windows")]
    let mut child = {
        let script = format!(
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ping {} -t",
            target
        );
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &script,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?
    };

    #[cfg(not(target_os = "windows"))]
    let mut child = Command::new("ping")
        .arg(target)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Internal("Failed to capture stdout".into()))?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        if cancel_token.load(Ordering::SeqCst) {
            let _ = child.kill();
            break;
        }
        match line {
            Ok(l) => {
                if !l.trim().is_empty() {
                    on_line(l);
                }
            }
            Err(_) => continue,
        }
    }

    let _ = child.wait();
    Ok(())
}

/// 执行 Tracert 命令并实时返回输出
pub fn run_tracert<F>(target: &str, cancel_token: Arc<AtomicBool>, mut on_line: F) -> AppResult<()>
where
    F: FnMut(String),
{
    #[cfg(target_os = "windows")]
    let mut child = {
        let script = format!(
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; tracert -d {}",
            target
        );
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &script,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?
    };

    #[cfg(not(target_os = "windows"))]
    let mut child = Command::new("traceroute")
        .args(["-n", target])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Internal("Failed to capture stdout".into()))?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        if cancel_token.load(Ordering::SeqCst) {
            let _ = child.kill();
            break;
        }
        match line {
            Ok(l) => {
                if !l.trim().is_empty() {
                    on_line(l);
                }
            }
            Err(_) => continue,
        }
    }

    let _ = child.wait();
    Ok(())
}

/// 获取所有进程及其监听端口的信息
pub fn get_listening_ports() -> AppResult<Vec<PortInfo>> {
    // 1. 获取所有进程信息 (PID -> {name, description, path})
    let process_info_map = get_all_processes_info();

    // 2. 获取所有网络连接信息
    #[cfg(target_os = "windows")]
    let output = Command::new("netstat")
        .arg("-ano")
        .creation_flags(CREATE_NO_WINDOW)
        .output()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("lsof")
        .args(["-i", "-P", "-n", "-sTCP:LISTEN"])
        .output()?;

    if !output.status.success() {
        return Err(AppError::Internal(
            "Failed to run network query command".into(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // PID -> Vec<ConnectionInfo>
    let mut pid_to_conns: std::collections::HashMap<
        String,
        Vec<(String, String, String, String, String)>,
    > = std::collections::HashMap::new();

    #[cfg(target_os = "windows")]
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 && (parts[0] == "TCP" || parts[0] == "UDP") {
            let protocol = parts[0].to_string();
            let local_addr = parts[1].to_string();

            let (foreign_addr, state, pid) = if protocol == "TCP" {
                if parts.len() >= 5 {
                    (
                        parts[2].to_string(),
                        parts[3].to_string(),
                        parts[4].to_string(),
                    )
                } else {
                    continue;
                }
            } else {
                // UDP
                (
                    parts[2].to_string(),
                    "N/A".to_string(),
                    if parts.len() > 3 {
                        parts[3].to_string()
                    } else {
                        "0".to_string()
                    },
                )
            };

            // 只记录 LISTENING 或 UDP
            if state == "LISTENING" || protocol == "UDP" {
                let port = local_addr.split(':').last().unwrap_or("").to_string();
                pid_to_conns.entry(pid).or_default().push((
                    port,
                    local_addr,
                    foreign_addr,
                    state,
                    protocol,
                ));
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    for line in stdout.lines().skip(1) {
        // lsof output: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 9 {
            let pid = parts[1].to_string();
            let protocol = if parts[4].contains('6') {
                "TCP6"
            } else {
                "TCP"
            }
            .to_string();
            let name_field = parts[8];
            let local_addr = name_field.to_string();
            let port = name_field.split(':').last().unwrap_or("").to_string();
            let state = if parts.len() > 9 {
                parts[9].trim_matches(|c| c == '(' || c == ')').to_string()
            } else {
                "LISTEN".to_string()
            };
            pid_to_conns.entry(pid).or_default().push((
                port,
                local_addr,
                "".to_string(),
                state,
                protocol,
            ));
        }
    }

    let mut result = Vec::new();
    let mut processed_pids = std::collections::HashSet::new();

    // 3. 组合数据：先处理有端口的进程
    for (pid, conns) in pid_to_conns {
        processed_pids.insert(pid.clone());

        let (name, desc, path) = if pid == "0" {
            (
                "System".to_string(),
                "System Idle Process".to_string(),
                "".to_string(),
            )
        } else if let Some(info) = process_info_map.get(&pid) {
            (info.0.clone(), info.1.clone(), info.2.clone())
        } else {
            ("Unknown".to_string(), "".to_string(), "".to_string())
        };

        for conn in conns {
            result.push(PortInfo {
                pid: pid.clone(),
                process_name: name.clone(),
                description: desc.clone(),
                path: path.clone(),
                port: conn.0,
                local_addr: conn.1,
                foreign_addr: conn.2,
                state: conn.3,
                protocol: conn.4,
            });
        }
    }

    // 4. 添加没有端口的进程 (作为纯进程管理)
    for (pid, info) in process_info_map {
        if !processed_pids.contains(&pid) {
            result.push(PortInfo {
                pid,
                process_name: info.0,
                description: info.1,
                path: info.2,
                port: "".to_string(),
                local_addr: "".to_string(),
                foreign_addr: "".to_string(),
                state: "RUNNING".to_string(),
                protocol: "NONE".to_string(),
            });
        }
    }

    Ok(result)
}

/// 获取所有进程的详细信息 (PID -> (Name, Description, Path))
fn get_all_processes_info() -> std::collections::HashMap<String, (String, String, String)> {
    let mut map = std::collections::HashMap::new();
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    for (pid, process) in sys.processes() {
        let pid_str = pid.to_string();
        let name = process.name().to_string_lossy().to_string();
        let path = process
            .exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // sysinfo 不直接提供 Description，我们暂时使用 Name 作为 Description 以保证速度
        map.insert(pid_str, (name.clone(), name, path));
    }

    map
}

/// 结束指定 PID 的进程
pub fn kill_process(pid: &str) -> AppResult<()> {
    // 0. 禁止结束系统关键进程
    if pid == "0" || pid == "4" {
        return Err(AppError::Internal(
            "Cannot kill system idle or system process".into(),
        ));
    }

    // 1. 尝试使用 sysinfo (内存操作，最快)
    let mut sys = System::new();
    if let Ok(pid_val) = pid.parse::<usize>() {
        let pid_obj = Pid::from(pid_val);
        sys.refresh_processes(ProcessesToUpdate::Some(&[pid_obj]), true);
        if let Some(process) = sys.process(pid_obj) {
            if process.kill() {
                return Ok(());
            }
        }
    }

    // 2. 平台相关的进程终止命令 (备选)
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("taskkill")
            .args(["/F", "/PID", pid])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        match output {
            Ok(out) if out.status.success() => return Ok(()),
            Ok(out) if out.status.code() == Some(128) => return Ok(()),
            _ => {
                let script = format!("Stop-Process -Id {} -Force", pid);
                let ps_output = Command::new("powershell")
                    .args([
                        "-NoProfile",
                        "-NonInteractive",
                        "-NoLogo",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-WindowStyle",
                        "Hidden",
                        "-Command",
                        &script,
                    ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();

                match ps_output {
                    Ok(out) if out.status.success() => return Ok(()),
                    Ok(out) => {
                        let stderr_raw = &out.stderr;
                        let stderr_utf8 = String::from_utf8_lossy(stderr_raw);
                        if stderr_utf8.contains("AccessDenied")
                            || stderr_utf8.contains("拒绝访问")
                            || stderr_raw.windows(2).any(|w| w == [0xbe, 0xdc])
                        {
                            return Err(AppError::Internal("ACCESS_DENIED".into()));
                        }
                        if stderr_utf8.contains("Cannot find a process with the identifier")
                            || stderr_utf8.contains("找不到标识符")
                            || stderr_utf8.contains("找不到具有指定标识符")
                        {
                            return Ok(());
                        }
                        return Err(AppError::Internal(format!(
                            "Failed to kill process {}: {}",
                            pid,
                            stderr_utf8.trim()
                        )));
                    }
                    Err(e) => {
                        return Err(AppError::Internal(format!(
                            "Failed to execute PowerShell: {}",
                            e
                        )))
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("kill").args(["-9", pid]).output();
        match output {
            Ok(out) if out.status.success() => return Ok(()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                if stderr.contains("No such process") {
                    return Ok(());
                } else if stderr.contains("Operation not permitted") {
                    return Err(AppError::Internal("ACCESS_DENIED".into()));
                }
                return Err(AppError::Internal(format!(
                    "Failed to kill process {}: {}",
                    pid,
                    stderr.trim()
                )));
            }
            Err(e) => return Err(AppError::Internal(format!("Failed to execute kill: {}", e))),
        }
    }
}

/// 执行网速测试
pub async fn run_speed_test<F>(
    url: &str,
    cancel_token: Arc<AtomicBool>,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(f64, f64, u64), // (百分比, Mbps, 已下载字节)
{
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to build client: {}", e)))?;

    let res = client
        .get(url)
        .header("Referer", "https://www.baidu.com/")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to send request: {}", e)))?;

    if !res.status().is_success() {
        return Err(AppError::Internal(format!(
            "Server returned error: {}",
            res.status()
        )));
    }

    let total_size = res.content_length().unwrap_or(0);

    let mut downloaded: u64 = 0;
    let start_time = Instant::now();
    let mut last_update = Instant::now();
    let mut last_downloaded: u64 = 0;

    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        if cancel_token.load(Ordering::SeqCst) {
            break;
        }

        let chunk =
            item.map_err(|e: reqwest::Error| AppError::Internal(format!("Stream error: {}", e)))?;
        downloaded += chunk.len() as u64;

        let now = Instant::now();
        let interval = now.duration_since(last_update).as_millis();

        // 每 500ms 计算一次瞬时速度
        if interval >= 500 {
            let elapsed_total = now.duration_since(start_time).as_secs_f64();

            // 瞬时速度计算 (Mbps)
            let delta_bytes = downloaded - last_downloaded;
            let instant_speed_mbps =
                (delta_bytes as f64 * 8.0) / (interval as f64 / 1000.0) / 1_000_000.0;

            let percentage = if total_size > 0 {
                ((downloaded as f64 / total_size as f64) * 100.0).min(99.9)
            } else {
                // 如果没有总大小，根据时间计算伪进度 (10秒为 100%)
                (elapsed_total / 10.0 * 100.0).min(99.9)
            };

            // 预热期 0.5 秒
            if elapsed_total > 0.5 {
                on_progress(percentage, instant_speed_mbps, downloaded);
            } else {
                on_progress(percentage, 0.0, downloaded);
            }

            last_update = now;
            last_downloaded = downloaded;
        }

        // 强制测试 10 秒，或者下载量达到 500MB
        let total_elapsed = now.duration_since(start_time).as_secs_f64();
        if total_elapsed >= 10.0 || downloaded > 500 * 1024 * 1024 {
            break;
        }
    }

    // 计算最终平均速度
    let final_now = Instant::now();
    let final_elapsed = final_now.duration_since(start_time).as_secs_f64();
    let final_speed_mbps = if final_elapsed > 0.1 {
        (downloaded as f64 * 8.0) / final_elapsed / 1_000_000.0
    } else {
        0.0
    };

    on_progress(100.0, final_speed_mbps, downloaded);

    if downloaded == 0 {
        return Err(AppError::Internal(
            "No data downloaded. Please check your network connection or try another node.".into(),
        ));
    }

    Ok(())
}

/// 专业多线程网速测试
pub async fn run_professional_speed_test<F>(
    cancel_token: Arc<AtomicBool>,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(f64, f64, u64), // (百分比, Mbps, 已下载字节)
{
    // 选取更多稳定的国内 Ookla 节点，优先使用大文件
    let nodes = vec![
        "http://4gsuzhou1.speedtest.jsinfo.net:8080/speedtest/random7000x7000.jpg", // 苏州电信 5G
        "http://speedtest.jsqiuying.com:8080/speedtest/random7000x7000.jpg",        // 江苏秋影
        "http://mobile.shunicomtest.com:8080/speedtest/random7000x7000.jpg",        // 上海联通 5G
        "http://speedtest.dukekunshan.edu.cn:8080/speedtest/random7000x7000.jpg",   // 昆山杜克大学
        "http://5gzhenjiang.speedtest.jsinfo.net:8080/speedtest/random7000x7000.jpg", // 镇江电信 5G
        "http://cesu-nb.zjtelecom.com.cn:8080/speedtest/random7000x7000.jpg",       // 宁波电信
        "http://speedtest1.online.sh.cn:8080/speedtest/random7000x7000.jpg",        // 上海电信
        "http://cesu-hz.zjtelecom.com.cn:8080/speedtest/random7000x7000.jpg",       // 杭州电信
    ];

    let client = reqwest::Client::builder()
        .tcp_nodelay(true)
        .tcp_keepalive(std::time::Duration::from_secs(60))
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to build client: {}", e)))?;

    let start_time = Instant::now();
    let total_downloaded = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let futures = FuturesUnordered::new();

    // 增加并发连接数到 32，确保填满千兆带宽
    for (_i, node_url) in nodes.iter().enumerate() {
        for _ in 0..4 {
            let client_clone = client.clone();
            let downloaded_ref = total_downloaded.clone();
            let cancel_ref = cancel_token.clone();
            let url = node_url.to_string();

            futures.push(tokio::spawn(async move {
                loop {
                    if cancel_ref.load(Ordering::SeqCst)
                        || Instant::now().duration_since(start_time).as_secs_f64() > 10.0
                    {
                        break;
                    }

                    let res = match client_clone.get(&url).send().await {
                        Ok(r) if r.status().is_success() => r,
                        _ => {
                            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                            continue;
                        }
                    };

                    let mut stream = res.bytes_stream();
                    while let Some(item) = stream.next().await {
                        if cancel_ref.load(Ordering::SeqCst) {
                            return;
                        }
                        if let Ok(chunk) = item {
                            downloaded_ref.fetch_add(chunk.len() as u64, Ordering::SeqCst);
                        }
                        if Instant::now().duration_since(start_time).as_secs_f64() > 10.0 {
                            return;
                        }
                    }
                }
            }));
        }
    }

    let mut last_update = Instant::now();
    let mut last_downloaded = 0;
    let mut smoothed_speed = 0.0;
    let alpha = 0.5; // 提高响应速度

    // 进度监控循环
    while Instant::now().duration_since(start_time).as_secs_f64() < 10.5 {
        if cancel_token.load(Ordering::SeqCst) {
            break;
        }

        tokio::time::sleep(std::time::Duration::from_millis(200)).await; // 缩短采样间隔

        let now = Instant::now();
        let current_downloaded = total_downloaded.load(Ordering::SeqCst);
        let elapsed_total = now.duration_since(start_time).as_secs_f64();
        let interval = now.duration_since(last_update).as_secs_f64();

        if interval > 0.0 {
            let delta_bytes = current_downloaded - last_downloaded;
            let instant_speed_mbps = (delta_bytes as f64 * 8.0) / interval / 1_000_000.0;

            if smoothed_speed == 0.0 {
                smoothed_speed = instant_speed_mbps;
            } else {
                smoothed_speed = smoothed_speed * (1.0 - alpha) + instant_speed_mbps * alpha;
            }

            let percentage = (elapsed_total / 10.0 * 100.0).min(99.9);

            if elapsed_total > 0.5 {
                on_progress(percentage, smoothed_speed, current_downloaded);
            } else {
                on_progress(percentage, instant_speed_mbps, current_downloaded);
            }
        }

        last_update = now;
        last_downloaded = current_downloaded;

        if elapsed_total >= 10.0 {
            break;
        }
    }

    // 最终计算
    let final_downloaded = total_downloaded.load(Ordering::SeqCst);
    let final_elapsed = Instant::now().duration_since(start_time).as_secs_f64();
    let avg_speed_mbps = (final_downloaded as f64 * 8.0) / final_elapsed / 1_000_000.0;

    on_progress(100.0, avg_speed_mbps, final_downloaded);

    Ok(())
}

/// 专业多线程上行网速测试
pub async fn run_upload_speed_test<F>(
    cancel_token: Arc<AtomicBool>,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(f64, f64, u64), // (百分比, Mbps, 已上传字节)
{
    // 选取支持 POST 上传测试的国内节点
    let nodes = vec![
        "http://4gsuzhou1.speedtest.jsinfo.net:8080/speedtest/upload.php", // 苏州电信 5G
        "http://speedtest.jsqiuying.com:8080/speedtest/upload.php",        // 江苏秋影
        "http://mobile.shunicomtest.com:8080/speedtest/upload.php",        // 上海联通 5G
        "http://5gzhenjiang.speedtest.jsinfo.net:8080/speedtest/upload.php", // 镇江电信 5G
        "http://cesu-nb.zjtelecom.com.cn:8080/speedtest/upload.php",       // 宁波电信
        "http://speedtest1.online.sh.cn:8080/speedtest/upload.php",        // 上海电信
        "http://cesu-hz.zjtelecom.com.cn:8080/speedtest/upload.php",       // 杭州电信
    ];

    let client = reqwest::Client::builder()
        .tcp_nodelay(true)
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to build client: {}", e)))?;

    let start_time = Instant::now();
    let total_uploaded = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let futures = FuturesUnordered::new();

    // 准备 64KB 的随机数据块用于上传，避免被网络设备压缩，且减小单次 poll 的计数偏差
    let mut data = vec![0u8; 64 * 1024];
    rand::rng().fill_bytes(&mut data);
    let data_chunk = Bytes::from(data);

    // 开启并发上传连接，减少并发数到 8，避免过大的缓冲区导致测速虚高
    for (_i, node_url) in nodes.iter().enumerate() {
        if _i >= 8 {
            break;
        } // 最多使用 8 个节点

        let client_clone = client.clone();
        let uploaded_ref = total_uploaded.clone();
        let cancel_ref = cancel_token.clone();
        let url = node_url.to_string();
        let data = data_chunk.clone();

        futures.push(tokio::spawn(async move {
            loop {
                if cancel_ref.load(Ordering::SeqCst)
                    || Instant::now().duration_since(start_time).as_secs_f64() > 10.0
                {
                    break;
                }

                let uploaded_ref_inner = uploaded_ref.clone();
                let data_inner = data.clone();

                // 每次请求上传约 10MB 数据 (160 * 64KB)
                let stream = stream::iter(0..160).map(move |_| {
                    let chunk = data_inner.clone();
                    // 只有在流被消费时才增加计数
                    uploaded_ref_inner.fetch_add(chunk.len() as u64, Ordering::SeqCst);
                    Ok::<_, std::io::Error>(chunk)
                });

                let res = client_clone
                    .post(&url)
                    .header("Content-Type", "application/octet-stream")
                    // 显式设置 Content-Length 避免 reqwest 缓冲整个流来计算长度
                    .header("Content-Length", (160 * 64 * 1024).to_string())
                    .body(reqwest::Body::wrap_stream(stream))
                    .send()
                    .await;

                if let Ok(r) = res {
                    if !r.status().is_success() {
                        // 如果服务器返回错误，可能并没有真正接收数据，这里简单处理：稍微等待
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    }
                } else {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }));
    }

    let mut last_update = Instant::now();
    let mut last_uploaded = 0;
    let mut smoothed_speed = 0.0;
    let alpha = 0.5;

    while Instant::now().duration_since(start_time).as_secs_f64() < 10.5 {
        if cancel_token.load(Ordering::SeqCst) {
            break;
        }

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        let now = Instant::now();
        let current_uploaded = total_uploaded.load(Ordering::SeqCst);
        let elapsed_total = now.duration_since(start_time).as_secs_f64();
        let interval = now.duration_since(last_update).as_secs_f64();

        if interval > 0.0 {
            let delta_bytes = current_uploaded - last_uploaded;
            let instant_speed_mbps = (delta_bytes as f64 * 8.0) / interval / 1_000_000.0;

            if smoothed_speed == 0.0 {
                smoothed_speed = instant_speed_mbps;
            } else {
                smoothed_speed = smoothed_speed * (1.0 - alpha) + instant_speed_mbps * alpha;
            }

            let percentage = (elapsed_total / 10.0 * 100.0).min(99.9);

            if elapsed_total > 0.5 {
                on_progress(percentage, smoothed_speed, current_uploaded);
            } else {
                on_progress(percentage, instant_speed_mbps, current_uploaded);
            }
        }

        last_update = now;
        last_uploaded = current_uploaded;

        if elapsed_total >= 10.0 {
            break;
        }
    }

    let final_uploaded = total_uploaded.load(Ordering::SeqCst);
    let final_elapsed = Instant::now().duration_since(start_time).as_secs_f64();
    let avg_speed_mbps = (final_uploaded as f64 * 8.0) / final_elapsed / 1_000_000.0;

    on_progress(100.0, avg_speed_mbps, final_uploaded);

    Ok(())
}
