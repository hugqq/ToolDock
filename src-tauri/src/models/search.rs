use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResult {
    pub kind: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResponse {
    pub provider: String,
    pub available: bool,
    pub results: Vec<FileSearchResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::FileSearchResult;

    #[test]
    fn serializes_optional_icon_data_url_as_camel_case() {
        let result = FileSearchResult {
            kind: "file".into(),
            name: "app.lnk".into(),
            path: r"C:\ProgramData\app.lnk".into(),
            modified_at: Some(7),
            size: Some(42),
            icon_data_url: Some("data:image/png;base64,AA==".into()),
        };

        let json = serde_json::to_value(result).expect("search result should serialize");
        assert_eq!(json["iconDataUrl"], "data:image/png;base64,AA==");
    }
}
