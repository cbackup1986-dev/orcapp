import { getDatabase } from '../index'
import type { PromptTemplate } from '../../../shared/types'

interface DbPromptTemplate {
    id: number
    name: string
    content: string
    is_default: number
    use_count: number
    created_at: string
}

function mapDbToTemplate(row: DbPromptTemplate): PromptTemplate {
    return {
        id: row.id,
        name: row.name,
        content: row.content,
        isDefault: row.is_default === 1,
        useCount: row.use_count,
        createdAt: row.created_at
    }
}

export function getAllTemplates(): PromptTemplate[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM prompt_templates ORDER BY use_count DESC, created_at DESC').all() as DbPromptTemplate[]
    return rows.map(mapDbToTemplate)
}

export function getDefaultTemplate(): PromptTemplate | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM prompt_templates WHERE is_default = 1').get() as DbPromptTemplate | undefined
    return row ? mapDbToTemplate(row) : null
}

export function getRecentTemplates(limit: number = 10): PromptTemplate[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM prompt_templates ORDER BY use_count DESC LIMIT ?').all(limit) as DbPromptTemplate[]
    return rows.map(mapDbToTemplate)
}

export function createTemplate(name: string, content: string, isDefault: boolean = false): PromptTemplate {
    const db = getDatabase()

    if (isDefault) {
        db.prepare('UPDATE prompt_templates SET is_default = 0').run()
    }

    const result = db.prepare(`
    INSERT INTO prompt_templates (name, content, is_default)
    VALUES (@name, @content, @isDefault)
  `).run({
        name,
        content,
        isDefault: isDefault ? 1 : 0
    })

    const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(result.lastInsertRowid) as DbPromptTemplate
    return mapDbToTemplate(row)
}

export function updateTemplate(id: number, updates: { name?: string; content?: string; isDefault?: boolean }): PromptTemplate | null {
    const db = getDatabase()

    const existing = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id) as DbPromptTemplate | undefined
    if (!existing) return null

    if (updates.isDefault) {
        db.prepare('UPDATE prompt_templates SET is_default = 0').run()
    }

    const updateFields: string[] = []
    const params: Record<string, unknown> = { id }

    if (updates.name !== undefined) {
        updateFields.push('name = @name')
        params.name = updates.name
    }
    if (updates.content !== undefined) {
        updateFields.push('content = @content')
        params.content = updates.content
    }
    if (updates.isDefault !== undefined) {
        updateFields.push('is_default = @isDefault')
        params.isDefault = updates.isDefault ? 1 : 0
    }

    if (updateFields.length > 0) {
        db.prepare(`UPDATE prompt_templates SET ${updateFields.join(', ')} WHERE id = @id`).run(params)
    }

    const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id) as DbPromptTemplate
    return mapDbToTemplate(row)
}

export function deleteTemplate(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id)
    return result.changes > 0
}

export function incrementTemplateUseCount(id: number): void {
    const db = getDatabase()
    db.prepare('UPDATE prompt_templates SET use_count = use_count + 1 WHERE id = ?').run(id)
}
