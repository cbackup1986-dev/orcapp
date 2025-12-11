// 历史记录
export interface HistoryRecord {
    id: number
    configId: number
    configName: string
    imagePath?: string
    imageThumbnail?: string // Base64
    prompt: string
    result: string
    tokensUsed?: number
    durationMs?: number
    createdAt: string
}

// 历史记录查询参数
export interface HistoryQueryParams {
    page?: number
    pageSize?: number
    startDate?: string
    endDate?: string
    configId?: number
    keyword?: string
}

// 历史记录分页结果
export interface HistoryPaginatedResult {
    records: HistoryRecord[]
    total: number
    page: number
    pageSize: number
}
