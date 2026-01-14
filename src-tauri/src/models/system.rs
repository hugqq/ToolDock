/*
 * 系统信息数据模型
 */
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub os: OsInfo,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub gpus: Vec<GpuInfo>,
    pub sensors: SensorInfo,
    pub disks: Vec<DiskInfo>,
    pub networks: Vec<NetworkInfo>,
    pub wifi: Option<WifiInfo>,
    pub public_ip: Option<String>,
    pub proxy_ip: Option<String>,
    pub uptime: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub memory_total: u64,
    pub memory_used: u64,
    pub temperature: Option<f32>,
    pub fan_speed: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SensorInfo {
    pub cpu_temp: Option<f32>,
    pub mb_temp: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
    pub kernel_version: String,
    pub hostname: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CpuInfo {
    pub model: String,
    pub cores: usize,
    pub usage: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryInfo {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub sticks: Vec<RamStickInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RamStickInfo {
    pub manufacturer: String,
    pub speed: u32,
    pub capacity: u64,
    pub memory_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiskInfo {
    pub name: String,
    pub disk_type: String,
    pub total: u64,
    pub available: u64,
    pub mount_point: String,
    pub usage_time: Option<u64>, // 以小时为单位
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiskSpeedResult {
    pub seq_read: f64,  // MB/s
    pub seq_write: f64, // MB/s
    pub rand_4k_read: f64,  // MB/s
    pub rand_4k_write: f64, // MB/s
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkInfo {
    pub name: String,
    pub ip: String,
    pub mac: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WifiInfo {
    pub ssid: String,
    pub password: Option<String>,
    pub signal: Option<u8>,
    pub auth: Option<String>,
}
