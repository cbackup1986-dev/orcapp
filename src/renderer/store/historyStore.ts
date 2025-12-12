import { create } from 'zustand'
import { api } from '../api'
import type { HistoryRecord, HistoryQueryParams, HistoryPaginatedResult } from '@shared/types'

interface HistoryState {
    records: HistoryRecord[]
    total: number
    page: number
    pageSize: number
    loading: boolean
    error: string | null
    selectedRecord: HistoryRecord | null

    // 筛选参数
    filters: {
        startDate?: string
        endDate?: string
        configId?: number
        keyword?: string
    }

    // Actions
    fetchRecords: (params?: HistoryQueryParams) => Promise<void>
    setPage: (page: number) => void
    setPageSize: (pageSize: number) => void
    setFilters: (filters: Partial<HistoryState['filters']>) => void
    clearFilters: () => void
    selectRecord: (record: HistoryRecord | null) => void
    deleteRecord: (id: number) => Promise<boolean>
    deleteRecords: (ids: number[]) => Promise<number>
    clearAll: () => Promise<number>
    exportRecords: () => Promise<HistoryRecord[]>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
    records: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    error: null,
    selectedRecord: null,
    filters: {},

    fetchRecords: async (params?: HistoryQueryParams) => {
        const state = get()
        set({ loading: true, error: null })

        try {
            const queryParams: HistoryQueryParams = {
                page: params?.page ?? state.page,
                pageSize: params?.pageSize ?? state.pageSize,
                ...state.filters,
                ...params
            }

            const result: HistoryPaginatedResult = await api.history.getRecords(queryParams)

            set({
                records: result.records,
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
                loading: false
            })
        } catch (error) {
            set({ error: (error as Error).message, loading: false })
        }
    },

    setPage: (page) => {
        set({ page })
        get().fetchRecords({ page })
    },

    setPageSize: (pageSize) => {
        set({ pageSize, page: 1 })
        get().fetchRecords({ pageSize, page: 1 })
    },

    setFilters: (filters) => {
        set({ filters: { ...get().filters, ...filters }, page: 1 })
        get().fetchRecords({ page: 1 })
    },

    clearFilters: () => {
        set({ filters: {}, page: 1 })
        get().fetchRecords({ page: 1 })
    },

    selectRecord: (record) => set({ selectedRecord: record }),

    deleteRecord: async (id) => {
        const result = await api.history.delete(id)
        if (result) {
            await get().fetchRecords()
            if (get().selectedRecord?.id === id) {
                set({ selectedRecord: null })
            }
        }
        return result
    },

    deleteRecords: async (ids) => {
        const result = await api.history.deleteMultiple(ids)
        if (result > 0) {
            await get().fetchRecords()
            if (get().selectedRecord && ids.includes(get().selectedRecord!.id)) {
                set({ selectedRecord: null })
            }
        }
        return result
    },

    clearAll: async () => {
        const result = await api.history.clearAll()
        if (result > 0) {
            set({ records: [], total: 0, page: 1, selectedRecord: null })
        }
        return result
    },

    exportRecords: async () => {
        return await api.history.export(get().filters)
    }
}))
