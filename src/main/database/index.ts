import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { DEFAULT_PROMPTS } from '../../shared/types'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const isPackaged = app.isPackaged

  let dbDir: string
  if (isPackaged) {
    // 生产模式：使用用户数据目录，确保覆盖安装时不丢失数据
    // 路径通常为: %AppData%\Roaming\应用名\database
    dbDir = path.join(app.getPath('userData'), 'database')
  } else {
    // 开发模式：使用项目根目录下的 data 目录
    dbDir = path.join(process.cwd(), 'data')
  }

  // 确保目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, 'data.db')
  db = new Database(dbPath)

  // 启用外键约束
  db.pragma('foreign_keys = ON')

  // 初始化表结构
  initTables(db)

  return db
}

function initTables(db: Database.Database) {
  // 模型配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_configs (
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
    )
  `)

  // 识别历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS recognition_history (
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
    )
  `)

  // 提示词模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 应用设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_created_at ON recognition_history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_config_id ON recognition_history(config_id);
    CREATE INDEX IF NOT EXISTS idx_templates_use_count ON prompt_templates(use_count DESC);
  `)

  // 初始化默认提示词模板
  initDefaultPrompts(db)
}

function initDefaultPrompts(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as count FROM prompt_templates').get() as { count: number }

  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO prompt_templates (name, content, is_default) 
      VALUES (@name, @content, @isDefault)
    `)

    for (const prompt of DEFAULT_PROMPTS) {
      insert.run({
        name: prompt.name,
        content: prompt.content,
        isDefault: prompt.isDefault ? 1 : 0
      })
    }
  }
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
