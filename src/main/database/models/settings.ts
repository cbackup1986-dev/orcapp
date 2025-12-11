import { getDatabase } from '../index'
import { DEFAULT_SETTINGS, AppSettings } from '../../../shared/types'

export function getSetting(key: string): string | null {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
    const db = getDatabase()
    db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) 
    VALUES (@key, @value, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = datetime('now', 'localtime')
  `).run({ key, value })
}

export function getAllSettings(): AppSettings {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]

    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS }

    for (const row of rows) {
        try {
            settings[row.key] = JSON.parse(row.value)
        } catch {
            settings[row.key] = row.value
        }
    }

    return settings as unknown as AppSettings
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
    const db = getDatabase()

    const transaction = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
            setSetting(key, valueStr)
        }
    })

    transaction()
    return getAllSettings()
}

export function resetSettings(): AppSettings {
    const db = getDatabase()
    db.prepare('DELETE FROM app_settings').run()

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
        setSetting(key, valueStr)
    }

    return DEFAULT_SETTINGS
}
