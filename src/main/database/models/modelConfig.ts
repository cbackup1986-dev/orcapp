import { getDatabase } from '../index'
import { encrypt, decrypt, maskApiKey } from '../../utils/crypto'
import type { ModelConfig, ModelConfigInput, ModelConfigListItem, ProviderType } from '../../../shared/types'

interface DbModelConfig {
    id: number
    name: string
    provider: string
    api_url: string
    api_key_encrypted: string
    model_name: string
    max_tokens: number
    is_active: number
    is_default: number
    created_at: string
    updated_at: string
}

function mapDbToModel(row: DbModelConfig): ModelConfig {
    return {
        id: row.id,
        name: row.name,
        provider: row.provider as ProviderType,
        apiUrl: row.api_url,
        apiKey: decrypt(row.api_key_encrypted),
        apiKeyEncrypted: row.api_key_encrypted,
        modelName: row.model_name,
        maxTokens: row.max_tokens,
        isActive: row.is_active === 1,
        isDefault: row.is_default === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

function mapDbToListItem(row: DbModelConfig): ModelConfigListItem {
    return {
        id: row.id,
        name: row.name,
        provider: row.provider as ProviderType,
        apiUrl: row.api_url,
        apiKeyMasked: maskApiKey(decrypt(row.api_key_encrypted)),
        modelName: row.model_name,
        maxTokens: row.max_tokens,
        isActive: row.is_active === 1,
        isDefault: row.is_default === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

export function getAllConfigs(): ModelConfigListItem[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM model_configs ORDER BY created_at DESC').all() as DbModelConfig[]
    return rows.map(mapDbToListItem)
}

export function getActiveConfigs(): ModelConfigListItem[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM model_configs WHERE is_active = 1 ORDER BY is_default DESC, created_at DESC').all() as DbModelConfig[]
    return rows.map(mapDbToListItem)
}

export function getConfigById(id: number): ModelConfig | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM model_configs WHERE id = ?').get(id) as DbModelConfig | undefined
    return row ? mapDbToModel(row) : null
}

export function getDefaultConfig(): ModelConfig | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM model_configs WHERE is_default = 1 AND is_active = 1').get() as DbModelConfig | undefined
    return row ? mapDbToModel(row) : null
}

export function createConfig(input: ModelConfigInput): ModelConfigListItem {
    const db = getDatabase()

    const encryptedKey = encrypt(input.apiKey)

    const result = db.prepare(`
    INSERT INTO model_configs (name, provider, api_url, api_key_encrypted, model_name, max_tokens, is_active, is_default)
    VALUES (@name, @provider, @apiUrl, @apiKeyEncrypted, @modelName, @maxTokens, @isActive, @isDefault)
  `).run({
        name: input.name,
        provider: input.provider,
        apiUrl: input.apiUrl,
        apiKeyEncrypted: encryptedKey,
        modelName: input.modelName,
        maxTokens: input.maxTokens ?? 4096,
        isActive: input.isActive !== false ? 1 : 0,
        isDefault: input.isDefault ? 1 : 0
    })

    // 如果设置为默认，取消其他配置的默认状态
    if (input.isDefault) {
        db.prepare('UPDATE model_configs SET is_default = 0 WHERE id != ?').run(result.lastInsertRowid)
    }

    const row = db.prepare('SELECT * FROM model_configs WHERE id = ?').get(result.lastInsertRowid) as DbModelConfig
    return mapDbToListItem(row)
}

export function updateConfig(id: number, input: Partial<ModelConfigInput>): ModelConfigListItem | null {
    const db = getDatabase()

    const existing = db.prepare('SELECT * FROM model_configs WHERE id = ?').get(id) as DbModelConfig | undefined
    if (!existing) return null

    const updates: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.name !== undefined) {
        updates.push('name = @name')
        params.name = input.name
    }
    if (input.provider !== undefined) {
        updates.push('provider = @provider')
        params.provider = input.provider
    }
    if (input.apiUrl !== undefined) {
        updates.push('api_url = @apiUrl')
        params.apiUrl = input.apiUrl
    }
    if (input.apiKey !== undefined) {
        updates.push('api_key_encrypted = @apiKeyEncrypted')
        params.apiKeyEncrypted = encrypt(input.apiKey)
    }
    if (input.modelName !== undefined) {
        updates.push('model_name = @modelName')
        params.modelName = input.modelName
    }
    if (input.maxTokens !== undefined) {
        updates.push('max_tokens = @maxTokens')
        params.maxTokens = input.maxTokens
    }
    if (input.isActive !== undefined) {
        updates.push('is_active = @isActive')
        params.isActive = input.isActive ? 1 : 0
    }
    if (input.isDefault !== undefined) {
        updates.push('is_default = @isDefault')
        params.isDefault = input.isDefault ? 1 : 0
    }

    updates.push("updated_at = datetime('now', 'localtime')")

    if (updates.length > 0) {
        db.prepare(`UPDATE model_configs SET ${updates.join(', ')} WHERE id = @id`).run(params)
    }

    // 如果设置为默认，取消其他配置的默认状态
    if (input.isDefault) {
        db.prepare('UPDATE model_configs SET is_default = 0 WHERE id != ?').run(id)
    }

    const row = db.prepare('SELECT * FROM model_configs WHERE id = ?').get(id) as DbModelConfig
    return mapDbToListItem(row)
}

export function deleteConfig(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM model_configs WHERE id = ?').run(id)
    return result.changes > 0
}

export function setDefaultConfig(id: number): boolean {
    const db = getDatabase()

    // 先取消所有默认
    db.prepare('UPDATE model_configs SET is_default = 0').run()

    // 设置新的默认
    const result = db.prepare('UPDATE model_configs SET is_default = 1 WHERE id = ?').run(id)
    return result.changes > 0
}
