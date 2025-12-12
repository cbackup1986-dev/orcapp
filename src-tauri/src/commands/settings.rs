use crate::db::settings::{self, AppSettings};
use std::collections::HashMap;

#[tauri::command]
pub fn get_all_settings() -> Result<AppSettings, String> {
    settings::get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(updates: HashMap<String, serde_json::Value>) -> Result<AppSettings, String> {
    settings::update_settings(updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_settings() -> Result<AppSettings, String> {
    settings::reset_settings().map_err(|e| e.to_string())
}
