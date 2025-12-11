import CryptoJS from 'crypto-js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// 获取加密密钥（从配置文件或生成新的）
function getEncryptionKey(): string {
    const configDir = path.join(app.getPath('userData'), '.image-recognition')
    const keyFile = path.join(configDir, '.key')

    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }

    if (fs.existsSync(keyFile)) {
        return fs.readFileSync(keyFile, 'utf-8')
    }

    // 生成新的随机密钥
    const key = CryptoJS.lib.WordArray.random(32).toString()
    fs.writeFileSync(keyFile, key, { mode: 0o600 })
    return key
}

let encryptionKey: string | null = null

function getKey(): string {
    if (!encryptionKey) {
        encryptionKey = getEncryptionKey()
    }
    return encryptionKey
}

/**
 * 使用 AES-256 加密字符串
 */
export function encrypt(text: string): string {
    const key = getKey()
    return CryptoJS.AES.encrypt(text, key).toString()
}

/**
 * 解密 AES-256 加密的字符串
 */
export function decrypt(ciphertext: string): string {
    const key = getKey()
    const bytes = CryptoJS.AES.decrypt(ciphertext, key)
    return bytes.toString(CryptoJS.enc.Utf8)
}

/**
 * 对 API Key 进行脱敏处理
 * 例如: sk-1234567890abcdef -> sk-***cdef
 */
export function maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
        return '***'
    }

    const prefix = apiKey.slice(0, 3)
    const suffix = apiKey.slice(-4)
    return `${prefix}***${suffix}`
}
