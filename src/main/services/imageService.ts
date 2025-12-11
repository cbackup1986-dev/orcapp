import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// 支持的图片格式
export const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * 从文件路径读取图片并转为 Base64
 */
export async function imageFileToBase64(filePath: string): Promise<{
    base64: string
    mimeType: string
    originalSize: number
    compressedSize?: number
}> {
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase().slice(1)
    const mimeType = getMimeType(ext)

    return {
        base64: buffer.toString('base64'),
        mimeType,
        originalSize: buffer.length
    }
}

/**
 * 压缩图片（优先无损 PNG，必要时才用有损 JPEG）
 */
export async function compressImage(
    inputBuffer: Buffer,
    maxSizeBytes: number = 2 * 1024 * 1024, // 2MB
    maxDimension: number = 1920 // 提高至 1920px
): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
        let image = sharp(inputBuffer)
        const metadata = await image.metadata()

        // 验证图片元数据
        if (!metadata.width || !metadata.height) {
            // 无法读取元数据，返回原图
            return {
                buffer: inputBuffer,
                mimeType: 'image/jpeg'
            }
        }

        // 调整尺寸（无损）
        if (metadata.width > maxDimension || metadata.height > maxDimension) {
            image = image.resize(maxDimension, maxDimension, {
                fit: 'inside',
                withoutEnlargement: true
            })
        }

        // 首先尝试 PNG（无损压缩）
        let outputBuffer = await image
            .png({ compressionLevel: 9 })
            .toBuffer()

        // 验证输出有效性
        const outputMeta = await sharp(outputBuffer).metadata()
        if (!outputMeta.width || !outputMeta.height) {
            // 压缩后图片无效，返回原图
            return {
                buffer: inputBuffer,
                mimeType: 'image/jpeg'
            }
        }

        // 如果 PNG 大小可接受，返回 PNG
        if (outputBuffer.length <= maxSizeBytes) {
            return {
                buffer: outputBuffer,
                mimeType: 'image/png'
            }
        }

        // PNG 太大时，使用高质量 JPEG
        let quality = 90
        do {
            outputBuffer = await image
                .jpeg({ quality, mozjpeg: true })
                .toBuffer()

            if (outputBuffer.length <= maxSizeBytes) {
                break
            }

            quality -= 5
        } while (quality > 60)

        return {
            buffer: outputBuffer,
            mimeType: 'image/jpeg'
        }
    } catch (error) {
        // 任何压缩错误都返回原图
        return {
            buffer: inputBuffer,
            mimeType: 'image/jpeg'
        }
    }
}

/**
 * 处理图片用于 API 调用
 * 默认将图片压缩到 2MB 以内，并限制尺寸到 1920px
 */
export async function processImageForApi(
    input: Buffer | string,
    autoCompress: boolean = true,
    maxSizeBytes: number = 2 * 1024 * 1024 // 提高至 2MB
): Promise<{
    base64: string
    mimeType: string
    originalSize: number
    compressedSize?: number
    wasCompressed: boolean
}> {
    try {
        let buffer: Buffer
        let originalMimeType: string

        if (typeof input === 'string') {
            // 检查是否是 base64 数据
            if (input.startsWith('data:')) {
                // 优化：如果不压缩，直接返回原始字符串，避免 Buffer 转换开销和潜在问题
                if (!autoCompress) {
                    const matches = input.match(/^data:(image\/[^;]+);base64,/)
                    const mimeType = matches ? matches[1] : 'image/jpeg'
                    // 粗略计算大小
                    const size = Math.floor((input.length - (matches ? matches[0].length : 0)) * 0.75)
                    return {
                        base64: input.split(',')[1],
                        mimeType: mimeType,
                        originalSize: size,
                        wasCompressed: false
                    }
                }

                // 使用 indexOf 和 substring 替代正则，避免大字符串正则性能问题
                const base64Prefix = ';base64,'
                const prefixIndex = input.indexOf(base64Prefix)
                if (prefixIndex !== -1) {
                    const mimeTypeStart = 5 // 'data:'.length
                    originalMimeType = input.substring(mimeTypeStart, prefixIndex)
                    const base64Data = input.substring(prefixIndex + base64Prefix.length)
                    buffer = Buffer.from(base64Data, 'base64')
                } else {
                    throw new Error('无效的图片数据格式')
                }
            } else {
                // 假设是文件路径
                buffer = fs.readFileSync(input)
                const ext = path.extname(input).toLowerCase().slice(1)
                originalMimeType = getMimeType(ext)
            }
        } else {
            buffer = input
            // 尝试检测格式
            try {
                const metadata = await sharp(buffer).metadata()
                originalMimeType = getMimeType(metadata.format || 'jpeg')
            } catch {
                // 如果 sharp 无法读取，默认使用 jpeg
                originalMimeType = 'image/jpeg'
            }
        }

        const originalSize = buffer.length

        if (originalSize === 0) {
            throw new Error('Input image data is empty')
        }

        // 始终检查尺寸并进行处理（即使大小未超限）
        if (autoCompress) {
            try {
                const metadata = await sharp(buffer).metadata()
                const maxDimension = 1920 // 提高至 1920px
                const needsResize = (metadata.width && metadata.width > maxDimension) ||
                    (metadata.height && metadata.height > maxDimension)
                const needsCompress = originalSize > maxSizeBytes

                if (needsResize || needsCompress) {
                    const compressed = await compressImage(buffer, maxSizeBytes, maxDimension)
                    return {
                        base64: compressed.buffer.toString('base64'),
                        mimeType: compressed.mimeType,
                        originalSize,
                        compressedSize: compressed.buffer.length,
                        wasCompressed: true
                    }
                }
            } catch {
                // 压缩失败，返回原始数据
                return {
                    base64: buffer.toString('base64'),
                    mimeType: originalMimeType,
                    originalSize,
                    wasCompressed: false
                }
            }
        }

        return {
            base64: buffer.toString('base64'),
            mimeType: originalMimeType,
            originalSize,
            wasCompressed: false
        }
    } catch (error) {
        // 如果处理失败，尝试直接返回原始输入
        if (Buffer.isBuffer(input)) {
            return {
                base64: input.toString('base64'),
                mimeType: 'image/jpeg',
                originalSize: input.length,
                wasCompressed: false
            }
        }
        throw error
    }
}

/**
 * 生成缩略图
 */
export async function generateThumbnail(
    buffer: Buffer,
    width: number = 200,
    height: number = 200
): Promise<string> {
    const thumbnailBuffer = await sharp(buffer)
        .resize(width, height, {
            fit: 'cover',
            position: 'center'
        })
        .jpeg({ quality: 70 })
        .toBuffer()

    return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`
}

/**
 * 保存图片到缓存目录
 */
export function saveImageToCache(buffer: Buffer, filename: string): string {
    const cacheDir = path.join(app.getPath('userData'), '.image-recognition', 'images')

    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true })
    }

    const filePath = path.join(cacheDir, filename)
    fs.writeFileSync(filePath, buffer)

    return filePath
}

function getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif'
    }
    return mimeTypes[ext.toLowerCase()] || 'image/jpeg'
}

/**
 * 验证图片格式
 */
export function isValidImageFormat(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase().slice(1)
    return SUPPORTED_FORMATS.includes(ext)
}

/**
 * 验证 MIME 类型
 */
export function isValidMimeType(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.includes(mimeType)
}
