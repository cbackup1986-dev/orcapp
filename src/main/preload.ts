import { contextBridge, ipcRenderer } from 'electron'
import type {
    ModelConfigInput,
    ModelConfigListItem,
    ModelConfig,
    HistoryQueryParams,
    HistoryPaginatedResult,
    HistoryRecord,
    PromptTemplate,
    AppSettings,
    RecognitionResult,
    ProviderType,
    RecognitionRequest
} from '../shared/types'

// 暴露给渲染进程的 API
const electronAPI = {
    // ===== 模型配置 =====
    config: {
        getAll: (): Promise<ModelConfigListItem[]> =>
            ipcRenderer.invoke('config:getAll'),
        getActive: (): Promise<ModelConfigListItem[]> =>
            ipcRenderer.invoke('config:getActive'),
        getById: (id: number): Promise<ModelConfig | null> =>
            ipcRenderer.invoke('config:getById', id),
        getDefault: (): Promise<ModelConfig | null> =>
            ipcRenderer.invoke('config:getDefault'),
        create: (input: ModelConfigInput): Promise<ModelConfigListItem> =>
            ipcRenderer.invoke('config:create', input),
        update: (id: number, input: Partial<ModelConfigInput>): Promise<ModelConfigListItem | null> =>
            ipcRenderer.invoke('config:update', id, input),
        delete: (id: number): Promise<boolean> =>
            ipcRenderer.invoke('config:delete', id),
        setDefault: (id: number): Promise<boolean> =>
            ipcRenderer.invoke('config:setDefault', id),
        testConnection: (id: number): Promise<{ success: boolean; message: string }> =>
            ipcRenderer.invoke('config:testConnection', id),
        testConnectionWithData: (data: { provider: ProviderType; apiUrl: string; apiKey: string; modelName: string }): Promise<{ success: boolean; message: string }> =>
            ipcRenderer.invoke('config:testConnectionWithData', data)
    },

    // ===== 历史记录 =====
    history: {
        getRecords: (params?: HistoryQueryParams): Promise<HistoryPaginatedResult> =>
            ipcRenderer.invoke('history:getRecords', params),
        getById: (id: number): Promise<HistoryRecord | null> =>
            ipcRenderer.invoke('history:getById', id),
        delete: (id: number): Promise<boolean> =>
            ipcRenderer.invoke('history:delete', id),
        deleteMultiple: (ids: number[]): Promise<number> =>
            ipcRenderer.invoke('history:deleteMultiple', ids),
        clearAll: (): Promise<number> =>
            ipcRenderer.invoke('history:clearAll'),
        export: (params?: HistoryQueryParams): Promise<HistoryRecord[]> =>
            ipcRenderer.invoke('history:export', params)
    },

    // ===== 提示词模板 =====
    template: {
        getAll: (): Promise<PromptTemplate[]> =>
            ipcRenderer.invoke('template:getAll'),
        getDefault: (): Promise<PromptTemplate | null> =>
            ipcRenderer.invoke('template:getDefault'),
        getRecent: (limit?: number): Promise<PromptTemplate[]> =>
            ipcRenderer.invoke('template:getRecent', limit),
        create: (name: string, content: string, isDefault?: boolean): Promise<PromptTemplate> =>
            ipcRenderer.invoke('template:create', name, content, isDefault),
        update: (id: number, updates: { name?: string; content?: string; isDefault?: boolean }): Promise<PromptTemplate | null> =>
            ipcRenderer.invoke('template:update', id, updates),
        delete: (id: number): Promise<boolean> =>
            ipcRenderer.invoke('template:delete', id),
        incrementUse: (id: number): Promise<void> =>
            ipcRenderer.invoke('template:incrementUse', id)
    },

    // ===== 设置 =====
    settings: {
        getAll: (): Promise<AppSettings> =>
            ipcRenderer.invoke('settings:getAll'),
        update: (updates: Partial<AppSettings>): Promise<AppSettings> =>
            ipcRenderer.invoke('settings:update', updates),
        reset: (): Promise<AppSettings> =>
            ipcRenderer.invoke('settings:reset')
    },

    // ===== 识别 =====
    recognition: {
        recognize: (data: RecognitionRequest): Promise<RecognitionResult> =>
            ipcRenderer.invoke('recognition:recognize', data),
        onStreamChunk: (callback: (content: string) => void) => {
            const subscription = (_: any, content: string) => callback(content)
            ipcRenderer.on('recognition:stream-chunk', subscription)
            return () => {
                ipcRenderer.removeListener('recognition:stream-chunk', subscription)
            }
        }
    },

    // ===== 对话框 =====
    dialog: {
        selectImage: (): Promise<{ base64: string; mimeType: string; fileName: string } | null> =>
            ipcRenderer.invoke('dialog:selectImage'),
        saveFile: (options: { content: string; defaultName: string; filters: { name: string; extensions: string[] }[] }): Promise<boolean> =>
            ipcRenderer.invoke('dialog:saveFile', options)
    },

    // ===== 剪贴板 =====
    clipboard: {
        readImage: (): Promise<{ base64: string; mimeType: string } | null> =>
            ipcRenderer.invoke('clipboard:readImage'),
        writeText: (text: string): Promise<void> =>
            ipcRenderer.invoke('clipboard:writeText', text)
    }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型声明
export type ElectronAPI = typeof electronAPI
