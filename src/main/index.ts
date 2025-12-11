import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import path from 'path'
import dns from 'dns'

// 强制优先使用 IPv4，解决部分网络环境下 DNS 解析慢或失败的问题
try {
    dns.setDefaultResultOrder('ipv4first')
} catch (e) {
    console.warn('Failed to set DNS order:', e)
}

import { getDatabase, closeDatabase } from './database'
import * as modelConfigDb from './database/models/modelConfig'
import * as historyDb from './database/models/history'
import * as promptTemplateDb from './database/models/promptTemplate'
import * as settingsDb from './database/models/settings'
import { recognize, testConnection, testConnectionWithConfig } from './services/llmService'
import { processImageForApi, SUPPORTED_FORMATS } from './services/imageService'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: '图片识别工具',
        show: false,
        autoHideMenuBar: true
    })

    // 完全移除菜单栏
    mainWindow.setMenu(null)

    // 开发模式下加载 Vite 开发服务器
    if (process.env.VITE_DEV_SERVER_URL) {
        const devServerUrl = process.env.VITE_DEV_SERVER_URL
        const loadDevServer = async () => {
            try {
                await mainWindow?.loadURL(devServerUrl)
                mainWindow?.webContents.openDevTools()
            } catch (e) {
                logger.error('Failed to load dev server, retrying in 1s...', (e as Error).message)
                setTimeout(loadDevServer, 1000)
            }
        }
        loadDevServer()
    } else {
        // 生产模式：使用 app.getAppPath() 获取正确的应用路径
        const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
        logger.info('Loading production HTML from:', indexPath)

        // 使用 file:// URL 加载
        const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`
        logger.info('File URL:', fileUrl)

        mainWindow.loadURL(fileUrl).catch((err) => {
            logger.error('Failed to load index.html:', err)
        })
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

// 初始化数据库
function initDatabase() {
    try {
        getDatabase()
        logger.info('Database initialized')
    } catch (error) {
        logger.error('Failed to initialize database', error)
    }
}

// 注册 IPC 处理器
function registerIpcHandlers() {
    // ===== 模型配置相关 =====
    ipcMain.handle('config:getAll', () => {
        return modelConfigDb.getAllConfigs()
    })

    ipcMain.handle('config:getActive', () => {
        return modelConfigDb.getActiveConfigs()
    })

    ipcMain.handle('config:getById', (_, id: number) => {
        return modelConfigDb.getConfigById(id)
    })

    ipcMain.handle('config:getDefault', () => {
        return modelConfigDb.getDefaultConfig()
    })

    ipcMain.handle('config:create', (_, input) => {
        return modelConfigDb.createConfig(input)
    })

    ipcMain.handle('config:update', (_, id: number, input) => {
        return modelConfigDb.updateConfig(id, input)
    })

    ipcMain.handle('config:delete', (_, id: number) => {
        return modelConfigDb.deleteConfig(id)
    })

    ipcMain.handle('config:setDefault', (_, id: number) => {
        return modelConfigDb.setDefaultConfig(id)
    })

    ipcMain.handle('config:testConnection', async (_, id: number) => {
        return await testConnection(id)
    })

    ipcMain.handle('config:testConnectionWithData', async (_, data) => {
        return await testConnectionWithConfig(data.provider, data.apiUrl, data.apiKey, data.modelName)
    })

    // ===== 历史记录相关 =====
    ipcMain.handle('history:getRecords', (_, params) => {
        return historyDb.getHistoryRecords(params)
    })

    ipcMain.handle('history:getById', (_, id: number) => {
        return historyDb.getHistoryById(id)
    })

    ipcMain.handle('history:delete', (_, id: number) => {
        return historyDb.deleteHistoryRecord(id)
    })

    ipcMain.handle('history:deleteMultiple', (_, ids: number[]) => {
        return historyDb.deleteHistoryRecords(ids)
    })

    ipcMain.handle('history:clearAll', () => {
        return historyDb.clearAllHistory()
    })

    ipcMain.handle('history:export', (_, params) => {
        return historyDb.exportHistory(params)
    })

    // ===== 提示词模板相关 =====
    ipcMain.handle('template:getAll', () => {
        return promptTemplateDb.getAllTemplates()
    })

    ipcMain.handle('template:getDefault', () => {
        return promptTemplateDb.getDefaultTemplate()
    })

    ipcMain.handle('template:getRecent', (_, limit?: number) => {
        return promptTemplateDb.getRecentTemplates(limit)
    })

    ipcMain.handle('template:create', (_, name: string, content: string, isDefault?: boolean) => {
        return promptTemplateDb.createTemplate(name, content, isDefault)
    })

    ipcMain.handle('template:update', (_, id: number, updates) => {
        return promptTemplateDb.updateTemplate(id, updates)
    })

    ipcMain.handle('template:delete', (_, id: number) => {
        return promptTemplateDb.deleteTemplate(id)
    })

    ipcMain.handle('template:incrementUse', (_, id: number) => {
        promptTemplateDb.incrementTemplateUseCount(id)
    })

    // ===== 设置相关 =====
    ipcMain.handle('settings:getAll', () => {
        return settingsDb.getAllSettings()
    })

    ipcMain.handle('settings:update', (_, updates) => {
        return settingsDb.updateSettings(updates)
    })

    ipcMain.handle('settings:reset', () => {
        return settingsDb.resetSettings()
    })

    // ===== 识别相关 =====
    ipcMain.handle('recognition:recognize', async (event, data) => {
        const { configId, imageData, imageMimeType, prompt, options } = data

        try {
            // 读取设置，判断是否开启压缩
            const settings = settingsDb.getAllSettings()
            const autoCompress = settings.autoCompress !== false // 默认开启
            // 默认阈值 2MB，如果设置中有则使用设置值 (KB -> Bytes)
            const thresholdBytes = (settings.compressThreshold || 2048) * 1024

            // 将 base64 转为 buffer 进行处理
            const processed = await processImageForApi(
                `data:${imageMimeType};base64,${imageData}`,
                autoCompress,
                thresholdBytes
            )

            // 如果压缩失败或返回了不同的 MIME 类型，使用新的
            const finalMimeType = processed.mimeType || imageMimeType || 'image/jpeg'

            const result = await recognize(
                configId,
                processed.base64,
                finalMimeType,
                prompt,
                {
                    ...options,
                    onProgress: (content) => {
                        console.log('[IPC] Sending stream chunk:', content)
                        event.sender.send('recognition:stream-chunk', content)
                    }
                }
            )

            // 如果发生了压缩，将处理后的图片返回给前端显示
            if (processed.wasCompressed) {
                result.processedImage = processed.base64
            }

            return result
        } catch (error) {
            logger.error('Recognition failed', error)
            return {
                success: false,
                error: (error as Error).message
            }
        }
    })

    // ===== 图片选择 =====
    ipcMain.handle('dialog:selectImage', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openFile'],
            filters: [
                { name: '图片', extensions: SUPPORTED_FORMATS }
            ]
        })

        if (result.canceled || result.filePaths.length === 0) {
            return null
        }

        const filePath = result.filePaths[0]
        const fs = await import('fs')
        const buffer = fs.readFileSync(filePath)
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

        return {
            base64: buffer.toString('base64'),
            mimeType,
            fileName: path.basename(filePath)
        }
    })

    // ===== 剪贴板 =====
    ipcMain.handle('clipboard:readImage', () => {
        const image = clipboard.readImage()
        if (image.isEmpty()) {
            return null
        }

        const buffer = image.toPNG()
        return {
            base64: buffer.toString('base64'),
            mimeType: 'image/png'
        }
    })

    ipcMain.handle('clipboard:writeText', (_, text: string) => {
        clipboard.writeText(text)
    })

    // ===== 导出文件 =====
    ipcMain.handle('dialog:saveFile', async (_, options: { content: string; defaultName: string; filters: { name: string; extensions: string[] }[] }) => {
        const result = await dialog.showSaveDialog(mainWindow!, {
            defaultPath: options.defaultName,
            filters: options.filters
        })

        if (result.canceled || !result.filePath) {
            return false
        }

        const fs = await import('fs')
        fs.writeFileSync(result.filePath, options.content, 'utf-8')
        return true
    })
}

app.whenReady().then(() => {
    initDatabase()
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    closeDatabase()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    closeDatabase()
})
