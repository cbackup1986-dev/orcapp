use crate::db::get_connection;
use serde::{Deserialize, Serialize};
use rusqlite::{params, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptTemplate {
    pub id: i64,
    pub name: String,
    pub content: String,
    pub is_default: bool,
    pub use_count: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateUpdate {
    pub name: Option<String>,
    pub content: Option<String>,
    pub is_default: Option<bool>,
}

fn row_to_template(
    id: i64,
    name: String,
    content: String,
    is_default: i32,
    use_count: i32,
    created_at: String,
) -> PromptTemplate {
    PromptTemplate {
        id,
        name,
        content,
        is_default: is_default == 1,
        use_count,
        created_at,
    }
}

pub fn get_all_templates() -> Result<Vec<PromptTemplate>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, name, content, is_default, use_count, created_at 
         FROM prompt_templates ORDER BY is_default DESC, use_count DESC, created_at DESC"
    )?;
    
    let rows = stmt.query_map([], |row| {
        Ok(row_to_template(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
    })?;
    
    rows.collect()
}

pub fn get_default_template() -> Result<Option<PromptTemplate>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, name, content, is_default, use_count, created_at 
         FROM prompt_templates WHERE is_default = 1"
    )?;
    
    let result = stmt.query_row([], |row| {
        Ok(row_to_template(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
    });
    
    match result {
        Ok(template) => Ok(Some(template)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_recent_templates(limit: Option<i32>) -> Result<Vec<PromptTemplate>> {
    let conn = get_connection().lock();
    let limit_val = limit.unwrap_or(5);
    let mut stmt = conn.prepare(
        "SELECT id, name, content, is_default, use_count, created_at 
         FROM prompt_templates ORDER BY use_count DESC, created_at DESC LIMIT ?1"
    )?;
    
    let rows = stmt.query_map([limit_val], |row| {
        Ok(row_to_template(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
    })?;
    
    rows.collect()
}

pub fn create_template(name: &str, content: &str, is_default: bool) -> Result<PromptTemplate> {
    let conn = get_connection().lock();
    
    conn.execute(
        "INSERT INTO prompt_templates (name, content, is_default) VALUES (?1, ?2, ?3)",
        params![name, content, if is_default { 1 } else { 0 }],
    )?;
    
    let id = conn.last_insert_rowid();
    
    // If set as default, unset others
    if is_default {
        conn.execute(
            "UPDATE prompt_templates SET is_default = 0 WHERE id != ?1",
            [id],
        )?;
    }
    
    let mut stmt = conn.prepare(
        "SELECT id, name, content, is_default, use_count, created_at 
         FROM prompt_templates WHERE id = ?1"
    )?;
    
    stmt.query_row([id], |row| {
        Ok(row_to_template(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
    })
}

pub fn update_template(id: i64, updates: TemplateUpdate) -> Result<Option<PromptTemplate>> {
    let conn = get_connection().lock();
    
    // Check if exists
    let exists: bool = conn.query_row(
        "SELECT 1 FROM prompt_templates WHERE id = ?1",
        [id],
        |_| Ok(true),
    ).unwrap_or(false);
    
    if !exists {
        return Ok(None);
    }
    
    let mut update_stmts = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(ref name) = updates.name {
        update_stmts.push("name = ?");
        values.push(Box::new(name.clone()));
    }
    if let Some(ref content) = updates.content {
        update_stmts.push("content = ?");
        values.push(Box::new(content.clone()));
    }
    if let Some(is_default) = updates.is_default {
        update_stmts.push("is_default = ?");
        values.push(Box::new(if is_default { 1 } else { 0 }));
    }
    
    if !update_stmts.is_empty() {
        let sql = format!(
            "UPDATE prompt_templates SET {} WHERE id = ?",
            update_stmts.join(", ")
        );
        values.push(Box::new(id));
        
        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params.as_slice())?;
    }
    
    // If set as default, unset others
    if updates.is_default == Some(true) {
        conn.execute(
            "UPDATE prompt_templates SET is_default = 0 WHERE id != ?1",
            [id],
        )?;
    }
    
    let mut stmt = conn.prepare(
        "SELECT id, name, content, is_default, use_count, created_at 
         FROM prompt_templates WHERE id = ?1"
    )?;
    
    let result = stmt.query_row([id], |row| {
        Ok(row_to_template(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
    });
    
    match result {
        Ok(template) => Ok(Some(template)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn delete_template(id: i64) -> Result<bool> {
    let conn = get_connection().lock();
    let changes = conn.execute("DELETE FROM prompt_templates WHERE id = ?1", [id])?;
    Ok(changes > 0)
}

pub fn increment_use_count(id: i64) -> Result<()> {
    let conn = get_connection().lock();
    conn.execute(
        "UPDATE prompt_templates SET use_count = use_count + 1 WHERE id = ?1",
        [id],
    )?;
    Ok(())
}
