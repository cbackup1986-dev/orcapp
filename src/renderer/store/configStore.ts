import { create } from 'zustand'
import { api } from '../api'
import type { ModelConfigListItem, ModelConfig, ModelConfigInput } from '@shared/types'

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
    createConfig: (input: ModelConfigInput) => Promise<ModelConfigListItem>
    updateConfig: (id: number, input: Partial<ModelConfigInput>) => Promise<ModelConfigListItem | null>
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
            const configs = await api.config.getAll()
            set({ configs, loading: false })
        } catch (error) {
            set({ error: (error as Error).message, loading: false })
        }
    },

    fetchActiveConfigs: async () => {
        try {
            const activeConfigs = await api.config.getActive()
            set({ activeConfigs })
        } catch (error) {
            console.error('Failed to fetch active configs', error)
        }
    },

    fetchDefaultConfig: async () => {
        try {
            const defaultConfig = await api.config.getDefault()
            set({ defaultConfig })
        } catch (error) {
            console.error('Failed to fetch default config', error)
        }
    },

    createConfig: async (input) => {
        const config = await api.config.create(input)
        await get().fetchConfigs()
        await get().fetchActiveConfigs()
        return config
    },

    updateConfig: async (id, input) => {
        const config = await api.config.update(id, input)
        await get().fetchConfigs()
        await get().fetchActiveConfigs()
        if (get().defaultConfig?.id === id) {
            await get().fetchDefaultConfig()
        }
        return config
    },

    deleteConfig: async (id) => {
        const result = await api.config.delete(id)
        if (result) {
            await get().fetchConfigs()
            await get().fetchActiveConfigs()
        }
        return result
    },

    setDefaultConfig: async (id) => {
        const result = await api.config.setDefault(id)
        if (result) {
            await get().fetchConfigs()
            await get().fetchDefaultConfig()
        }
        return result
    },

    testConnection: async (id) => {
        return await api.config.testConnection(id)
    }
}))
