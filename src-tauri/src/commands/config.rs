use crate::db::model_config::{
    self, ModelConfig, ModelConfigInput, ModelConfigListItem, ModelConfigUpdate,
};
use crate::services::llm;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionData {
    pub provider: String,
    pub api_url: String,
    pub api_key: String,
    pub model_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn get_all_configs() -> Result<Vec<ModelConfigListItem>, String> {
    model_config::get_all_configs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_configs() -> Result<Vec<ModelConfigListItem>, String> {
    model_config::get_active_configs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config_by_id(id: i64) -> Result<Option<ModelConfig>, String> {
    model_config::get_config_by_id(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_default_config() -> Result<Option<ModelConfig>, String> {
    model_config::get_default_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_config(input: ModelConfigInput) -> Result<ModelConfigListItem, String> {
    model_config::create_config(input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_config(id: i64, input: ModelConfigUpdate) -> Result<Option<ModelConfigListItem>, String> {
    model_config::update_config(id, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_config(id: i64) -> Result<bool, String> {
    model_config::delete_config(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_default_config(id: i64) -> Result<bool, String> {
    model_config::set_default_config(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_connection(id: i64) -> Result<TestConnectionResult, String> {
    let (success, message) = llm::test_connection(id).await;
    Ok(TestConnectionResult { success, message })
}

#[tauri::command]
pub async fn test_connection_with_data(data: TestConnectionData) -> Result<TestConnectionResult, String> {
    let (success, message) = llm::test_connection_with_config(
        &data.provider,
        &data.api_url,
        &data.api_key,
        &data.model_name,
    ).await;
    Ok(TestConnectionResult { success, message })
}
