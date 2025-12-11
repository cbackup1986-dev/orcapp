import type { RecognitionResult, OpenAIRequest } from '../../shared/types'
import axios from 'axios'
import { logger } from '../utils/logger'

export interface OpenAIAdapterConfig {
    apiUrl: string
    apiKey: string
    modelName: string
    maxTokens: number
}

/**
 * 调用 OpenAI 兼容 API 进行识别
 */
export async function callOpenAI(
    config: OpenAIAdapterConfig,
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    options?: {
        temperature?: number;
        topP?: number;
        maxTokens?: number;
        stream?: boolean;
        customParams?: Record<string, string | number | boolean>;
        onProgress?: (content: string) => void
    }
): Promise<RecognitionResult> {
    const startTime = Date.now()

    if (!imageBase64) {
        throw new Error('Image data is empty')
    }

    logger.info(`Preparing OpenAI request. Base64 length: ${imageBase64.length}, MimeType: ${imageMimeType}`)

    // 构建基础请求
    const request: Record<string, any> = {
        model: config.modelName,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${imageMimeType};base64,${imageBase64}`
                        }
                    }
                ]
            }
        ],
        max_tokens: config.maxTokens,
        temperature: options?.temperature,
        top_p: options?.topP,
        stream: options?.stream
    }

    // 添加自定义参数（包括 repetition_penalty 等）
    if (options?.customParams) {
        Object.entries(options.customParams).forEach(([key, value]) => {
            if (key && value !== undefined) {
                request[key] = value
            }
        })
    }

    try {
        if (options?.stream) {
            const response = await axios.post(config.apiUrl, request, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 120000,
                responseType: 'stream'
            })

            let fullContent = ''
            let tokensUsed = 0 // Streaming doesn't always provide usage
            let buffer = '' // Buffer for incomplete lines

            await new Promise<void>((resolve, reject) => {
                const stream = response.data
                stream.on('data', (chunk: Buffer) => {
                    // Combine with buffer and convert to string
                    buffer += chunk.toString()

                    const lines = buffer.split('\n')
                    // Keep the last part in buffer as it might be incomplete
                    // If the last part ends with \n, buffer will be empty string, which is fine
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        const trimmedLine = line.trim()
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue

                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(trimmedLine.slice(6))
                                const content = data.choices?.[0]?.delta?.content || ''
                                if (content) {
                                    console.log('[Adapter] Chunk extracted:', content)
                                    fullContent += content
                                    options.onProgress?.(content)
                                }
                            } catch (e) {
                                // Filter out non-JSON data lines if any
                                console.warn('[Adapter] Failed to parse stream line:', trimmedLine)
                            }
                        }
                    }
                })

                stream.on('end', () => {
                    // Process any remaining buffer if it looks like a complete line (unlikely for SSE but safe)
                    if (buffer.trim()) {
                        const line = buffer.trim()
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))
                                const content = data.choices?.[0]?.delta?.content || ''
                                if (content) {
                                    fullContent += content
                                    options.onProgress?.(content)
                                }
                            } catch (e) { }
                        }
                    }
                    resolve()
                })
                stream.on('error', (err: Error) => reject(err))
            })

            const durationMs = Date.now() - startTime
            return {
                success: true,
                content: fullContent, // No cleanup needed for streaming as we build it
                tokensUsed,
                durationMs
            }

        } else {
            const response = await axios.post(config.apiUrl, request, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 120000 // 2 minutes timeout
            })

            const durationMs = Date.now() - startTime
            let content = response.data.choices?.[0]?.message?.content || ''

            // 清理响应内容：移除开头的无效字符（如 }}, {{ 等）
            content = cleanResponseContent(content)

            const tokensUsed = response.data.usage?.total_tokens || 0

            logger.logApiCall('OpenAI', { model: config.modelName, prompt: prompt.slice(0, 100) }, { tokensUsed }, durationMs)

            return {
                success: true,
                content,
                tokensUsed,
                durationMs
            }
        }
    } catch (error) {
        const durationMs = Date.now() - startTime
        let errorMessage = '未知错误'

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                errorMessage = '请求超时，请检查网络连接'
            } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.message?.includes('getaddrinfo')) {
                errorMessage = 'DNS 解析失败，请检查网络连接或 API 地址是否正确'
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = '连接被拒绝，请检查 API 地址是否正确'
            } else if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
                errorMessage = '网络连接已重置，请重试'
            } else if (error.response?.status === 401) {
                errorMessage = 'API 密钥无效，请检查配置'
            } else if (error.response?.status === 429) {
                errorMessage = '请求频率过高或配额已用尽'
            } else if (error.response?.status === 400) {
                // Return detailed error from server for debugging
                const isStream = error.response.config?.responseType === 'stream';
                let errorDataStr = '';

                try {
                    if (isStream && error.response.data && typeof error.response.data.on === 'function') {
                        // Consuming the error stream
                        errorDataStr = await new Promise<string>((resolve) => {
                            const chunks: Buffer[] = [];
                            const stream = error.response.data;
                            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                            stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
                            stream.on('error', () => resolve('[Error reading error stream]'));
                        });
                    } else if (Buffer.isBuffer(error.response.data)) {
                        errorDataStr = error.response.data.toString();
                    } else {
                        errorDataStr = JSON.stringify(error.response.data, null, 2);
                    }
                } catch (e) {
                    errorDataStr = '[Error parsing response data]';
                }

                logger.error('Server 400 response:', errorDataStr);

                // Try to parse server error message
                let serverError = '';
                try {
                    const parsed = JSON.parse(errorDataStr);
                    serverError = parsed?.error?.message;
                } catch { }

                errorMessage = serverError || `请求参数错误: ${errorDataStr}`;

            } else if (error.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message
            } else if (error.response?.data) {
                // Check if it is stream error (buffer or stream object)
                let errorDataStr = '';
                try {
                    if (error.response.data && typeof error.response.data.on === 'function') { // Stream
                        // Consuming the error stream
                        errorDataStr = await new Promise<string>((resolve) => {
                            const chunks: Buffer[] = [];
                            const stream = error.response.data;
                            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                            stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
                            stream.on('error', () => resolve('[Error reading error stream]'));
                        });
                    } else if (Buffer.isBuffer(error.response.data)) {
                        errorDataStr = error.response.data.toString();
                    } else {
                        errorDataStr = JSON.stringify(error.response.data, null, 2);
                    }
                } catch (e) {
                    errorDataStr = String(error.response.data);
                }


                logger.error('Server response data:', errorDataStr);

                let serverError = '';
                try {
                    const parsed = JSON.parse(errorDataStr);
                    serverError = parsed?.error?.message;
                } catch { }

                errorMessage = serverError || `服务器错误: ${errorDataStr}`;
            } else if (error.message) {
                // 处理其他网络错误
                if (error.message.includes('UNKNOWN')) {
                    errorMessage = '网络连接失败，请检查网络设置'
                } else {
                    errorMessage = error.message
                }
            }
        } else if (error instanceof Error) {
            errorMessage = error.message
        }

        logger.error('OpenAI API call failed', { error: errorMessage, durationMs })

        return {
            success: false,
            error: errorMessage,
            durationMs
        }
    }
}

// 测试连接
export async function testOpenAIConnection(config: OpenAIAdapterConfig): Promise<{ success: boolean; message: string }> {
    try {
        const response = await axios.post(
            config.apiUrl,
            {
                model: config.modelName,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                timeout: 30000
            }
        )

        if (response.data.choices) {
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

/**
 * 清理 API 响应内容，移除开头的无效字符
 */
function cleanResponseContent(content: string): string {
    if (!content) return content

    // 移除开头的 }}, {{, } 或 { 等无效字符（可能是 JSON 格式残留）
    let cleaned = content.trimStart()

    // 处理开头的花括号残留
    while (cleaned.startsWith('}}') || cleaned.startsWith('{{')) {
        cleaned = cleaned.slice(2).trimStart()
    }
    while (cleaned.startsWith('}') || cleaned.startsWith('{')) {
        cleaned = cleaned.slice(1).trimStart()
    }

    return cleaned
}
