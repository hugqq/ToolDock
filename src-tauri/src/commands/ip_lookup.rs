use crate::core::ip_lookup::{IpLookupService, IpInfo};
use crate::models::ApiResponse;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct IpQueryRequest {
    pub ip_address: String,
}

#[tauri::command]
pub fn validate_ip_address(ip_address: String) -> Result<ApiResponse<String>, String> {
    let ip_type = IpLookupService::validate_ip(&ip_address)?;

    Ok(ApiResponse {
        ok: true,
        data: Some(ip_type),
        error: None,
    })
}

#[tauri::command]
pub fn check_ip_is_private(ip_address: String) -> Result<ApiResponse<bool>, String> {
    let is_private = IpLookupService::is_private_ip(&ip_address);

    Ok(ApiResponse {
        ok: true,
        data: Some(is_private),
        error: None,
    })
}

#[tauri::command]
pub fn get_ip_special_info(ip_address: String) -> Result<ApiResponse<(bool, String)>, String> {
    let (is_special, info) = IpLookupService::is_special_ip(&ip_address);

    Ok(ApiResponse {
        ok: true,
        data: Some((is_special, info)),
        error: None,
    })
}

#[tauri::command(async)]
pub async fn query_ip_info(req: IpQueryRequest) -> Result<ApiResponse<IpInfo>, String> {
    // 如果不是查询本机 IP，则验证 IP 地址
    if !req.ip_address.trim().is_empty() {
        IpLookupService::validate_ip(&req.ip_address)?;
    }

    // 调用核心逻辑查询
    let info = IpLookupService::query_ip_info(&req.ip_address).await?;

    Ok(ApiResponse {
        ok: true,
        data: Some(info),
        error: None,
    })
}

#[tauri::command(async)]
pub async fn batch_query_ips(ip_addresses: Vec<String>) -> Result<ApiResponse<Vec<(String, bool)>>, String> {
    let results = IpLookupService::batch_validate_ips(&ip_addresses)
        .into_iter()
        .map(|(ip, result)| {
            let is_valid = result.is_ok();
            (ip, is_valid)
        })
        .collect();

    Ok(ApiResponse {
        ok: true,
        data: Some(results),
        error: None,
    })
}

#[tauri::command]
pub fn parse_ip_range(range: String) -> Result<ApiResponse<Vec<String>>, String> {
    let ips = IpLookupService::parse_ip_range(&range)?;

    Ok(ApiResponse {
        ok: true,
        data: Some(ips),
        error: None,
    })
}
