use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

pub struct WebServerState {
    pub root_dir: PathBuf,
    pub port: u16,
    pub is_running: bool,
    pub task_handle: Option<JoinHandle<()>>,
}

impl WebServerState {
    pub fn new() -> Self {
        Self {
            root_dir: PathBuf::new(),
            port: 8080,
            is_running: false,
            task_handle: None,
        }
    }
}

pub type SharedWebServerState = Arc<RwLock<WebServerState>>;

#[derive(Debug)]
pub enum WebServerError {
    FolderNotFound,
    InvalidPort,
    PortInUse,
    AccessDenied,
    AlreadyRunning,
    NotRunning,
    IoError(String),
}

impl std::fmt::Display for WebServerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebServerError::FolderNotFound => write!(f, "Folder not found"),
            WebServerError::InvalidPort => write!(f, "Invalid port"),
            WebServerError::PortInUse => write!(f, "Port is already in use"),
            WebServerError::AccessDenied => write!(f, "Access denied"),
            WebServerError::AlreadyRunning => write!(f, "Server is already running"),
            WebServerError::NotRunning => write!(f, "Server is not running"),
            WebServerError::IoError(msg) => write!(f, "IO Error: {}", msg),
        }
    }
}

impl std::error::Error for WebServerError {}

pub async fn start_server(
    state: SharedWebServerState,
    root_dir: PathBuf,
    port: u16,
) -> Result<String, WebServerError> {
    // 参数校验
    if port < 1024 {
        return Err(WebServerError::InvalidPort);
    }

    if !root_dir.exists() {
        return Err(WebServerError::FolderNotFound);
    }

    if !root_dir.is_dir() {
        return Err(WebServerError::FolderNotFound);
    }

    // 检查是否已经在运行
    {
        let current_state = state.read().await;
        if current_state.is_running {
            return Err(WebServerError::AlreadyRunning);
        }
    }

    // 尝试绑定端口
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)), port);
    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                WebServerError::PortInUse
            } else if e.kind() == std::io::ErrorKind::PermissionDenied {
                WebServerError::AccessDenied
            } else {
                WebServerError::IoError(e.to_string())
            }
        })?;

    // 获取本地 IP 地址
    let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    let server_url = format!("http://{}:{}", local_ip, port);

    // 启动服务器任务
    let server_root = root_dir.clone();
    let server_state = state.clone();
    
    let task_handle = tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((mut socket, addr)) => {
                    let root = server_root.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_client(&mut socket, &root).await {
                            eprintln!("Error handling client {}: {}", addr, e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Error accepting connection: {}", e);
                    break;
                }
            }

            // 检查是否需要停止
            let should_stop = {
                let state = server_state.read().await;
                !state.is_running
            };
            
            if should_stop {
                break;
            }
        }
    });

    // 更新状态
    {
        let mut current_state = state.write().await;
        current_state.root_dir = root_dir;
        current_state.port = port;
        current_state.is_running = true;
        current_state.task_handle = Some(task_handle);
    }

    Ok(server_url)
}

pub async fn stop_server(state: SharedWebServerState) -> Result<(), WebServerError> {
    let mut current_state = state.write().await;
    
    if !current_state.is_running {
        return Err(WebServerError::NotRunning);
    }

    current_state.is_running = false;

    // 终止任务
    if let Some(handle) = current_state.task_handle.take() {
        handle.abort();
    }

    Ok(())
}

pub async fn get_server_status(state: SharedWebServerState) -> (bool, u16, String) {
    let current_state = state.read().await;
    let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    (
        current_state.is_running,
        current_state.port,
        local_ip,
    )
}

async fn handle_client(socket: &mut tokio::net::TcpStream, root_dir: &Path) -> std::io::Result<()> {
    let mut buffer = vec![0u8; 4096];
    let n = socket.read(&mut buffer).await?;
    
    if n == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buffer[..n]);
    let lines: Vec<&str> = request.lines().collect();
    
    if lines.is_empty() {
        return Ok(());
    }

    let request_line = lines[0];
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    
    if parts.len() < 2 {
        return Ok(());
    }

    let method = parts[0];
    let path = parts[1];

    if method != "GET" {
        send_response(socket, 405, "Method Not Allowed", "text/plain", b"405 Method Not Allowed").await?;
        return Ok(());
    }

    // 解码 URL 路径
    let decoded_path = urlencoding::decode(path).unwrap_or_else(|_| path.into());
    let requested_path = decoded_path.trim_start_matches('/');
    
    let file_path = root_dir.join(requested_path);

    // 安全检查：确保请求的文件在 root_dir 内
    let canonical_root = root_dir.canonicalize().unwrap_or_else(|_| root_dir.to_path_buf());
    
    // 检查文件是否存在
    if !file_path.exists() {
        send_response(socket, 404, "Not Found", "text/plain", b"404 Not Found").await?;
        return Ok(());
    }
    
    let canonical_file = match file_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            send_response(socket, 404, "Not Found", "text/plain", b"404 Not Found").await?;
            return Ok(());
        }
    };

    if !canonical_file.starts_with(&canonical_root) {
        send_response(socket, 403, "Forbidden", "text/plain", b"403 Forbidden").await?;
        return Ok(());
    }

    // 如果是目录，尝试查找 index.html 或显示目录列表
    if canonical_file.is_dir() {
        let index_path = canonical_file.join("index.html");
        if index_path.exists() {
            serve_file(socket, &index_path).await?;
        } else {
            serve_directory_listing(socket, &canonical_file, requested_path).await?;
        }
    } else if canonical_file.exists() {
        serve_file(socket, &canonical_file).await?;
    } else {
        send_response(socket, 404, "Not Found", "text/plain", b"404 Not Found").await?;
    }

    Ok(())
}

async fn serve_file(socket: &mut tokio::net::TcpStream, file_path: &Path) -> std::io::Result<()> {
    let content = tokio::fs::read(file_path).await?;
    let mime_type = get_mime_type(file_path);
    send_response(socket, 200, "OK", &mime_type, &content).await
}

async fn serve_directory_listing(
    socket: &mut tokio::net::TcpStream,
    dir_path: &Path,
    requested_path: &str,
) -> std::io::Result<()> {
    let mut entries = tokio::fs::read_dir(dir_path).await?;
    let mut html = String::from(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Index of /"#,
    );
    html.push_str(requested_path);
    html.push_str(r#"</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        ul { list-style: none; padding: 0; }
        li { margin: 5px 0; }
        a { text-decoration: none; color: #0066cc; }
        a:hover { text-decoration: underline; }
        .dir::before { content: "📁 "; }
        .file::before { content: "📄 "; }
    </style>
</head>
<body>
    <h1>Index of /"#);
    html.push_str(requested_path);
    html.push_str("</h1><ul>");

    // 添加返回上级目录
    if !requested_path.is_empty() {
        let parent_path = if requested_path.contains('/') {
            let parts: Vec<&str> = requested_path.rsplitn(2, '/').collect();
            parts.get(1).unwrap_or(&"").to_string()
        } else {
            String::new()
        };
        html.push_str(&format!(
            r#"<li class="dir"><a href="/{}">..</a></li>"#,
            parent_path
        ));
    }

    let mut items = Vec::new();
    while let Some(entry) = entries.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().to_string();
        let metadata = entry.metadata().await?;
        let is_dir = metadata.is_dir();
        let link_path = if requested_path.is_empty() {
            format!("/{}", file_name)
        } else {
            format!("/{}/{}", requested_path, file_name)
        };
        items.push((file_name, link_path, is_dir));
    }

    // 排序：目录在前，然后按名称排序
    items.sort_by(|a, b| {
        if a.2 == b.2 {
            a.0.cmp(&b.0)
        } else if a.2 {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    for (name, link, is_dir) in items {
        let class = if is_dir { "dir" } else { "file" };
        html.push_str(&format!(
            r#"<li class="{}"><a href="{}">{}</a></li>"#,
            class, link, name
        ));
    }

    html.push_str("</ul></body></html>");
    send_response(socket, 200, "OK", "text/html; charset=utf-8", html.as_bytes()).await
}

async fn send_response(
    socket: &mut tokio::net::TcpStream,
    status_code: u16,
    status_text: &str,
    content_type: &str,
    body: &[u8],
) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\n\r\n",
        status_code,
        status_text,
        content_type,
        body.len()
    );
    socket.write_all(response.as_bytes()).await?;
    socket.write_all(body).await?;
    socket.flush().await?;
    Ok(())
}

fn get_mime_type(path: &Path) -> String {
    let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("");
    
    match extension {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css",
        "js" => "application/javascript",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "txt" => "text/plain; charset=utf-8",
        "pdf" => "application/pdf",
        "woff" | "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn get_local_ip() -> Option<String> {
    use std::net::UdpSocket;
    
    // 通过连接外部地址来获取本地 IP（不实际发送数据）
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
}
