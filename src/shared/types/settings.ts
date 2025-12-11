// 提示词模板
export interface PromptTemplate {
    id: number
    name: string
    content: string
    isDefault: boolean
    useCount: number
    createdAt: string
}

// 应用设置
export interface AppSettings {
    theme: 'light' | 'dark' | 'system'
    language: 'zh-CN' | 'en-US'
    imageMaxSize: number // MB
    compressThreshold: number // KB
    autoCompress: boolean
    defaultTemperature: number
    defaultTopP: number
    defaultMaxTokens: number
    defaultStream: boolean
}

// 默认设置
export const DEFAULT_SETTINGS: AppSettings = {
    theme: 'system',
    language: 'zh-CN',
    imageMaxSize: 10,
    compressThreshold: 2048, // 2MB
    autoCompress: true,
    defaultTemperature: 0,
    defaultTopP: 0.4,
    defaultMaxTokens: 2048,
    defaultStream: true
}

// 默认提示词
export const DEFAULT_PROMPTS: Omit<PromptTemplate, 'id' | 'useCount' | 'createdAt'>[] = [
    {
        name: '详细描述',
        content: '请详细描述这张图片的内容，包括主要物体、场景、颜色、构图等细节。',
        isDefault: true
    },
    {
        name: '文字提取 (OCR)',
        content: '请提取图片中的所有文字，保持原有格式和布局。',
        isDefault: false
    },
    {
        name: '简洁描述',
        content: '请用一句话简洁地描述这张图片的主要内容。',
        isDefault: false
    },
    {
        name: '物体识别',
        content: '请列出图片中出现的所有主要物体，并描述它们的位置关系。',
        isDefault: false
    },
    {
        name: '场景分析',
        content: '请分析这张图片的场景类型、拍摄环境、光线条件等信息。',
        isDefault: false
    }
]
