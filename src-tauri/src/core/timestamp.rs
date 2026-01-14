use chrono::{DateTime, Local, TimeZone, Utc};
use std::str::FromStr;

/// 时间戳转换核心逻辑
pub struct TimestampConverter;

impl TimestampConverter {
    /// 将 Unix 时间戳转换为日期时间字符串
    pub fn timestamp_to_datetime(
        timestamp: i64,
        unit: TimestampUnit,
        timezone: &str,
    ) -> Result<String, String> {
        let seconds = match unit {
            TimestampUnit::Seconds => timestamp,
            TimestampUnit::Milliseconds => timestamp / 1000,
            TimestampUnit::Microseconds => timestamp / 1_000_000,
        };

        if timezone.to_uppercase() == "UTC" {
            match Utc.timestamp_opt(seconds, 0) {
                chrono::LocalResult::Single(dt) => Ok(dt.format("%Y-%m-%d %H:%M:%S").to_string()),
                _ => Err("无效的时间戳".to_string()),
            }
        } else {
            match Local.timestamp_opt(seconds, 0) {
                chrono::LocalResult::Single(dt) => Ok(dt.format("%Y-%m-%d %H:%M:%S").to_string()),
                _ => Err("无效的时间戳".to_string()),
            }
        }
    }

    /// 将日期时间字符串转换为 Unix 时间戳
    pub fn datetime_to_timestamp(
        datetime_str: &str,
        unit: TimestampUnit,
        timezone: &str,
    ) -> Result<i64, String> {
        // 支持多种日期格式
        let formats = vec![
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ];

        for format in formats {
            if timezone.to_uppercase() == "UTC" {
                if let Ok(dt) = DateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S %z") {
                    let timestamp = dt.timestamp();
                    return Ok(match unit {
                        TimestampUnit::Seconds => timestamp,
                        TimestampUnit::Milliseconds => timestamp * 1000,
                        TimestampUnit::Microseconds => timestamp * 1_000_000,
                    });
                }
                if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(datetime_str, format) {
                    let dt = Utc.from_utc_datetime(&naive);
                    let timestamp = dt.timestamp();
                    return Ok(match unit {
                        TimestampUnit::Seconds => timestamp,
                        TimestampUnit::Milliseconds => timestamp * 1000,
                        TimestampUnit::Microseconds => timestamp * 1_000_000,
                    });
                }
            } else {
                if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(datetime_str, format) {
                    if let chrono::LocalResult::Single(dt) = Local.from_local_datetime(&naive) {
                        let timestamp = dt.timestamp();
                        return Ok(match unit {
                            TimestampUnit::Seconds => timestamp,
                            TimestampUnit::Milliseconds => timestamp * 1000,
                            TimestampUnit::Microseconds => timestamp * 1_000_000,
                        });
                    }
                }
            }
        }

        Err("无效的日期时间格式".to_string())
    }

    /// 获取当前时间戳
    pub fn now(unit: TimestampUnit) -> i64 {
        let now = Local::now();
        let timestamp = now.timestamp();
        match unit {
            TimestampUnit::Seconds => timestamp,
            TimestampUnit::Milliseconds => timestamp * 1000,
            TimestampUnit::Microseconds => timestamp * 1_000_000,
        }
    }

    /// 获取当前本地时间字符串
    pub fn now_datetime() -> String {
        Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
    }
}

#[derive(Clone, Copy, Debug)]
pub enum TimestampUnit {
    Seconds,
    Milliseconds,
    Microseconds,
}

impl FromStr for TimestampUnit {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "seconds" | "s" => Ok(TimestampUnit::Seconds),
            "milliseconds" | "ms" => Ok(TimestampUnit::Milliseconds),
            "microseconds" | "us" => Ok(TimestampUnit::Microseconds),
            _ => Err(format!("未知的单位: {}", s)),
        }
    }
}
