// 识别请求参数
export interface RecognitionRequest {
    configId: number
    imageBase64: string
    imageMimeType: string
    prompt: string
    temperature?: number
    topP?: number
    maxTokens?: number
    stream?: boolean
    customParams?: Record<string, string | number | boolean>
    detailLevel?: 'concise' | 'standard' | 'detailed'
}

// 识别结果
export interface RecognitionResult {
    success: boolean
    content?: string
    error?: string
    tokensUsed?: number
    durationMs?: number
    processedImage?: string // 如果图片被压缩/处理，返回处理后的图片数据
}

// 识别状态
export type RecognitionStatus = 'idle' | 'uploading' | 'analyzing' | 'completed' | 'error'

// OpenAI 消息格式
export interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system'
    content: OpenAIContent[]
}

export type OpenAIContent =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }

// OpenAI 请求格式
export interface OpenAIRequest {
    model: string
    messages: OpenAIMessage[]
    max_tokens: number
    temperature?: number
    top_p?: number
}

// Anthropic 消息格式
export interface AnthropicContent {
    type: 'text' | 'image'
    text?: string
    source?: {
        type: 'base64'
        media_type: string
        data: string
    }
}

export interface AnthropicMessage {
    role: 'user' | 'assistant'
    content: AnthropicContent[]
}

// Anthropic 请求格式
export interface AnthropicRequest {
    model: string
    max_tokens: number
    messages: AnthropicMessage[]
    temperature?: number
    top_p?: number
}
