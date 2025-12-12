use crate::db::get_connection;
use serde::{Deserialize, Serialize};
use rusqlite::Result;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub image_max_size: i32,
    pub compress_threshold: i32,
    pub auto_compress: bool,
    pub default_temperature: f32,
    pub default_top_p: f32,
    pub default_max_tokens: i32,
    pub default_stream: bool,
}

impl AppSettings {
    pub fn default_settings() -> Self {
        Self {
            theme: "system".to_string(),
            language: "zh-CN".to_string(),
            image_max_size: 10,
            compress_threshold: 2048,
            auto_compress: true,
            default_temperature: 0.0,
            default_top_p: 0.4,
            default_max_tokens: 2048,
            default_stream: true,
        }
    }
}

pub fn get_all_settings() -> Result<AppSettings> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare("SELECT key, value FROM app_settings")?;
    
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    
    let mut settings_map: HashMap<String, String> = HashMap::new();
    for row in rows {
        let (key, value) = row?;
        settings_map.insert(key, value);
    }
    
    let defaults = AppSettings::default_settings();
    
    Ok(AppSettings {
        theme: settings_map.get("theme").cloned().unwrap_or(defaults.theme),
        language: settings_map.get("language").cloned().unwrap_or(defaults.language),
        image_max_size: settings_map.get("imageMaxSize")
            .and_then(|v| v.parse().ok())
            .unwrap_or(defaults.image_max_size),
        compress_threshold: settings_map.get("compressThreshold")
            .and_then(|v| v.parse().ok())
            .unwrap_or(defaults.compress_threshold),
        auto_compress: settings_map.get("autoCompress")
            .map(|v| v == "true")
            .unwrap_or(defaults.auto_compress),
        default_temperature: settings_map.get("defaultTemperature")
            .and_then(|v| v.parse().ok())
            .unwrap_or(defaults.default_temperature),
        default_top_p: settings_map.get("defaultTopP")
            .and_then(|v| v.parse().ok())
            .unwrap_or(defaults.default_top_p),
        default_max_tokens: settings_map.get("defaultMaxTokens")
            .and_then(|v| v.parse().ok())
            .unwrap_or(defaults.default_max_tokens),
        default_stream: settings_map.get("defaultStream")
            .map(|v| v == "true")
            .unwrap_or(defaults.default_stream),
    })
}

pub fn update_settings(updates: HashMap<String, serde_json::Value>) -> Result<AppSettings> {
    let conn = get_connection().lock();
    
    for (key, value) in updates {
        let value_str = match value {
            serde_json::Value::String(s) => s,
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => value.to_string(),
        };
        
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, updated_at) 
             VALUES (?1, ?2, datetime('now', 'localtime'))",
            [&key, &value_str],
        )?;
    }
    
    drop(conn);
    get_all_settings()
}

pub fn reset_settings() -> Result<AppSettings> {
    let conn = get_connection().lock();
    conn.execute("DELETE FROM app_settings", [])?;
    drop(conn);
    get_all_settings()
}
