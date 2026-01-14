use crate::models::ApiResponse;
use crate::models::unit_converter::{ConversionRequest, ConversionResponse, ExchangeRatesResponse};
use crate::core::unit_converter;
use crate::errors::AppError;

#[tauri::command]
pub async fn convert_units(request: ConversionRequest) -> Result<ApiResponse<ConversionResponse>, AppError> {
    let result = match request.category.as_str() {
        "length" => {
            let val = request.value.parse::<f64>().map_err(|_| AppError::Internal("Invalid number".into()))?;
            unit_converter::convert_length(val, &request.from, &request.to).to_string()
        },
        "weight" => {
            let val = request.value.parse::<f64>().map_err(|_| AppError::Internal("Invalid number".into()))?;
            unit_converter::convert_weight(val, &request.from, &request.to).to_string()
        },
        "temperature" => {
            let val = request.value.parse::<f64>().map_err(|_| AppError::Internal("Invalid number".into()))?;
            unit_converter::convert_temperature(val, &request.from, &request.to).to_string()
        },
        "base" => {
            let from_base = request.from.parse::<u32>().map_err(|_| AppError::Internal("Invalid base".into()))?;
            let to_base = request.to.parse::<u32>().map_err(|_| AppError::Internal("Invalid base".into()))?;
            unit_converter::convert_base(&request.value, from_base, to_base).map_err(|e| AppError::Internal(e))?
        },
        "storage" => {
            let val = request.value.parse::<f64>().map_err(|_| AppError::Internal("Invalid number".into()))?;
            unit_converter::convert_storage(val, &request.from, &request.to).to_string()
        },
        "network_speed" => {
            let val = request.value.parse::<f64>().map_err(|_| AppError::Internal("Invalid number".into()))?;
            unit_converter::convert_network_speed(val, &request.from, &request.to).to_string()
        },
        _ => return Err(AppError::Internal("Invalid category".into())),
    };

    Ok(ApiResponse::ok(ConversionResponse { result }))
}

#[tauri::command]
pub async fn get_exchange_rates(base: String) -> Result<ApiResponse<ExchangeRatesResponse>, AppError> {
    let rates = unit_converter::fetch_exchange_rates(&base).await.map_err(|e| AppError::Internal(e))?;
    
    Ok(ApiResponse::ok(ExchangeRatesResponse {
        amount: rates.amount,
        base: rates.base,
        date: rates.date,
        rates: rates.rates,
    }))
}
