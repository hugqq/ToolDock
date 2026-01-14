use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NamingResult {
    pub category: String,
    pub items: Vec<NamingItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NamingItem {
    pub label: String,
    pub value: String,
}
