import type { RecognitionResult, AnthropicRequest } from '../../shared/types'
import axios from 'axios'
import { logger } from '../utils/logger'

export interface AnthropicAdapterConfig {
    apiUrl: string
    apiKey: string
    modelName: string
    maxTokens: number
}

export async function callAnthropic(
    config: AnthropicAdapterConfig,
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    options?: { temperature?: number; topP?: number }
): Promise<RecognitionResult> {
    const startTime = Date.now()

    if (!imageBase64) {
        throw new Error('Image data is empty')
    }

    logger.info(`Preparing Anthropic request. Base64 length: ${imageBase64.length}, MimeType: ${imageMimeType}`)

    const request: AnthropicRequest = {
        model: config.modelName,
        max_tokens: config.maxTokens,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: imageMimeType,
                            data: imageBase64
                        }
                    }
                ]
            }
        ],
        temperature: options?.temperature,
        top_p: options?.topP
    }

    try {
        const response = await axios.post(config.apiUrl, request, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000
        })

        const durationMs = Date.now() - startTime

        // Anthropic 响应格式
        const content = response.data.content?.[0]?.text || ''
        const inputTokens = response.data.usage?.input_tokens || 0
        const outputTokens = response.data.usage?.output_tokens || 0
        const tokensUsed = inputTokens + outputTokens

        logger.logApiCall('Anthropic', { model: config.modelName, prompt: prompt.slice(0, 100) }, { tokensUsed }, durationMs)

        return {
            success: true,
            content,
            tokensUsed,
            durationMs
        }
    } catch (error) {
        const durationMs = Date.now() - startTime
        let errorMessage = '未知错误'

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                errorMessage = '请求超时，请检查网络连接'
            } else if (error.response?.status === 401) {
                errorMessage = 'API 密钥无效，请检查配置'
            } else if (error.response?.status === 429) {
                errorMessage = '请求频率过高或配额已用尽'
            } else if (error.response?.status === 400) {
                errorMessage = error.response.data?.error?.message || '请求参数错误'
            } else if (error.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message
            } else {
                errorMessage = error.message
            }
        } else if (error instanceof Error) {
            errorMessage = error.message
        }

        logger.error('Anthropic API call failed', { error: errorMessage, durationMs })

        return {
            success: false,
            error: errorMessage,
            durationMs
        }
    }
}

// 测试连接
export async function testAnthropicConnection(config: AnthropicAdapterConfig): Promise<{ success: boolean; message: string }> {
    try {
        const response = await axios.post(
            config.apiUrl,
            {
                model: config.modelName,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hello' }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000
            }
        )

        if (response.data.content) {
            return { success: true, message: '连接成功' }
        }
        return { success: false, message: '响应格式异常' }
    } catch (error) {
        let message = '连接失败'
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401) {
                message = 'API 密钥无效'
            } else if (error.response?.status === 404) {
                message = 'API 地址错误或模型不存在'
            } else if (error.code === 'ECONNABORTED') {
                message = '连接超时'
            } else {
                message = error.response?.data?.error?.message || error.message
            }
        }
        return { success: false, message }
    }
}
