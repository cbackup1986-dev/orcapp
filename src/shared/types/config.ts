// 供应商类型
export type ProviderType = 'openai' | 'anthropic' | 'azure' | 'oneapi' | 'custom'

// 模型配置
export interface ModelConfig {
    id: number
    name: string
    provider: ProviderType
    apiUrl: string
    apiKey: string // 解密后的值，仅在内存中使用
    apiKeyEncrypted?: string // 加密后的值，存储在数据库
    modelName: string
    maxTokens: number
    isActive: boolean
    isDefault: boolean
    createdAt: string
    updatedAt: string
}

// 创建/更新配置的输入类型
export interface ModelConfigInput {
    name: string
    provider: ProviderType
    apiUrl: string
    apiKey: string
    modelName: string
    maxTokens?: number
    isActive?: boolean
    isDefault?: boolean
}

// 配置列表项（脱敏后）
export interface ModelConfigListItem {
    id: number
    name: string
    provider: ProviderType
    apiUrl: string
    apiKeyMasked: string // 如 sk-***abc
    modelName: string
    maxTokens: number
    isActive: boolean
    isDefault: boolean
    createdAt: string
    updatedAt: string
}
