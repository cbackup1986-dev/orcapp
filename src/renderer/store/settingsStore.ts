import { create } from 'zustand'
import { api } from '../api'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

interface SettingsState extends AppSettings {
    loading: boolean
    initialized: boolean

    // Actions
    loadSettings: () => Promise<void>
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>
    resetSettings: () => Promise<void>
    setTheme: (theme: AppSettings['theme']) => Promise<void>
    setLanguage: (language: AppSettings['language']) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    ...DEFAULT_SETTINGS,
    loading: false,
    initialized: false,

    loadSettings: async () => {
        set({ loading: true })
        try {
            const settings = await api.settings.getAll()
            set({ ...settings, initialized: true })
        } catch (error) {
            console.error('Failed to load settings:', error)
        } finally {
            set({ loading: false })
        }
    },

    updateSettings: async (updates) => {
        set({ loading: true })
        try {
            const newSettings = await api.settings.update(updates)
            set({ ...newSettings })
        } catch (error) {
            console.error('Failed to update settings:', error)
        } finally {
            set({ loading: false })
        }
    },

    resetSettings: async () => {
        set({ loading: true })
        try {
            const defaults = await api.settings.reset()
            set({ ...defaults })
        } catch (error) {
            console.error('Failed to reset settings:', error)
        } finally {
            set({ loading: false })
        }
    },

    setTheme: async (theme) => {
        await get().updateSettings({ theme })
    },

    setLanguage: async (language) => {
        await get().updateSettings({ language })
    }
}))
