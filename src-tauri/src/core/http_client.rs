use crate::models::http_client::{
    HttpBodyMode, HttpDebugRequest, HttpDebugResponse, HttpKeyValue, HttpMethod,
    HttpResponseHeader,
};
use futures_util::StreamExt;
use reqwest::header::{HeaderName, HeaderValue, CONTENT_TYPE};
use serde_json::Value;
use std::time::{Duration, Instant};
use thiserror::Error;

const REDACTED: &str = "<redacted>";
const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 120_000;
const MAX_RESPONSE_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum HttpClientError {
    #[error("The request URL is invalid")]
    InvalidUrl,
    #[error("Only HTTP and HTTPS URLs are supported")]
    UnsupportedScheme,
    #[error("Timeout must be between 1 and 120 seconds")]
    TimeoutOutOfRange,
    #[error("The JSON body is invalid")]
    InvalidJson,
    #[error("Content-Type is incompatible with the selected body mode")]
    IncompatibleContentType,
    #[error("Invalid request header: {0}")]
    InvalidHeader(String),
    #[error("Unable to create the HTTP client: {0}")]
    ClientBuild(String),
    #[error("The request timed out")]
    RequestTimeout,
    #[error("Unable to connect to the server: {0}")]
    Connection(String),
    #[error("TLS verification failed: {0}")]
    Tls(String),
    #[error("Too many redirects or invalid redirect: {0}")]
    Redirect(String),
    #[error("HTTP request failed: {0}")]
    Request(String),
}

impl HttpClientError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidUrl => "INVALID_URL",
            Self::UnsupportedScheme => "UNSUPPORTED_SCHEME",
            Self::TimeoutOutOfRange => "TIMEOUT_OUT_OF_RANGE",
            Self::InvalidJson => "INVALID_JSON",
            Self::IncompatibleContentType => "INCOMPATIBLE_CONTENT_TYPE",
            Self::InvalidHeader(_) => "INVALID_HEADER",
            Self::ClientBuild(_) => "CLIENT_BUILD_FAILED",
            Self::RequestTimeout => "REQUEST_TIMEOUT",
            Self::Connection(_) => "CONNECTION_FAILED",
            Self::Tls(_) => "TLS_FAILED",
            Self::Redirect(_) => "REDIRECT_FAILED",
            Self::Request(_) => "REQUEST_FAILED",
        }
    }
}

fn active_header<'a>(request: &'a HttpDebugRequest, name: &str) -> Option<&'a str> {
    request
        .headers
        .iter()
        .find(|header| header.enabled && header.key.trim().eq_ignore_ascii_case(name))
        .map(|header| header.value.as_str())
}

fn mime_type(value: &str) -> String {
    value
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
}

fn content_type_matches(mode: &HttpBodyMode, value: &str) -> bool {
    let mime = mime_type(value);
    match mode {
        HttpBodyMode::None => true,
        HttpBodyMode::Json => mime == "application/json" || mime.ends_with("+json"),
        HttpBodyMode::Form => mime == "application/x-www-form-urlencoded",
        HttpBodyMode::Text => mime.starts_with("text/") && mime.len() > 5,
    }
}

pub fn validate_request(request: &HttpDebugRequest) -> Result<(), HttpClientError> {
    let url = reqwest::Url::parse(request.url.trim()).map_err(|_| HttpClientError::InvalidUrl)?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(HttpClientError::UnsupportedScheme);
    }

    if !(MIN_TIMEOUT_MS..=MAX_TIMEOUT_MS).contains(&request.timeout_ms) {
        return Err(HttpClientError::TimeoutOutOfRange);
    }

    if request.body_mode == HttpBodyMode::Json
        && serde_json::from_str::<Value>(&request.body_text).is_err()
    {
        return Err(HttpClientError::InvalidJson);
    }

    if let Some(value) = active_header(request, "content-type") {
        if !content_type_matches(&request.body_mode, value) {
            return Err(HttpClientError::IncompatibleContentType);
        }
    }

    Ok(())
}

pub fn is_sensitive_name(name: &str) -> bool {
    let normalized: String = name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();
    [
        "password",
        "passwd",
        "token",
        "secret",
        "apikey",
        "authorization",
        "cookie",
    ]
    .iter()
    .any(|fragment| normalized.contains(fragment))
}

fn redact_pairs(values: &mut [HttpKeyValue]) {
    for value in values.iter_mut().filter(|value| value.enabled) {
        if is_sensitive_name(&value.key) {
            value.value = REDACTED.to_string();
        }
    }
}

fn redact_json(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                if is_sensitive_name(key) {
                    *value = Value::String(REDACTED.to_string());
                } else {
                    redact_json(value);
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                redact_json(value);
            }
        }
        _ => {}
    }
}

pub fn build_history_projection(request: &HttpDebugRequest) -> HttpDebugRequest {
    let mut safe = request.clone();
    redact_pairs(&mut safe.headers);
    redact_pairs(&mut safe.form_fields);

    match safe.body_mode {
        HttpBodyMode::Json => {
            if let Ok(mut json) = serde_json::from_str::<Value>(&safe.body_text) {
                redact_json(&mut json);
                safe.body_text = serde_json::to_string(&json).unwrap_or_default();
            } else {
                safe.body_text.clear();
            }
        }
        HttpBodyMode::Text => safe.body_text.clear(),
        HttpBodyMode::None | HttpBodyMode::Form => {}
    }

    safe
}

fn method(method: &HttpMethod) -> reqwest::Method {
    match method {
        HttpMethod::Get => reqwest::Method::GET,
        HttpMethod::Post => reqwest::Method::POST,
        HttpMethod::Put => reqwest::Method::PUT,
        HttpMethod::Patch => reqwest::Method::PATCH,
        HttpMethod::Delete => reqwest::Method::DELETE,
        HttpMethod::Head => reqwest::Method::HEAD,
        HttpMethod::Options => reqwest::Method::OPTIONS,
    }
}

fn map_reqwest_error(error: reqwest::Error) -> HttpClientError {
    if error.is_timeout() {
        return HttpClientError::RequestTimeout;
    }

    let message = error.to_string();
    let lower = message.to_ascii_lowercase();
    if lower.contains("certificate") || lower.contains("tls") {
        HttpClientError::Tls(message)
    } else if error.is_redirect() {
        HttpClientError::Redirect(message)
    } else if error.is_connect() {
        HttpClientError::Connection(message)
    } else {
        HttpClientError::Request(message)
    }
}

fn is_text_content_type(content_type: Option<&str>) -> bool {
    let Some(value) = content_type else {
        return true;
    };
    let mime = mime_type(value);
    mime.starts_with("text/")
        || mime == "application/json"
        || mime.ends_with("+json")
        || mime.contains("xml")
        || mime.contains("javascript")
        || mime.contains("html")
}

pub async fn execute_request(
    request: HttpDebugRequest,
) -> Result<HttpDebugResponse, HttpClientError> {
    validate_request(&request)?;

    let mut url = reqwest::Url::parse(request.url.trim()).map_err(|_| HttpClientError::InvalidUrl)?;
    {
        let mut query = url.query_pairs_mut();
        for value in request
            .query
            .iter()
            .filter(|value| value.enabled && !value.key.trim().is_empty())
        {
            query.append_pair(value.key.trim(), &value.value);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(request.timeout_ms))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| HttpClientError::ClientBuild(error.to_string()))?;

    let mut builder = client.request(method(&request.method), url);
    let mut has_content_type = false;
    for header in request
        .headers
        .iter()
        .filter(|header| header.enabled && !header.key.trim().is_empty())
    {
        let name = HeaderName::from_bytes(header.key.trim().as_bytes())
            .map_err(|error| HttpClientError::InvalidHeader(error.to_string()))?;
        let value = HeaderValue::from_str(&header.value)
            .map_err(|error| HttpClientError::InvalidHeader(error.to_string()))?;
        has_content_type |= name == CONTENT_TYPE;
        builder = builder.header(name, value);
    }

    builder = match request.body_mode {
        HttpBodyMode::None => builder,
        HttpBodyMode::Json => {
            let builder = if has_content_type {
                builder
            } else {
                builder.header(CONTENT_TYPE, "application/json")
            };
            builder.body(request.body_text.clone())
        }
        HttpBodyMode::Form => {
            let fields: Vec<(&str, &str)> = request
                .form_fields
                .iter()
                .filter(|field| field.enabled && !field.key.trim().is_empty())
                .map(|field| (field.key.trim(), field.value.as_str()))
                .collect();
            builder.form(&fields)
        }
        HttpBodyMode::Text => {
            let builder = if has_content_type {
                builder
            } else {
                builder.header(CONTENT_TYPE, "text/plain; charset=utf-8")
            };
            builder.body(request.body_text.clone())
        }
    };

    let started = Instant::now();
    let response = builder.send().await.map_err(map_reqwest_error)?;
    let status = response.status();
    let content_length = response.content_length();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let headers = response
        .headers()
        .iter()
        .map(|(key, value)| HttpResponseHeader {
            key: key.to_string(),
            value: value
                .to_str()
                .map(ToOwned::to_owned)
                .unwrap_or_else(|_| String::from_utf8_lossy(value.as_bytes()).into_owned()),
        })
        .collect();

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut observed = 0_u64;
    let mut truncated = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(map_reqwest_error)?;
        observed = observed.saturating_add(chunk.len() as u64);
        let remaining = MAX_RESPONSE_BYTES.saturating_sub(bytes.len());
        if remaining > 0 {
            bytes.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
        }
        if bytes.len() == MAX_RESPONSE_BYTES && observed > MAX_RESPONSE_BYTES as u64 {
            truncated = true;
            break;
        }
    }

    let text_candidate = is_text_content_type(content_type.as_deref());
    let (body_text, binary) = if text_candidate {
        match String::from_utf8(bytes) {
            Ok(text) => (Some(text), false),
            Err(_) => (None, true),
        }
    } else {
        (None, true)
    };

    Ok(HttpDebugResponse {
        status: status.as_u16(),
        reason: status.canonical_reason().unwrap_or_default().to_string(),
        headers,
        body_text,
        content_type,
        size_bytes: content_length.unwrap_or(observed),
        duration_ms: started.elapsed().as_millis() as u64,
        truncated,
        binary,
    })
}
