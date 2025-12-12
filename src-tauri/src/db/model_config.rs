use crate::db::get_connection;
use crate::utils::crypto::{encrypt, decrypt, mask_api_key};
use serde::{Deserialize, Serialize};
use rusqlite::{params, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub id: i64,
    pub name: String,
    pub provider: String,
    pub api_url: String,
    pub api_key: String,
    pub api_key_encrypted: String,
    pub model_name: String,
    pub max_tokens: i32,
    pub is_active: bool,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigListItem {
    pub id: i64,
    pub name: String,
    pub provider: String,
    pub api_url: String,
    pub api_key_masked: String,
    pub model_name: String,
    pub max_tokens: i32,
    pub is_active: bool,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigInput {
    pub name: String,
    pub provider: String,
    pub api_url: String,
    pub api_key: String,
    pub model_name: String,
    pub max_tokens: Option<i32>,
    pub is_active: Option<bool>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigUpdate {
    pub name: Option<String>,
    pub provider: Option<String>,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
    pub max_tokens: Option<i32>,
    pub is_active: Option<bool>,
    pub is_default: Option<bool>,
}

fn row_to_list_item(
    id: i64,
    name: String,
    provider: String,
    api_url: String,
    api_key_encrypted: String,
    model_name: String,
    max_tokens: i32,
    is_active: i32,
    is_default: i32,
    created_at: String,
    updated_at: String,
) -> ModelConfigListItem {
    let decrypted_key = decrypt(&api_key_encrypted).unwrap_or_default();
    ModelConfigListItem {
        id,
        name,
        provider,
        api_url,
        api_key_masked: mask_api_key(&decrypted_key),
        model_name,
        max_tokens,
        is_active: is_active == 1,
        is_default: is_default == 1,
        created_at,
        updated_at,
    }
}

fn row_to_model(
    id: i64,
    name: String,
    provider: String,
    api_url: String,
    api_key_encrypted: String,
    model_name: String,
    max_tokens: i32,
    is_active: i32,
    is_default: i32,
    created_at: String,
    updated_at: String,
) -> ModelConfig {
    let decrypted_key = decrypt(&api_key_encrypted).unwrap_or_default();
    ModelConfig {
        id,
        name,
        provider,
        api_url,
        api_key: decrypted_key,
        api_key_encrypted,
        model_name,
        max_tokens,
        is_active: is_active == 1,
        is_default: is_default == 1,
        created_at,
        updated_at,
    }
}

pub fn get_all_configs() -> Result<Vec<ModelConfigListItem>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, name, provider, api_url, api_key_encrypted, model_name, max_tokens, is_active, is_default, created_at, updated_at 
         FROM model_configs ORDER BY created_at DESC"
    )?;
    
    let rows = stmt.query_map([], |row| {
        Ok(row_to_list_item(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get(8)?,
            row.get(9)?,
            row.get(10)?,
        ))
    })?;
    
    rows.collect()
}

pub fn get_active_configs() -> Result<Vec<ModelConfigListItem>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, name, provider, api_url, api_key_encrypted, model_name, max_tokens, is_active, is_default, created_at, updated_at 
         FROM model_configs WHERE is_active = 1 ORDER BY is_default DESC, created_at DESC"
    )?;
    
    let rows = stmt.query_map([], |row| {
        Ok(row_to_list_item(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get(8)?,
            row.get(9)?,
            row.get(10)?,
        ))
    })?;
    
    rows.collect()
}

pub fn get_config_by_id(id: i64) -> Result<Option<ModelConfig>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, name, provider, api_url, api_key_encrypted, model_name, max_tokens, is_active, is_default, created_at, updated_at 
         FROM model_configs WHERE id = ?1"
    )?;
    
    let result = stmt.query_row([id], |row| {
        Ok(row_to_model(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get(8)?,
            row.get(9)?,
            row.get(10)?,
        ))
    });
    
    match result {
        Ok(config) => Ok(Some(config)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_default_config() -> Result<Option<ModelConfig>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, name, provider, api_url, api_key_encrypted, model_name, max_tokens, is_active, is_default, created_at, updated_at 
         FROM model_configs WHERE is_default = 1 AND is_active = 1"
    )?;
    
    let result = stmt.query_row([], |row| {
        Ok(row_to_model(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get(8)?,
            row.get(9)?,
            row.get(10)?,
        ))
    });
    
    match result {
        Ok(config) => Ok(Some(config)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn create_config(input: ModelConfigInput) -> Result<ModelConfigListItem> {
    let conn = get_connection().lock();
    let encrypted_key = encrypt(&input.api_key);
    
    conn.execute(
        "INSERT INTO model_configs (name, provider, api_url, api_key_encrypted, model_name, max_tokens, is_active, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.name,
            input.provider,
            input.api_url,
            encrypted_key,
            input.model_name,
            input.max_tokens.unwrap_or(4096),
            if input.is_active.unwrap_or(true) { 1 } else { 0 },
            if input.is_default.unwrap_or(false) { 1 } else { 0 },
        ],
    )?;
    
    let id = conn.last_insert_rowid();
    
    // If set as default, unset others
    if input.is_default.unwrap_or(false) {
        conn.execute(
            "UPDATE model_configs SET is_default = 0 WHERE id != ?1",
            [id],
        )?;
    }
    
    drop(conn);
    
    let configs = get_all_configs()?;
    Ok(configs.into_iter().find(|c| c.id == id).unwrap())
}

pub fn update_config(id: i64, input: ModelConfigUpdate) -> Result<Option<ModelConfigListItem>> {
    let conn = get_connection().lock();
    
    // Check if exists
    let exists: bool = conn.query_row(
        "SELECT 1 FROM model_configs WHERE id = ?1",
        [id],
        |_| Ok(true),
    ).unwrap_or(false);
    
    if !exists {
        return Ok(None);
    }
    
    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(ref name) = input.name {
        updates.push("name = ?");
        values.push(Box::new(name.clone()));
    }
    if let Some(ref provider) = input.provider {
        updates.push("provider = ?");
        values.push(Box::new(provider.clone()));
    }
    if let Some(ref api_url) = input.api_url {
        updates.push("api_url = ?");
        values.push(Box::new(api_url.clone()));
    }
    if let Some(ref api_key) = input.api_key {
        updates.push("api_key_encrypted = ?");
        values.push(Box::new(encrypt(api_key)));
    }
    if let Some(ref model_name) = input.model_name {
        updates.push("model_name = ?");
        values.push(Box::new(model_name.clone()));
    }
    if let Some(max_tokens) = input.max_tokens {
        updates.push("max_tokens = ?");
        values.push(Box::new(max_tokens));
    }
    if let Some(is_active) = input.is_active {
        updates.push("is_active = ?");
        values.push(Box::new(if is_active { 1 } else { 0 }));
    }
    if let Some(is_default) = input.is_default {
        updates.push("is_default = ?");
        values.push(Box::new(if is_default { 1 } else { 0 }));
    }
    
    updates.push("updated_at = datetime('now', 'localtime')");
    
    if !updates.is_empty() {
        let sql = format!(
            "UPDATE model_configs SET {} WHERE id = ?",
            updates.join(", ")
        );
        values.push(Box::new(id));
        
        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params.as_slice())?;
    }
    
    // If set as default, unset others
    if input.is_default == Some(true) {
        conn.execute(
            "UPDATE model_configs SET is_default = 0 WHERE id != ?1",
            [id],
        )?;
    }
    
    drop(conn);
    
    let configs = get_all_configs()?;
    Ok(configs.into_iter().find(|c| c.id == id))
}

pub fn delete_config(id: i64) -> Result<bool> {
    let conn = get_connection().lock();
    let changes = conn.execute("DELETE FROM model_configs WHERE id = ?1", [id])?;
    Ok(changes > 0)
}

pub fn set_default_config(id: i64) -> Result<bool> {
    let conn = get_connection().lock();
    
    // Unset all defaults
    conn.execute("UPDATE model_configs SET is_default = 0", [])?;
    
    // Set new default
    let changes = conn.execute(
        "UPDATE model_configs SET is_default = 1 WHERE id = ?1",
        [id],
    )?;
    
    Ok(changes > 0)
}
