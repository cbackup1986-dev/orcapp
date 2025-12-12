// API layer for Tauri
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
    ProviderType
} from '../shared/types';

// Internal RecognitionRequest that matches Rust backend
interface TauriRecognitionRequest {
    configId: number;
    imageData: string;
    imageMimeType: string;
    prompt: string;
    options?: {
        temperature?: number;
        topP?: number;
        maxTokens?: number;
        stream?: boolean;
        customParams?: Record<string, string | number | boolean>;
    };
}

// API implementation using Tauri
export const api = {
    // ===== 模型配置 =====
    config: {
        getAll: (): Promise<ModelConfigListItem[]> =>
            invoke('get_all_configs'),
        getActive: (): Promise<ModelConfigListItem[]> =>
            invoke('get_active_configs'),
        getById: (id: number): Promise<ModelConfig | null> =>
            invoke('get_config_by_id', { id }),
        getDefault: (): Promise<ModelConfig | null> =>
            invoke('get_default_config'),
        create: (input: ModelConfigInput): Promise<ModelConfigListItem> =>
            invoke('create_config', { input }),
        update: (id: number, input: Partial<ModelConfigInput>): Promise<ModelConfigListItem | null> =>
            invoke('update_config', { id, input }),
        delete: (id: number): Promise<boolean> =>
            invoke('delete_config', { id }),
        setDefault: (id: number): Promise<boolean> =>
            invoke('set_default_config', { id }),
        testConnection: (id: number): Promise<{ success: boolean; message: string }> =>
            invoke('test_connection', { id }),
        testConnectionWithData: (data: { provider: ProviderType; apiUrl: string; apiKey: string; modelName: string }): Promise<{ success: boolean; message: string }> =>
            invoke('test_connection_with_data', { data })
    },

    // ===== 历史记录 =====
    history: {
        getRecords: (params?: HistoryQueryParams): Promise<HistoryPaginatedResult> =>
            invoke('get_history_records', { params }),
        getById: (id: number): Promise<HistoryRecord | null> =>
            invoke('get_history_by_id', { id }),
        delete: (id: number): Promise<boolean> =>
            invoke('delete_history', { id }),
        deleteMultiple: (ids: number[]): Promise<number> =>
            invoke('delete_multiple_history', { ids }),
        clearAll: (): Promise<number> =>
            invoke('clear_all_history'),
        export: (params?: HistoryQueryParams): Promise<HistoryRecord[]> =>
            invoke('export_history', { params })
    },

    // ===== 提示词模板 =====
    template: {
        getAll: (): Promise<PromptTemplate[]> =>
            invoke('get_all_templates'),
        getDefault: (): Promise<PromptTemplate | null> =>
            invoke('get_default_template'),
        getRecent: (limit?: number): Promise<PromptTemplate[]> =>
            invoke('get_recent_templates', { limit }),
        create: (name: string, content: string, isDefault?: boolean): Promise<PromptTemplate> =>
            invoke('create_template', { name, content, isDefault }),
        update: (id: number, updates: { name?: string; content?: string; isDefault?: boolean }): Promise<PromptTemplate | null> =>
            invoke('update_template', { id, updates }),
        delete: (id: number): Promise<boolean> =>
            invoke('delete_template', { id }),
        incrementUse: (id: number): Promise<void> =>
            invoke('increment_template_use', { id })
    },

    // ===== 设置 =====
    settings: {
        getAll: (): Promise<AppSettings> =>
            invoke('get_all_settings'),
        update: (updates: Partial<AppSettings>): Promise<AppSettings> =>
            invoke('update_settings', { updates }),
        reset: (): Promise<AppSettings> =>
            invoke('reset_settings')
    },

    // ===== 识别 =====
    recognition: {
        recognize: (data: TauriRecognitionRequest): Promise<RecognitionResult> =>
            invoke('recognize', { data }),
        onStreamChunk: async (callback: (content: string) => void) => {
            const unlisten = await listen<string>('recognition-stream', (event) => {
                console.log('[API] Stream event received:', event);
                callback(event.payload);
            });
            return unlisten;
        }
    },

    // ===== 对话框 =====
    dialog: {
        selectImage: (): Promise<{ base64: string; mimeType: string; fileName: string } | null> =>
            invoke('select_image'),
        saveFile: (options: { content: string; defaultName: string; filters: { name: string; extensions: string[] }[] }): Promise<boolean> =>
            invoke('save_file', { options })
    },

    // ===== 剪贴板 =====
    clipboard: {
        readImage: (): Promise<{ base64: string; mimeType: string } | null> =>
            invoke('read_clipboard_image'),
        writeText: (text: string): Promise<void> =>
            invoke('write_clipboard_text', { text })
    }
};

export default api;
