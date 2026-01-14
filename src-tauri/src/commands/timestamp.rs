use crate::core::timestamp::{TimestampConverter, TimestampUnit};
use crate::models::ApiResponse;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize)]
pub struct TimestampConvertResult {
    pub input: String,
    pub output: String,
    pub unit: String,
    pub timezone: String,
    pub convert_type: String,
}

#[tauri::command(async)]
pub async fn convert_timestamp(
    value: String,
    convert_type: String,
    unit: String,
    timezone: String,
) -> Result<ApiResponse<TimestampConvertResult>, String> {
    let unit_str = unit.clone();
    let unit_enum = TimestampUnit::from_str(&unit)
        .map_err(|e| e.to_string())?;

    let output = if convert_type == "to_datetime" {
        let timestamp: i64 = value.trim().parse()
            .map_err(|_| "时间戳必须是数字".to_string())?;
        TimestampConverter::timestamp_to_datetime(timestamp, unit_enum, &timezone)?
    } else {
        TimestampConverter::datetime_to_timestamp(&value, unit_enum, &timezone)?
            .to_string()
    };

    Ok(ApiResponse {
        ok: true,
        data: Some(TimestampConvertResult {
            input: value,
            output,
            unit: unit_str,
            timezone,
            convert_type,
        }),
        error: None,
    })
}

#[tauri::command]
pub fn get_current_timestamp(unit: String) -> Result<ApiResponse<i64>, String> {
    let timestamp_unit = TimestampUnit::from_str(&unit)
        .map_err(|e| e.to_string())?;
    let now = TimestampConverter::now(timestamp_unit);

    Ok(ApiResponse {
        ok: true,
        data: Some(now),
        error: None,
    })
}

#[tauri::command]
pub fn get_current_datetime() -> Result<ApiResponse<String>, String> {
    let datetime = TimestampConverter::now_datetime();

    Ok(ApiResponse {
        ok: true,
        data: Some(datetime),
        error: None,
    })
}

#[tauri::command(async)]
pub async fn batch_convert_timestamps(
    values: Vec<String>,
    convert_type: String,
    unit: String,
    timezone: String,
) -> Result<ApiResponse<Vec<TimestampConvertResult>>, String> {
    let timestamp_unit = TimestampUnit::from_str(&unit)
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for value in values {
        let output = if convert_type == "to_datetime" {
            match value.trim().parse::<i64>() {
                Ok(ts) => {
                    match TimestampConverter::timestamp_to_datetime(ts, timestamp_unit, &timezone) {
                        Ok(dt) => dt,
                        Err(_) => "无效".to_string(),
                    }
                }
                Err(_) => "无效".to_string(),
            }
        } else {
            match TimestampConverter::datetime_to_timestamp(&value, timestamp_unit, &timezone) {
                Ok(ts) => ts.to_string(),
                Err(_) => "无效".to_string(),
            }
        };

        results.push(TimestampConvertResult {
            input: value,
            output,
            unit: unit.clone(),
            timezone: timezone.clone(),
            convert_type: convert_type.clone(),
        });
    }

    Ok(ApiResponse {
        ok: true,
        data: Some(results),
        error: None,
    })
}
