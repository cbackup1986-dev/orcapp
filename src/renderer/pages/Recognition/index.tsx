import { useEffect, useState } from 'react'
import {
    Select,
    Input,
    Button,
    Collapse,
    Slider,
    Radio,
    message,
    Dropdown,
    Space,
    Switch,
    InputNumber,
    Segmented
} from 'antd'
import {
    PlayCircleOutlined,
    ClearOutlined,
    HistoryOutlined,
    SaveOutlined,
    CopyOutlined,
    DownloadOutlined,
    FileTextOutlined,
    EyeOutlined,
    CodeOutlined,
    ClockCircleOutlined,
    ThunderboltOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useConfigStore, useRecognitionStore } from '../../store'
import ImageUploader from '../../components/ImageUploader'
import ResultViewer from '../../components/ResultViewer'
import type { PromptTemplate } from '@shared/types'
import { api } from '../../api'

const { TextArea } = Input

type ViewMode = 'preview' | 'source'


export default function RecognitionPage() {
    const { activeConfigs, fetchActiveConfigs } = useConfigStore()
    const {
        selectedConfigId,
        prompt,
        temperature,
        topP,
        maxTokens,
        stream,
        status,
        result,
        setConfigId,
        setPrompt,
        setTemperature,
        setTopP,
        setMaxTokens,
        setStream,
        recognize,
        reset,
        loadSettings,
        customParams,
        setCustomParams
    } = useRecognitionStore()

    const [templates, setTemplates] = useState<PromptTemplate[]>([])
    const [viewMode, setViewMode] = useState<ViewMode>('preview')

    useEffect(() => {
        fetchActiveConfigs()
        loadTemplates()
        loadSettings() // 加载全局设置到识别页面
    }, [fetchActiveConfigs])

    const loadTemplates = async () => {
        const allTemplates = await api.template.getAll()
        setTemplates(allTemplates)
    }

    // 如果没有选择配置，自动选择默认配置
    useEffect(() => {
        if (!selectedConfigId && activeConfigs.length > 0) {
            const defaultConfig = activeConfigs.find(c => c.isDefault) || activeConfigs[0]
            setConfigId(defaultConfig.id)
        }
    }, [activeConfigs, selectedConfigId, setConfigId])

    const handleRecognize = async () => {
        try {
            const result = await recognize()
            if (!result.success) {
                message.error(result.error || '识别失败')
            }
        } catch (error) {
            message.error((error as Error).message)
        }
    }

    const handleCopy = async () => {
        if (result?.content) {
            await api.clipboard.writeText(result.content)
            message.success('已复制到剪贴板')
        }
    }

    const handleExport = async (format: 'txt' | 'md') => {
        if (!result?.content) return

        const extension = format === 'md' ? 'md' : 'txt'
        const success = await api.dialog.saveFile({
            content: result.content,
            defaultName: `识别结果_${Date.now()}.${extension}`,
            filters: [
                { name: format === 'md' ? 'Markdown' : 'Text', extensions: [extension] }
            ]
        })

        if (success) {
            message.success('导出成功')
        }
    }

    const handleTemplateSelect = (template: PromptTemplate) => {
        setPrompt(template.content)
        api.template.incrementUse(template.id)
    }

    const handleSaveTemplate = async () => {
        if (!prompt.trim()) {
            message.warning('请先输入提示词')
            return
        }
        const name = window.prompt('请输入模板名称:')
        if (name) {
            await api.template.create(name, prompt)
            await loadTemplates()
            message.success('模板保存成功')
        }
    }

    const templateMenuItems: MenuProps['items'] = [
        {
            key: 'templates',
            label: '模板库',
            children: templates.map(t => ({
                key: `template-${t.id}`,
                label: t.name,
                onClick: () => handleTemplateSelect(t)
            }))
        }
    ]

    const isProcessing = status === 'uploading' || status === 'analyzing'

    return (
        <>
            <div className="page-header">
                <h1>图片识别</h1>
            </div>
            <div className="page-content">
                <div className="card">
                    {/* 模型选择 */}
                    <div style={{ marginBottom: 16 }}>
                        <span style={{ marginRight: 8 }}>选择模型:</span>
                        <Select
                            style={{ width: 300 }}
                            value={selectedConfigId}
                            onChange={setConfigId}
                            placeholder="请选择模型配置"
                            options={activeConfigs.map(c => ({
                                value: c.id,
                                label: `${c.name} (${c.modelName})`
                            }))}
                        />
                    </div>

                    {/* 图片上传 */}
                    <ImageUploader />

                    {/* 提示词输入 */}
                    <div style={{ marginTop: 16 }}>
                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>提示词:</span>
                            <Space>
                                <Dropdown menu={{ items: templateMenuItems }}>
                                    <Button size="small" icon={<HistoryOutlined />}>
                                        选择模板
                                    </Button>
                                </Dropdown>
                                <Button size="small" icon={<SaveOutlined />} onClick={handleSaveTemplate}>
                                    保存为模板
                                </Button>
                            </Space>
                        </div>
                        <TextArea
                            autoSize={{ minRows: 4, maxRows: 12 }}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="请输入提示词 (支持 Markdown)..."
                            style={{ fontFamily: 'Consolas, Monaco, monospace' }}
                        />
                    </div>




                    {/* 高级参数 */}
                    <Collapse
                        ghost
                        style={{ marginTop: 16 }}
                        items={[{
                            key: 'advanced',
                            label: '高级参数',
                            children: (
                                <div className="advanced-params">
                                    <div className="param-row">
                                        <span className="label">流式输出:</span>
                                        <Switch checked={stream} onChange={setStream} />
                                    </div>
                                    <div className="param-row">
                                        <span className="label">Max Tokens:</span>
                                        <Slider
                                            style={{ flex: 1 }}
                                            min={100}
                                            max={8192}
                                            step={100}
                                            value={maxTokens}
                                            onChange={setMaxTokens}
                                        />
                                        <InputNumber
                                            min={100}
                                            max={32000}
                                            style={{ margin: '0 16px', width: 80 }}
                                            value={maxTokens}
                                            onChange={(v) => v && setMaxTokens(v)}
                                        />
                                    </div>
                                    <div className="param-row">
                                        <span className="label">Temperature:</span>
                                        <Slider
                                            style={{ flex: 1 }}
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={temperature}
                                            onChange={setTemperature}
                                        />
                                        <span style={{ width: 40, textAlign: 'right' }}>{temperature}</span>
                                    </div>
                                    <div className="param-row">
                                        <span className="label">Top P:</span>
                                        <Slider
                                            style={{ flex: 1 }}
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={topP}
                                            onChange={setTopP}
                                        />
                                        <span style={{ width: 40, textAlign: 'right' }}>{topP}</span>
                                    </div>

                                    {/* 自定义参数 */}
                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <span className="label">自定义参数:</span>
                                            <Button
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={() => {
                                                    const newParams = [...customParams, { id: Date.now().toString(), key: '', value: '' }]
                                                    setCustomParams(newParams)
                                                }}
                                            >
                                                添加
                                            </Button>
                                        </div>
                                        {customParams.map((param, index) => (
                                            <div key={param.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                                <Input
                                                    placeholder="参数名"
                                                    style={{ width: 120 }}
                                                    value={param.key}
                                                    onChange={(e) => {
                                                        const newParams = [...customParams]
                                                        newParams[index] = { ...param, key: e.target.value }
                                                        setCustomParams(newParams)
                                                    }}
                                                />
                                                <Input
                                                    placeholder="值"
                                                    style={{ flex: 1 }}
                                                    value={param.value}
                                                    onChange={(e) => {
                                                        const newParams = [...customParams]
                                                        newParams[index] = { ...param, value: e.target.value }
                                                        setCustomParams(newParams)
                                                    }}
                                                />
                                                <Button
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => {
                                                        const newParams = customParams.filter(p => p.id !== param.id)
                                                        setCustomParams(newParams)
                                                    }}
                                                />
                                            </div>
                                        ))}
                                        {customParams.length === 0 && (
                                            <div style={{ color: '#888', fontSize: 12 }}>
                                                暂无自定义参数，点击"添加"按钮添加
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }]}
                    />

                    {/* 操作按钮 */}
                    <div className="action-buttons" style={{ marginTop: 16 }}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<PlayCircleOutlined />}
                            onClick={handleRecognize}
                            loading={isProcessing}
                            disabled={!selectedConfigId}
                        >
                            {isProcessing ? '识别中...' : '开始识别'}
                        </Button>
                        <Button
                            size="large"
                            icon={<ClearOutlined />}
                            onClick={reset}
                            disabled={isProcessing}
                        >
                            清空
                        </Button>
                    </div>
                </div>

                {/* 识别结果 */}
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <h3 style={{ margin: 0 }}>识别结果</h3>
                            <Segmented
                                value={viewMode}
                                onChange={(value) => setViewMode(value as ViewMode)}
                                options={[
                                    { value: 'preview', icon: <EyeOutlined />, label: '预览' },
                                    { value: 'source', icon: <CodeOutlined />, label: '源码' }
                                ]}
                            />
                            {/* 统计信息 */}
                            {result?.success && (
                                <Space size="large" style={{ marginLeft: 16, color: '#888', fontSize: 13 }}>
                                    {result.durationMs && (
                                        <span>
                                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                                            {(result.durationMs / 1000).toFixed(2)}s
                                        </span>
                                    )}
                                    {result.tokensUsed && (
                                        <span>
                                            <ThunderboltOutlined style={{ marginRight: 4 }} />
                                            {result.tokensUsed} tokens
                                        </span>
                                    )}
                                </Space>
                            )}
                        </div>
                        <Space>
                            <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={handleCopy}
                                disabled={!result?.content}
                            >
                                复制
                            </Button>
                            <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() => handleExport('md')}
                                disabled={!result?.content}
                            >
                                导出MD
                            </Button>
                            <Button
                                size="small"
                                icon={<FileTextOutlined />}
                                onClick={() => handleExport('txt')}
                                disabled={!result?.content}
                            >
                                导出文本
                            </Button>
                        </Space>
                    </div>
                    <ResultViewer viewMode={viewMode} />
                </div>
            </div>
        </>
    )
}
