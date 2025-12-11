import { getDatabase } from '../index'
import type { HistoryRecord, HistoryQueryParams, HistoryPaginatedResult } from '../../../shared/types'

interface DbHistoryRecord {
    id: number
    config_id: number
    config_name: string
    image_path: string | null
    image_thumbnail: string | null
    prompt: string
    result: string
    tokens_used: number | null
    duration_ms: number | null
    created_at: string
}

function mapDbToRecord(row: DbHistoryRecord): HistoryRecord {
    return {
        id: row.id,
        configId: row.config_id,
        configName: row.config_name,
        imagePath: row.image_path ?? undefined,
        imageThumbnail: row.image_thumbnail ?? undefined,
        prompt: row.prompt,
        result: row.result,
        tokensUsed: row.tokens_used ?? undefined,
        durationMs: row.duration_ms ?? undefined,
        createdAt: row.created_at
    }
}

export function getHistoryRecords(params: HistoryQueryParams = {}): HistoryPaginatedResult {
    const db = getDatabase()
    const { page = 1, pageSize = 20, startDate, endDate, configId, keyword } = params

    const conditions: string[] = []
    const queryParams: Record<string, unknown> = {}

    if (startDate) {
        conditions.push('created_at >= @startDate')
        queryParams.startDate = startDate
    }
    if (endDate) {
        conditions.push('created_at <= @endDate')
        queryParams.endDate = endDate
    }
    if (configId) {
        conditions.push('config_id = @configId')
        queryParams.configId = configId
    }
    if (keyword) {
        conditions.push('(prompt LIKE @keyword OR result LIKE @keyword)')
        queryParams.keyword = `%${keyword}%`
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM recognition_history ${whereClause}`
    const countResult = db.prepare(countSql).get(queryParams) as { total: number }
    const total = countResult.total

    // 获取记录
    const offset = (page - 1) * pageSize
    const dataSql = `
    SELECT * FROM recognition_history 
    ${whereClause} 
    ORDER BY created_at DESC 
    LIMIT @limit OFFSET @offset
  `
    const rows = db.prepare(dataSql).all({ ...queryParams, limit: pageSize, offset }) as DbHistoryRecord[]

    return {
        records: rows.map(mapDbToRecord),
        total,
        page,
        pageSize
    }
}

export function getHistoryById(id: number): HistoryRecord | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM recognition_history WHERE id = ?').get(id) as DbHistoryRecord | undefined
    return row ? mapDbToRecord(row) : null
}

export function createHistoryRecord(data: {
    configId: number
    configName: string
    imagePath?: string
    imageThumbnail?: string
    prompt: string
    result: string
    tokensUsed?: number
    durationMs?: number
}): HistoryRecord {
    const db = getDatabase()

    const result = db.prepare(`
    INSERT INTO recognition_history 
    (config_id, config_name, image_path, image_thumbnail, prompt, result, tokens_used, duration_ms)
    VALUES (@configId, @configName, @imagePath, @imageThumbnail, @prompt, @result, @tokensUsed, @durationMs)
  `).run({
        configId: data.configId,
        configName: data.configName,
        imagePath: data.imagePath ?? null,
        imageThumbnail: data.imageThumbnail ?? null,
        prompt: data.prompt,
        result: data.result,
        tokensUsed: data.tokensUsed ?? null,
        durationMs: data.durationMs ?? null
    })

    const row = db.prepare('SELECT * FROM recognition_history WHERE id = ?').get(result.lastInsertRowid) as DbHistoryRecord
    return mapDbToRecord(row)
}

export function deleteHistoryRecord(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM recognition_history WHERE id = ?').run(id)
    return result.changes > 0
}

export function deleteHistoryRecords(ids: number[]): number {
    const db = getDatabase()
    const placeholders = ids.map(() => '?').join(',')
    const result = db.prepare(`DELETE FROM recognition_history WHERE id IN (${placeholders})`).run(...ids)
    return result.changes
}

export function clearAllHistory(): number {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM recognition_history').run()
    return result.changes
}

export function exportHistory(params: HistoryQueryParams = {}): HistoryRecord[] {
    const db = getDatabase()
    const { startDate, endDate, configId, keyword } = params

    const conditions: string[] = []
    const queryParams: Record<string, unknown> = {}

    if (startDate) {
        conditions.push('created_at >= @startDate')
        queryParams.startDate = startDate
    }
    if (endDate) {
        conditions.push('created_at <= @endDate')
        queryParams.endDate = endDate
    }
    if (configId) {
        conditions.push('config_id = @configId')
        queryParams.configId = configId
    }
    if (keyword) {
        conditions.push('(prompt LIKE @keyword OR result LIKE @keyword)')
        queryParams.keyword = `%${keyword}%`
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM recognition_history ${whereClause} ORDER BY created_at DESC`
    const rows = db.prepare(sql).all(queryParams) as DbHistoryRecord[]

    return rows.map(mapDbToRecord)
}
