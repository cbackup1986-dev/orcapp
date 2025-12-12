use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rusqlite::{Connection, Result};
use std::path::Path;

static DB_CONNECTION: OnceCell<Mutex<Connection>> = OnceCell::new();

const DEFAULT_PROMPTS: &[(&str, &str, bool)] = &[
    ("通用识别", "请识别这张图片的内容，并用中文详细描述。", true),
    ("文字提取", "请提取图片中的所有文字内容，保持原有格式。", false),
    ("表格识别", "请识别图片中的表格，并以 Markdown 格式输出。", false),
    ("代码识别", "请识别图片中的代码，保持原有格式和缩进。", false),
    ("公式识别", "请识别图片中的数学公式，并以 LaTeX 格式输出。", false),
];

pub fn init_database(app_data_dir: &Path) -> Result<()> {
    let db_dir = app_data_dir.join("database");
    std::fs::create_dir_all(&db_dir).map_err(|e| {
        rusqlite::Error::InvalidPath(db_dir.join(e.to_string()))
    })?;
    
    let db_path = db_dir.join("data.db");
    let conn = Connection::open(&db_path)?;
    
    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    
    // Initialize tables
    init_tables(&conn)?;
    
    DB_CONNECTION.set(Mutex::new(conn)).map_err(|_| {
        rusqlite::Error::InvalidQuery
    })?;
    
    Ok(())
}

pub fn get_connection() -> &'static Mutex<Connection> {
    DB_CONNECTION.get().expect("Database not initialized")
}

fn init_tables(conn: &Connection) -> Result<()> {
    // Model configs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            api_url TEXT NOT NULL,
            api_key_encrypted TEXT NOT NULL,
            model_name TEXT NOT NULL,
            max_tokens INTEGER DEFAULT 4096,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )",
        [],
    )?;

    // Recognition history table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS recognition_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_id INTEGER NOT NULL,
            config_name TEXT NOT NULL,
            image_path TEXT,
            image_thumbnail TEXT,
            prompt TEXT NOT NULL,
            result TEXT NOT NULL,
            tokens_used INTEGER,
            duration_ms INTEGER,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (config_id) REFERENCES model_configs(id)
        )",
        [],
    )?;

    // Prompt templates table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS prompt_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            use_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )",
        [],
    )?;

    // App settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_created_at ON recognition_history(created_at DESC)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_config_id ON recognition_history(config_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_templates_use_count ON prompt_templates(use_count DESC)",
        [],
    )?;

    // Initialize default prompts
    init_default_prompts(conn)?;

    Ok(())
}

fn init_default_prompts(conn: &Connection) -> Result<()> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM prompt_templates",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        let mut stmt = conn.prepare(
            "INSERT INTO prompt_templates (name, content, is_default) VALUES (?1, ?2, ?3)"
        )?;

        for (name, content, is_default) in DEFAULT_PROMPTS {
            stmt.execute([*name, *content, if *is_default { "1" } else { "0" }])?;
        }
    }

    Ok(())
}
