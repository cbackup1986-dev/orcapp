import { create } from 'zustand'
import { api } from '../api'
import type { RecognitionResult, RecognitionStatus } from '@shared/types'

interface RecognitionState {
    // 图片数据
    imageData: string | null  // base64 (当前显示的图片)
    originalImageData: string | null // 原始图片
    processedImageData: string | null // 处理后的图片
    imageMimeType: string | null
    imageFileName: string | null
    showProcessed: boolean // 是否显示处理后的图片

    // 识别参数
    selectedConfigId: number | null
    prompt: string
    temperature: number
    topP: number
    maxTokens: number
    stream: boolean
    customParams: Array<{ id: string; key: string; value: string }>

    // 识别状态
    status: RecognitionStatus
    result: RecognitionResult | null
    isAborting: boolean

    // Actions
    setImage: (data: string | null, mimeType: string | null, fileName?: string | null) => void
    clearImage: () => void
    setConfigId: (id: number | null) => void
    setPrompt: (prompt: string) => void
    setTemperature: (value: number) => void
    setTopP: (value: number) => void
    setMaxTokens: (value: number) => void
    setStream: (value: boolean) => void
    setCustomParams: (params: Array<{ id: string; key: string; value: string }>) => void
    loadSettings: () => Promise<void>
    recognize: () => Promise<RecognitionResult>
    cancelRecognition: () => Promise<void>
    reset: () => void
    toggleProcessedImage: (show: boolean) => void
}

const DEFAULT_PROMPT = '请详细描述这张图片的内容，包括主要物体、场景、颜色、构图等细节。'

export const useRecognitionStore = create<RecognitionState>((set, get) => ({
    imageData: null,
    originalImageData: null,
    processedImageData: null,
    imageMimeType: null,
    imageFileName: null,
    showProcessed: false,

    selectedConfigId: null,
    prompt: DEFAULT_PROMPT,
    temperature: 0,
    topP: 0.4,
    maxTokens: 2048,
    stream: true,
    customParams: [],
    status: 'idle',
    result: null,
    isAborting: false,

    setImage: (data, mimeType, fileName = null) => {
        set({
            imageData: data,
            originalImageData: data,
            processedImageData: null,
            imageMimeType: mimeType,
            imageFileName: fileName,
            showProcessed: false,
            status: 'idle',
            result: null
        })
    },

    clearImage: () => {
        set({
            imageData: null,
            originalImageData: null,
            processedImageData: null,
            imageMimeType: null,
            imageFileName: null,
            showProcessed: false,
            status: 'idle',
            result: null
        })
    },

    toggleProcessedImage: (show) => {
        const state = get()
        if (show) {
            // 如果要显示处理后的图，但没有处理后的图，则显示原图（视作一致）
            const targetData = state.processedImageData || state.originalImageData
            set({ imageData: targetData, showProcessed: true })
        } else {
            set({ imageData: state.originalImageData, showProcessed: false })
        }
    },

    setConfigId: (id) => set({ selectedConfigId: id }),
    setPrompt: (prompt) => set({ prompt }),
    setTemperature: (temperature) => set({ temperature }),
    setTopP: (topP) => set({ topP }),
    setMaxTokens: (maxTokens) => set({ maxTokens }),
    setStream: (stream) => set({ stream }),
    setCustomParams: (customParams) => set({ customParams }),

    loadSettings: async () => {
        try {
            const settings = await api.settings.getAll()
            set({
                temperature: (settings as any).defaultTemperature ?? 0,
                topP: (settings as any).defaultTopP ?? 0.4,
                maxTokens: (settings as any).defaultMaxTokens ?? 2048,
                stream: (settings as any).defaultStream ?? true
            })
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    },

    recognize: async () => {
        const state = get()

        if (!state.imageData || !state.imageMimeType) {
            throw new Error('请先上传图片')
        }

        if (!state.selectedConfigId) {
            throw new Error('请选择模型配置')
        }

        if (!state.prompt.trim()) {
            throw new Error('请输入提示词')
        }

        set({ status: 'uploading' })

        // Note: Streaming is not yet implemented in Tauri version
        // For now, we'll use non-streaming mode
        // Note: Streaming is implemented via Tauri events
        let removeListener: (() => void) | undefined;

        try {
            removeListener = await api.recognition.onStreamChunk((content: string) => {
                console.log('[Stream] Received chunk:', content)
                set((prev) => ({
                    result: {
                        ...prev.result,
                        success: true,
                        content: (prev.result?.content || '') + content
                    }
                }))
            })

            set({
                status: 'analyzing',
                result: { success: true, content: '' }
            })

            // 转换 customParams 为对象
            const customParamsRecord: Record<string, string | number | boolean> = {}
            state.customParams.forEach(p => {
                if (p.key) {
                    let val: string | number | boolean = p.value
                    if (val === 'true') val = true
                    else if (val === 'false') val = false
                    else if (!isNaN(Number(val)) && val !== '') val = Number(val)
                    customParamsRecord[p.key] = val
                }
            })

            console.log('[Recognition] About to call recognize with:');
            console.log('[Recognition] Prompt:', state.prompt);
            console.log('[Recognition] Prompt length:', state.prompt.length);

            const result = await api.recognition.recognize({
                configId: state.selectedConfigId,
                imageData: state.originalImageData || state.imageData, // 优先使用原图
                imageMimeType: state.imageMimeType,
                prompt: state.prompt,
                options: {
                    temperature: state.temperature,
                    topP: state.topP,
                    maxTokens: state.maxTokens,
                    stream: state.stream,
                    customParams: customParamsRecord
                }
            })

            if (result.processedImage) {
                set({
                    processedImageData: result.processedImage,
                    showProcessed: true,
                    imageData: result.processedImage
                })
            }

            if (!state.stream || result.success) {
                set({
                    status: result.success ? 'completed' : 'error',
                    result
                })
            } else {
                set({ status: 'completed' })
            }

            return result
        } catch (error) {
            console.error('[Recognition Error]', error);
            const errorMessage = (error as Error).message || String(error)

            // Don't show error for cancellation
            if (errorMessage.includes('取消')) {
                set({ status: 'idle', result: null })
                return { success: false, error: errorMessage }
            }

            const result: RecognitionResult = {
                success: false,
                error: errorMessage
            }
            set({ status: 'error', result })
            return result
        } finally {
            if (removeListener) {
                removeListener()
            }
            set({ isAborting: false })
        }
    },

    cancelRecognition: async () => {
        const state = get()
        if (state.status === 'uploading' || state.status === 'analyzing') {
            set({ isAborting: true })
            try {
                await api.recognition.cancel()
                console.log('[Recognition] Cancelled successfully')
            } catch (error) {
                console.error('[Recognition] Cancel failed:', error)
            }
        }
    },

    reset: () => {
        set({
            imageData: null,
            originalImageData: null,
            processedImageData: null,
            imageMimeType: null,
            imageFileName: null,
            showProcessed: false,
            status: 'idle',
            result: null,
            prompt: DEFAULT_PROMPT
        })
    }
}))
