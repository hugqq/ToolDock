use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tooldock_lib::core::http_client::{
    build_history_projection, execute_request, validate_request,
};
use tooldock_lib::models::http_client::{
    HttpBodyMode, HttpDebugRequest, HttpKeyValue, HttpMethod,
};

fn pair(key: &str, value: &str) -> HttpKeyValue {
    HttpKeyValue {
        id: format!("{key}-{value}"),
        enabled: true,
        key: key.to_string(),
        value: value.to_string(),
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
fn redacts_sensitive_headers_case_insensitively() {
    let mut value = request();
    value.headers = vec![
        pair("authorization", "Bearer secret"),
        pair("X-API-Key", "api-secret"),
        pair("Accept", "application/json"),
    ];

    let safe = build_history_projection(&value);
    assert_eq!(safe.headers[0].value, "<redacted>");
    assert_eq!(safe.headers[1].value, "<redacted>");
    assert_eq!(safe.headers[2].value, "application/json");
}

#[test]
fn redacts_nested_json_and_form_secrets() {
    let mut value = request();
    value.body_mode = HttpBodyMode::Json;
    value.body_text = r#"{"user":"alice","nested":{"access_token":"secret"},"items":[{"password":"pw"}]}"#.to_string();

    let safe = build_history_projection(&value);
    assert!(safe.body_text.contains("alice"));
    assert!(!safe.body_text.contains("secret"));
    assert!(!safe.body_text.contains("pw"));
    assert!(safe.body_text.matches("<redacted>").count() >= 2);

    value.body_mode = HttpBodyMode::Form;
    value.form_fields = vec![pair("username", "alice"), pair("api_key", "secret")];
    let safe = build_history_projection(&value);
    assert_eq!(safe.form_fields[0].value, "alice");
    assert_eq!(safe.form_fields[1].value, "<redacted>");
}

#[test]
fn never_persists_raw_text_body() {
    let mut value = request();
    value.body_mode = HttpBodyMode::Text;
    value.body_text = "unstructured secret".to_string();

    let safe = build_history_projection(&value);
    assert!(safe.body_text.is_empty());
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
