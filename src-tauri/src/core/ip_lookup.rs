use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpInfo {
    pub ip: String,
    pub ip_type: String, // IPv4 or IPv6
    pub country: String,
    pub province: String,
    pub city: String,
    pub isp: String,
    pub organization: String,
    pub latitude: f64,
    pub longitude: f64,
    pub asn: String,
    pub timezone: String,
}

pub struct IpLookupService;

impl IpLookupService {
    /// 验证 IP 地址有效性
    pub fn validate_ip(ip_str: &str) -> Result<String, String> {
        let ip_str = ip_str.trim();

        match IpAddr::from_str(ip_str) {
            Ok(addr) => {
                let ip_type = match addr {
                    IpAddr::V4(_) => "IPv4",
                    IpAddr::V6(_) => "IPv6",
                };
                Ok(ip_type.to_string())
            }
            Err(_) => Err(format!("无效的 IP 地址: {}", ip_str)),
        }
    }

    /// 检查是否为本地 IP
    pub fn is_private_ip(ip_str: &str) -> bool {
        if let Ok(addr) = IpAddr::from_str(ip_str) {
            match addr {
                IpAddr::V4(v4) => v4.is_private() || v4.is_loopback() || v4.is_link_local(),
                IpAddr::V6(v6) => v6.is_loopback() || v6.is_unique_local(),
            }
        } else {
            false
        }
    }

    /// 检查是否为特殊 IP
    pub fn is_special_ip(ip_str: &str) -> (bool, String) {
        if let Ok(addr) = IpAddr::from_str(ip_str) {
            match addr {
                IpAddr::V4(v4) => {
                    if v4.is_loopback() {
                        return (true, "本地回环地址".to_string());
                    }
                    if v4.is_private() {
                        return (true, "私有地址".to_string());
                    }
                    if v4.is_link_local() {
                        return (true, "链接本地地址".to_string());
                    }
                    if v4.is_broadcast() {
                        return (true, "广播地址".to_string());
                    }
                }
                IpAddr::V6(v6) => {
                    if v6.is_loopback() {
                        return (true, "本地回环地址".to_string());
                    }
                    if v6.is_unique_local() {
                        return (true, "唯一本地地址".to_string());
                    }
                    if v6.is_unicast_link_local() {
                        return (true, "链接本地地址".to_string());
                    }
                }
            }
        }
        (false, String::new())
    }

    /// 批量验证 IP 地址列表
    pub fn batch_validate_ips(ips: &[String]) -> Vec<(String, Result<String, String>)> {
        ips.iter()
            .map(|ip| (ip.clone(), Self::validate_ip(ip)))
            .collect()
    }

    /// 查询 IP 信息
    pub async fn query_ip_info(ip_str: &str) -> Result<IpInfo, String> {
        let ip_str = ip_str.trim();
        
        let url = if ip_str.is_empty() {
            "http://ip-api.com/json/?fields=status,message,country,regionName,city,isp,org,as,lat,lon,timezone,query".to_string()
        } else {
            // 如果是特殊地址，直接返回
            let (is_special, special_info) = Self::is_special_ip(ip_str);
            if is_special {
                let mut info = IpInfo::new(ip_str.to_string());
                info.city = special_info;
                return Ok(info);
            }
            format!("http://ip-api.com/json/{}?fields=status,message,country,regionName,city,isp,org,as,lat,lon,timezone,query", ip_str)
        };
        
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| format!("创建请求客户端失败: {}", e))?;

        let resp = client.get(url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        let json: serde_json::Value = resp.json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        if json["status"] == "fail" {
            return Err(format!("查询失败: {}", json["message"].as_str().unwrap_or("未知错误")));
        }

        Ok(IpInfo {
            ip: json["query"].as_str().unwrap_or(ip_str).to_string(),
            ip_type: if ip_str.contains(':') { "IPv6" } else { "IPv4" }.to_string(),
            country: json["country"].as_str().unwrap_or("未知").to_string(),
            province: json["regionName"].as_str().unwrap_or("未知").to_string(),
            city: json["city"].as_str().unwrap_or("未知").to_string(),
            isp: json["isp"].as_str().unwrap_or("未知").to_string(),
            organization: json["org"].as_str().unwrap_or("未知").to_string(),
            latitude: json["lat"].as_f64().unwrap_or(0.0),
            longitude: json["lon"].as_f64().unwrap_or(0.0),
            asn: json["as"].as_str().unwrap_or("未知").to_string(),
            timezone: json["timezone"].as_str().unwrap_or("未知").to_string(),
        })
    }

    /// 解析 IP 地址段 (如 192.168.1.0/24)
    pub fn parse_ip_range(range_str: &str) -> Result<Vec<String>, String> {
        if !range_str.contains('/') {
            return Err("IP 范围格式错误，请使用 CIDR 标记法 (例如: 192.168.1.0/24)".to_string());
        }

        // 简化实现，返回起始和结束 IP
        // 完整实现需要处理 CIDR 子网划分
        Ok(vec![
            "解析 IP 范围需要在后端实现完整的 CIDR 处理".to_string(),
        ])
    }
}

/// IP 查询结果 (本地实现)
impl IpInfo {
    pub fn new(ip: String) -> Self {
        Self {
            ip,
            ip_type: "IPv4".to_string(),
            country: "中国".to_string(),
            province: "未知".to_string(),
            city: "未知".to_string(),
            isp: "未知".to_string(),
            organization: "未知".to_string(),
            latitude: 0.0,
            longitude: 0.0,
            asn: "未知".to_string(),
            timezone: "Asia/Shanghai".to_string(),
        }
    }

    /// 来自外部 API 的响应
    pub fn from_api_response(
        ip: String,
        country: String,
        province: String,
        city: String,
        isp: String,
        latitude: f64,
        longitude: f64,
    ) -> Self {
        Self {
            ip_type: if ip.contains(':') { "IPv6" } else { "IPv4" }
                .to_string(),
            ip,
            country,
            province,
            city,
            isp,
            organization: String::new(),
            latitude,
            longitude,
            asn: String::new(),
            timezone: "Asia/Shanghai".to_string(),
        }
    }
}
