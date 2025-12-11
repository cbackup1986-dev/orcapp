import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
    private logDir: string
    private currentLogFile: string

    constructor() {
        this.logDir = path.join(app.getPath('userData'), '.image-recognition', 'logs')
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true })
        }
        this.currentLogFile = this.getLogFileName()
    }

    private getLogFileName(): string {
        const date = new Date().toISOString().split('T')[0]
        return path.join(this.logDir, `${date}.log`)
    }

    private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
        const timestamp = new Date().toISOString()
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`
    }

    private write(level: LogLevel, message: string, meta?: unknown) {
        const logFile = this.getLogFileName()
        if (logFile !== this.currentLogFile) {
            this.currentLogFile = logFile
        }

        const formattedMessage = this.formatMessage(level, message, meta)

        // 写入文件
        fs.appendFileSync(this.currentLogFile, formattedMessage)

        // 同时输出到控制台
        if (level === 'error') {
            console.error(formattedMessage.trim())
        } else if (level === 'warn') {
            console.warn(formattedMessage.trim())
        } else {
            console.log(formattedMessage.trim())
        }
    }

    debug(message: string, meta?: unknown) {
        this.write('debug', message, meta)
    }

    info(message: string, meta?: unknown) {
        this.write('info', message, meta)
    }

    warn(message: string, meta?: unknown) {
        this.write('warn', message, meta)
    }

    error(message: string, meta?: unknown) {
        this.write('error', message, meta)
    }

    // 记录 API 调用
    logApiCall(provider: string, request: unknown, response: unknown, durationMs: number) {
        this.info(`API Call to ${provider}`, {
            request: this.sanitizeRequest(request),
            response: this.sanitizeResponse(response),
            durationMs
        })
    }

    // 移除敏感信息
    private sanitizeRequest(request: unknown): unknown {
        if (typeof request !== 'object' || request === null) return request
        const sanitized = { ...request as Record<string, unknown> }
        if ('apiKey' in sanitized) {
            sanitized.apiKey = '***'
        }
        return sanitized
    }

    private sanitizeResponse(response: unknown): unknown {
        if (typeof response !== 'object' || response === null) return response
        return response
    }
}

export const logger = new Logger()
