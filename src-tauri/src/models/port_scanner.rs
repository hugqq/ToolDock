use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanResult {
    pub port: u16,
    pub status: String, // "open", "closed", "timeout", "error"
    pub service: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanProgress {
    pub current_port: u16,
    pub total_ports: usize,
    pub scanned_count: usize,
    pub result: Option<ScanResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PortOccupancy {
    pub protocol: String,
    pub local_address: String,
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
}
