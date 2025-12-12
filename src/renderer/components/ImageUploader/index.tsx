import { useCallback, useRef, useEffect } from 'react'
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, message, Radio, Image } from 'antd'
import { useRecognitionStore } from '../../store'
import { api } from '../../api'

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default function ImageUploader() {
    const {
        imageData,
        imageMimeType,
        setImage,
        clearImage,
        processedImageData,
        showProcessed,
        toggleProcessedImage
    } = useRecognitionStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 处理文件选择
    const handleFileSelect = useCallback(async (file: File) => {
        if (!SUPPORTED_TYPES.includes(file.type)) {
            message.error('不支持的图片格式，请使用 JPG, PNG, WebP 或 GIF')
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            message.warning('图片大小超过 10MB，将自动压缩')
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const result = e.target?.result as string
            // 提取 base64 部分
            const base64 = result.split(',')[1]
            setImage(base64, file.type, file.name)
        }
        reader.readAsDataURL(file)
    }, [setImage])

    // 点击上传
    const handleClick = () => {
        fileInputRef.current?.click()
    }

    // 文件输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFileSelect(file)
        }
        // 重置 input 以允许选择相同文件
        e.target.value = ''
    }

    // 拖拽处理
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const file = e.dataTransfer.files?.[0]
        if (file && file.type.startsWith('image/')) {
            handleFileSelect(file)
        }
    }, [handleFileSelect])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    // 粘贴处理
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            // 检查是否有图片
            const items = e.clipboardData?.items
            if (!items) return

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile()
                    if (file) {
                        handleFileSelect(file)
                        return
                    }
                }
            }

            // 尝试从剪贴板读取图片（通过 Electron API -> Tauri API）
            try {
                const clipboardImage = await api.clipboard.readImage()
                if (clipboardImage) {
                    setImage(clipboardImage.base64, clipboardImage.mimeType, 'clipboard-image.png')
                }
            } catch (error) {
                console.error('Failed to read clipboard image:', error)
            }
        }

        document.addEventListener('paste', handlePaste)
        return () => {
            document.removeEventListener('paste', handlePaste)
        }
    }, [handleFileSelect, setImage])

    // 选择文件对话框
    const handleSelectFile = async () => {
        try {
            const result = await api.dialog.selectImage()
            if (result) {
                setImage(result.base64, result.mimeType, result.fileName)
            }
        } catch (error) {
            console.error('Failed to select file:', error)
        }
    }

    if (imageData && imageMimeType) {
        return (
            <div className="upload-area has-image" style={{ position: 'relative' }}>
                {/* 如果有处理后的图片，显示切换开关 - 放在右上角 */}
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 100 }}>
                    <Radio.Group
                        value={showProcessed}
                        onChange={(e) => toggleProcessedImage(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        size="small"
                    >
                        <Radio.Button value={false}>原图</Radio.Button>
                        <Radio.Button value={true}>压缩后</Radio.Button>
                    </Radio.Group>
                </div>

                <div className="image-preview" style={{ marginTop: processedImageData ? 20 : 0 }}>
                    <Image
                        src={`data:${imageMimeType};base64,${imageData}`}
                        alt="上传的图片"
                        style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
                        preview={{ src: `data:${imageMimeType};base64,${imageData}` }}
                    />

                    <Button
                        className="remove-btn"
                        type="primary"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={clearImage}
                        style={{ marginTop: 16 }}
                    >
                        移除
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleInputChange}
            />
            <div
                className="upload-area"
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <InboxOutlined className="upload-icon" />
                <div className="upload-text">
                    点击或拖拽图片到此处上传
                </div>
                <div className="upload-hint">
                    支持 JPG, PNG, WebP, GIF 格式，最大 10MB
                </div>
                <div className="upload-hint" style={{ marginTop: 8 }}>
                    <Button type="link" onClick={(e) => { e.stopPropagation(); handleSelectFile(); }}>
                        选择文件
                    </Button>
                    <span>或按 Ctrl+V 粘贴图片</span>
                </div>
            </div>
        </>
    )
}
