import type { RecognitionResult, ProviderType } from '../../shared/types'
import { callOpenAI, testOpenAIConnection } from './openaiAdapter'
import { callAnthropic, testAnthropicConnection } from './anthropicAdapter'
import { getConfigById } from '../database/models/modelConfig'
import { createHistoryRecord } from '../database/models/history'
import { logger } from '../utils/logger'

export interface RecognizeOptions {
    temperature?: number
    topP?: number
    maxTokens?: number
    stream?: boolean
    customParams?: Record<string, string | number | boolean>
    onProgress?: (content: string) => void
}

/**
 * 统一的识别接口
 */
export async function recognize(
    configId: number,
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    options?: RecognizeOptions
): Promise<RecognitionResult> {
    const config = getConfigById(configId)

    if (!config) {
        return {
            success: false,
            error: '配置不存在'
        }
    }

    if (!config.isActive) {
        return {
            success: false,
            error: '该配置已禁用'
        }
    }

    // 优先使用传入的 maxTokens，否则使用配置中的
    const maxTokens = options?.maxTokens || config.maxTokens

    const adapterConfig = {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        maxTokens
    }

    let result: RecognitionResult

    // 根据供应商类型选择适配器
    switch (config.provider) {
        case 'openai':
        case 'azure':
        case 'oneapi':
        case 'custom':
            // 这些都使用 OpenAI 兼容格式
            result = await callOpenAI(adapterConfig, imageBase64, imageMimeType, prompt, options)
            break
        case 'anthropic':
            result = await callAnthropic(adapterConfig, imageBase64, imageMimeType, prompt, options)
            break
        default:
            result = {
                success: false,
                error: `不支持的供应商类型: ${config.provider}`
            }
    }

    // 保存到历史记录
    if (result.success) {
        try {
            // 保存完整图片（不再截断）
            createHistoryRecord({
                configId: config.id,
                configName: config.name,
                imageThumbnail: `data:${imageMimeType};base64,${imageBase64}`,
                prompt,
                result: result.content || '',
                tokensUsed: result.tokensUsed,
                durationMs: result.durationMs
            })
        } catch (error) {
            logger.error('Failed to save history record', error)
        }
    }

    return result
}

/**
 * 测试配置连接
 */
export async function testConnection(configId: number): Promise<{ success: boolean; message: string }> {
    const config = getConfigById(configId)

    if (!config) {
        return { success: false, message: '配置不存在' }
    }

    const adapterConfig = {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        maxTokens: config.maxTokens
    }

    switch (config.provider) {
        case 'openai':
        case 'azure':
        case 'oneapi':
        case 'custom':
            return await testOpenAIConnection(adapterConfig)
        case 'anthropic':
            return await testAnthropicConnection(adapterConfig)
        default:
            return { success: false, message: `不支持的供应商类型: ${config.provider}` }
    }
}

/**
 * 测试配置连接（使用配置对象）
 */
export async function testConnectionWithConfig(
    provider: ProviderType,
    apiUrl: string,
    apiKey: string,
    modelName: string
): Promise<{ success: boolean; message: string }> {
    const adapterConfig = {
        apiUrl,
        apiKey,
        modelName,
        maxTokens: 100
    }

    switch (provider) {
        case 'openai':
        case 'azure':
        case 'oneapi':
        case 'custom':
            return await testOpenAIConnection(adapterConfig)
        case 'anthropic':
            return await testAnthropicConnection(adapterConfig)
        default:
            return { success: false, message: `不支持的供应商类型: ${provider}` }
    }
}
