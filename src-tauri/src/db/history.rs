use crate::db::get_connection;
use serde::{Deserialize, Serialize};
use rusqlite::{params, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRecord {
    pub id: i64,
    pub config_id: i64,
    pub config_name: String,
    pub image_path: Option<String>,
    pub image_thumbnail: Option<String>,
    pub prompt: String,
    pub result: String,
    pub tokens_used: Option<i32>,
    pub duration_ms: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryInput {
    pub config_id: i64,
    pub config_name: String,
    pub image_thumbnail: Option<String>,
    pub prompt: String,
    pub result: String,
    pub tokens_used: Option<i32>,
    pub duration_ms: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQueryParams {
    pub page: Option<i32>,
    pub page_size: Option<i32>,
    pub config_id: Option<i64>,
    pub keyword: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPaginatedResult {
    pub records: Vec<HistoryRecord>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

fn row_to_record(
    id: i64,
    config_id: i64,
    config_name: String,
    image_path: Option<String>,
    image_thumbnail: Option<String>,
    prompt: String,
    result: String,
    tokens_used: Option<i32>,
    duration_ms: Option<i32>,
    created_at: String,
) -> HistoryRecord {
    HistoryRecord {
        id,
        config_id,
        config_name,
        image_path,
        image_thumbnail,
        prompt,
        result,
        tokens_used,
        duration_ms,
        created_at,
    }
}

pub fn get_history_records(params: HistoryQueryParams) -> Result<HistoryPaginatedResult> {
    let conn = get_connection().lock();
    
    let page = params.page.unwrap_or(1);
    let page_size = params.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;
    
    let mut where_clauses = Vec::new();
    let mut bind_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(config_id) = params.config_id {
        where_clauses.push("config_id = ?");
        bind_values.push(Box::new(config_id));
    }
    
    if let Some(ref keyword) = params.keyword {
        where_clauses.push("(prompt LIKE ? OR result LIKE ?)");
        let pattern = format!("%{}%", keyword);
        bind_values.push(Box::new(pattern.clone()));
        bind_values.push(Box::new(pattern));
    }
    
    if let Some(ref start_date) = params.start_date {
        where_clauses.push("created_at >= ?");
        bind_values.push(Box::new(start_date.clone()));
    }
    
    if let Some(ref end_date) = params.end_date {
        where_clauses.push("created_at <= ?");
        bind_values.push(Box::new(end_date.clone()));
    }
    
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM recognition_history {}", where_sql);
    let count_params: Vec<&dyn rusqlite::ToSql> = bind_values.iter().map(|v| v.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, count_params.as_slice(), |row| row.get(0))?;
    
    // Get records
    let query_sql = format!(
        "SELECT id, config_id, config_name, image_path, image_thumbnail, prompt, result, tokens_used, duration_ms, created_at 
         FROM recognition_history {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    
    bind_values.push(Box::new(page_size));
    bind_values.push(Box::new(offset));
    
    let query_params: Vec<&dyn rusqlite::ToSql> = bind_values.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&query_sql)?;
    
    let rows = stmt.query_map(query_params.as_slice(), |row| {
        Ok(row_to_record(
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
        ))
    })?;
    
    let records: Vec<HistoryRecord> = rows.collect::<Result<_>>()?;
    
    Ok(HistoryPaginatedResult {
        records,
        total,
        page,
        page_size,
    })
}

pub fn get_history_by_id(id: i64) -> Result<Option<HistoryRecord>> {
    let conn = get_connection().lock();
    let mut stmt = conn.prepare(
        "SELECT id, config_id, config_name, image_path, image_thumbnail, prompt, result, tokens_used, duration_ms, created_at 
         FROM recognition_history WHERE id = ?1"
    )?;
    
    let result = stmt.query_row([id], |row| {
        Ok(row_to_record(
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
        ))
    });
    
    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn create_history_record(input: HistoryInput) -> Result<i64> {
    let conn = get_connection().lock();
    
    conn.execute(
        "INSERT INTO recognition_history (config_id, config_name, image_thumbnail, prompt, result, tokens_used, duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.config_id,
            input.config_name,
            input.image_thumbnail,
            input.prompt,
            input.result,
            input.tokens_used,
            input.duration_ms,
        ],
    )?;
    
    Ok(conn.last_insert_rowid())
}

pub fn delete_history_record(id: i64) -> Result<bool> {
    let conn = get_connection().lock();
    let changes = conn.execute("DELETE FROM recognition_history WHERE id = ?1", [id])?;
    Ok(changes > 0)
}

pub fn delete_history_records(ids: &[i64]) -> Result<usize> {
    if ids.is_empty() {
        return Ok(0);
    }
    
    let conn = get_connection().lock();
    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "DELETE FROM recognition_history WHERE id IN ({})",
        placeholders.join(", ")
    );
    
    let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
    let changes = conn.execute(&sql, params.as_slice())?;
    Ok(changes)
}

pub fn clear_all_history() -> Result<usize> {
    let conn = get_connection().lock();
    let changes = conn.execute("DELETE FROM recognition_history", [])?;
    Ok(changes)
}

pub fn export_history(params: HistoryQueryParams) -> Result<Vec<HistoryRecord>> {
    // Reuse the paginated query but with a large page size
    let mut full_params = params;
    full_params.page = Some(1);
    full_params.page_size = Some(10000);
    
    let result = get_history_records(full_params)?;
    Ok(result.records)
}
