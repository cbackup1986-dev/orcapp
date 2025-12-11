import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Spin, Empty, Typography } from 'antd'
import { useRecognitionStore } from '../../store'
import type { RecognitionStatus } from '@shared/types'

const { Text } = Typography

const statusMessages: Record<RecognitionStatus, string> = {
    idle: '',
    uploading: '正在上传图片...',
    analyzing: '正在分析图片...',
    completed: '分析完成',
    error: '分析失败'
}

export type ViewMode = 'preview' | 'source'

interface ResultViewerProps {
    viewMode: ViewMode
}

export default function ResultViewer({ viewMode }: ResultViewerProps) {
    const { status, result } = useRecognitionStore()

    // 加载中状态 - 但如果有流式内容则显示内容
    const hasStreamContent = result?.content && result.content.length > 0

    if ((status === 'uploading' || status === 'analyzing') && !hasStreamContent) {
        return (
            <div className="result-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" />
                <Text style={{ marginTop: 16 }}>{statusMessages[status]}</Text>
            </div>
        )
    }

    // 空状态
    if (status === 'idle' || !result) {
        return (
            <div className="result-area empty">
                <Empty description="等待识别" />
            </div>
        )
    }

    // 错误状态
    if (status === 'error' || !result.success) {
        return (
            <div className="result-area">
                <div style={{ color: '#ff4d4f', marginBottom: 16 }}>
                    识别失败: {result.error}
                </div>
            </div>
        )
    }

    // 成功状态
    return (
        <div className="result-area">
            {/* 内容区域 */}
            <div className="result-content" style={{ marginTop: 16 }}>
                {viewMode === 'preview' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.content || ''}
                    </ReactMarkdown>
                ) : (
                    <pre style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 16,
                        borderRadius: 8,
                        overflow: 'auto',
                        fontSize: 13,
                        lineHeight: 1.6,
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>
                        {result.content || ''}
                    </pre>
                )}
            </div>
        </div>
    )
}
