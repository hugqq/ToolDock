use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tooldock_lib::core::http_client::{execute_request, validate_request};
use tooldock_lib::models::http_client::{
    HttpBodyMode, HttpDebugRequest, HttpKeyValue, HttpMethod, HttpMultipartField,
    HttpMultipartFieldKind,
};

fn pair(key: &str, value: &str) -> HttpKeyValue {
    HttpKeyValue {
        id: format!("{key}-{value}"),
        enabled: true,
        key: key.to_string(),
        value: value.to_string(),
    }
}

fn multipart_field(
    id: &str,
    key: &str,
    kind: HttpMultipartFieldKind,
    value: &str,
    file_path: &str,
    file_name: &str,
) -> HttpMultipartField {
    HttpMultipartField {
        id: id.to_string(),
        enabled: true,
        key: key.to_string(),
        kind,
        value: value.to_string(),
        file_path: file_path.to_string(),
        file_name: file_name.to_string(),
    }
}

fn request() -> HttpDebugRequest {
    HttpDebugRequest {
        method: HttpMethod::Post,
        url: "https://example.test/api".to_string(),
        query: vec![],
        headers: vec![],
        body_mode: HttpBodyMode::None,
        body_text: String::new(),
        form_fields: vec![],
        multipart_fields: vec![],
        timeout_ms: 30_000,
    }
}

#[test]
fn validates_scheme_timeout_json_and_content_type() {
    let mut value = request();
    value.url = "file:///tmp/a".to_string();
    assert_eq!(validate_request(&value).unwrap_err().code(), "UNSUPPORTED_SCHEME");

    value = request();
    value.timeout_ms = 999;
    assert_eq!(validate_request(&value).unwrap_err().code(), "TIMEOUT_OUT_OF_RANGE");

    value = request();
    value.body_mode = HttpBodyMode::Json;
    value.body_text = "{".to_string();
    assert_eq!(validate_request(&value).unwrap_err().code(), "INVALID_JSON");

    value.body_text = "{}".to_string();
    value.headers = vec![pair("Content-Type", "text/plain")];
    assert_eq!(validate_request(&value).unwrap_err().code(), "INCOMPATIBLE_CONTENT_TYPE");
}

#[test]
fn accepts_old_serialized_requests_without_multipart_fields() {
    let json = r#"{
        "method":"POST","url":"https://example.test","query":[],"headers":[],
        "bodyMode":"none","bodyText":"","formFields":[],"timeoutMs":30000
    }"#;
    let value: HttpDebugRequest = serde_json::from_str(json).unwrap();
    assert!(value.multipart_fields.is_empty());
}

#[test]
fn validates_multipart_rows_and_managed_content_type() {
    let mut value = request();
    value.body_mode = HttpBodyMode::Multipart;
    value.multipart_fields = vec![multipart_field(
        "missing-key",
        "",
        HttpMultipartFieldKind::Text,
        "hello",
        "",
        "",
    )];
    assert_eq!(
        validate_request(&value).unwrap_err().code(),
        "INVALID_MULTIPART_FIELD"
    );

    value.multipart_fields = vec![multipart_field(
        "missing-file",
        "asset",
        HttpMultipartFieldKind::File,
        "",
        "",
        "",
    )];
    assert_eq!(
        validate_request(&value).unwrap_err().code(),
        "MISSING_MULTIPART_FILE"
    );

    value.multipart_fields.clear();
    value.headers = vec![pair("Content-Type", "multipart/form-data")];
    assert_eq!(
        validate_request(&value).unwrap_err().code(),
        "MULTIPART_CONTENT_TYPE_MANAGED"
    );
}

async fn serve_once(response: Vec<u8>, delay: Duration) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request_bytes = vec![0_u8; 8192];
        let _ = stream.read(&mut request_bytes).await;
        tokio::time::sleep(delay).await;
        stream.write_all(&response).await.unwrap();
        stream.shutdown().await.unwrap();
    });
    format!("http://{address}")
}

#[tokio::test]
async fn executes_request_and_reports_json_response() {
    let response = b"HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}".to_vec();
    let mut value = request();
    value.url = serve_once(response, Duration::ZERO).await;
    value.query = vec![pair("q", "a b")];
    value.headers = vec![pair("X-Test", "yes")];
    value.body_mode = HttpBodyMode::Json;
    value.body_text = r#"{"name":"alice"}"#.to_string();

    let result = execute_request(value).await.unwrap();
    assert_eq!(result.status, 201);
    assert_eq!(result.body_text.as_deref(), Some("{\"ok\":true}"));
    assert_eq!(result.content_type.as_deref(), Some("application/json"));
    assert!(!result.binary);
    assert!(!result.truncated);
}

#[tokio::test]
async fn marks_oversized_response_as_truncated() {
    let body = vec![b'a'; 5 * 1024 * 1024 + 1];
    let mut response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    response.extend_from_slice(&body);
    let mut value = request();
    value.url = serve_once(response, Duration::ZERO).await;

    let result = execute_request(value).await.unwrap();
    assert!(result.truncated);
    assert_eq!(result.body_text.as_ref().unwrap().len(), 5 * 1024 * 1024);
    assert_eq!(result.size_bytes, 5 * 1024 * 1024 + 1);
}

#[tokio::test]
async fn classifies_invalid_utf8_as_binary() {
    let response = b"HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: 2\r\nConnection: close\r\n\r\n\xff\x00".to_vec();
    let mut value = request();
    value.url = serve_once(response, Duration::ZERO).await;

    let result = execute_request(value).await.unwrap();
    assert!(result.binary);
    assert!(result.body_text.is_none());
}

#[tokio::test]
async fn maps_request_timeout_without_fake_http_status() {
    let response = b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec();
    let mut value = request();
    value.url = serve_once(response, Duration::from_millis(1_100)).await;
    value.timeout_ms = 1_000;

    let error = execute_request(value).await.unwrap_err();
    assert_eq!(error.code(), "REQUEST_TIMEOUT");
}

#[tokio::test]
async fn reports_a_file_that_disappears_before_send() {
    let missing = std::env::temp_dir().join(format!(
        "tooldock-missing-upload-{}.bin",
        uuid::Uuid::new_v4()
    ));
    let mut value = request();
    value.body_mode = HttpBodyMode::Multipart;
    value.multipart_fields = vec![multipart_field(
        "missing",
        "asset",
        HttpMultipartFieldKind::File,
        "",
        missing.to_str().unwrap(),
        "missing.bin",
    )];

    let error = execute_request(value).await.unwrap_err();
    assert_eq!(error.code(), "FILE_READ_FAILED");
}
