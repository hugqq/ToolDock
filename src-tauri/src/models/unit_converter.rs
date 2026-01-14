use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionRequest {
    pub value: String,
    pub from: String,
    pub to: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionResponse {
    pub result: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExchangeRatesResponse {
    #[serde(default = "default_amount")]
    pub amount: f64,
    pub base: String,
    pub date: String,
    pub rates: HashMap<String, f64>,
}

fn default_amount() -> f64 {
    1.0
}
