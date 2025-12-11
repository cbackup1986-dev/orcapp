import { create } from 'zustand'
import type { ModelConfigListItem, ModelConfig } from '@shared/types'

interface ConfigState {
    configs: ModelConfigListItem[]
    activeConfigs: ModelConfigListItem[]
    defaultConfig: ModelConfig | null
    loading: boolean
    error: string | null

    // Actions
    fetchConfigs: () => Promise<void>
    fetchActiveConfigs: () => Promise<void>
    fetchDefaultConfig: () => Promise<void>
    createConfig: (input: Parameters<typeof window.electronAPI.config.create>[0]) => Promise<ModelConfigListItem>
    updateConfig: (id: number, input: Parameters<typeof window.electronAPI.config.update>[1]) => Promise<ModelConfigListItem | null>
    deleteConfig: (id: number) => Promise<boolean>
    setDefaultConfig: (id: number) => Promise<boolean>
    testConnection: (id: number) => Promise<{ success: boolean; message: string }>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
    configs: [],
    activeConfigs: [],
    defaultConfig: null,
    loading: false,
    error: null,

    fetchConfigs: async () => {
        set({ loading: true, error: null })
        try {
            const configs = await window.electronAPI.config.getAll()
            set({ configs, loading: false })
        } catch (error) {
            set({ error: (error as Error).message, loading: false })
        }
    },

    fetchActiveConfigs: async () => {
        try {
            const activeConfigs = await window.electronAPI.config.getActive()
            set({ activeConfigs })
        } catch (error) {
            console.error('Failed to fetch active configs', error)
        }
    },

    fetchDefaultConfig: async () => {
        try {
            const defaultConfig = await window.electronAPI.config.getDefault()
            set({ defaultConfig })
        } catch (error) {
            console.error('Failed to fetch default config', error)
        }
    },

    createConfig: async (input) => {
        const config = await window.electronAPI.config.create(input)
        await get().fetchConfigs()
        await get().fetchActiveConfigs()
        return config
    },

    updateConfig: async (id, input) => {
        const config = await window.electronAPI.config.update(id, input)
        await get().fetchConfigs()
        await get().fetchActiveConfigs()
        if (get().defaultConfig?.id === id) {
            await get().fetchDefaultConfig()
        }
        return config
    },

    deleteConfig: async (id) => {
        const result = await window.electronAPI.config.delete(id)
        if (result) {
            await get().fetchConfigs()
            await get().fetchActiveConfigs()
        }
        return result
    },

    setDefaultConfig: async (id) => {
        const result = await window.electronAPI.config.setDefault(id)
        if (result) {
            await get().fetchConfigs()
            await get().fetchDefaultConfig()
        }
        return result
    },

    testConnection: async (id) => {
        return await window.electronAPI.config.testConnection(id)
    }
}))
