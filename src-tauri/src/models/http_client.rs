use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
    Options,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HttpBodyMode {
    None,
    Json,
    Form,
    Multipart,
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpKeyValue {
    pub id: String,
    pub enabled: bool,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HttpMultipartFieldKind {
    Text,
    File,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpMultipartField {
    pub id: String,
    pub enabled: bool,
    pub key: String,
    pub kind: HttpMultipartFieldKind,
    pub value: String,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpDebugRequest {
    pub method: HttpMethod,
    pub url: String,
    pub query: Vec<HttpKeyValue>,
    pub headers: Vec<HttpKeyValue>,
    pub body_mode: HttpBodyMode,
    pub body_text: String,
    pub form_fields: Vec<HttpKeyValue>,
    #[serde(default)]
    pub multipart_fields: Vec<HttpMultipartField>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponseHeader {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HttpDebugResponse {
    pub status: u16,
    pub reason: String,
    pub headers: Vec<HttpResponseHeader>,
    pub body_text: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: u64,
    pub duration_ms: u64,
    pub truncated: bool,
    pub binary: bool,
}
