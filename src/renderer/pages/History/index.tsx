import { useEffect, useState } from 'react'
import {
    Table,
    Button,
    Space,
    Input,
    DatePicker,
    Select,
    Modal,
    message,
    Popconfirm,
    Typography,
    Drawer,
    Empty,
    Image,
    Tabs,
    Descriptions
} from 'antd'
import {
    SearchOutlined,
    DeleteOutlined,
    ExportOutlined,
    EyeOutlined,
    ReloadOutlined,
    ClearOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useHistoryStore, useConfigStore, useRecognitionStore } from '../../store'
import type { HistoryRecord } from '@shared/types'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const { RangePicker } = DatePicker
const { Text, Paragraph } = Typography

export default function HistoryPage() {
    const navigate = useNavigate()
    const {
        records,
        total,
        page,
        pageSize,
        loading,
        selectedRecord,
        filters,
        fetchRecords,
        setPage,
        setFilters,
        clearFilters,
        selectRecord,
        deleteRecord,
        deleteRecords,
        clearAll,
        exportRecords
    } = useHistoryStore()

    const { activeConfigs, fetchActiveConfigs } = useConfigStore()
    const { setImage, setPrompt, setConfigId } = useRecognitionStore()

    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
    const [drawerVisible, setDrawerVisible] = useState(false)
    const [activeTab, setActiveTab] = useState('result')

    useEffect(() => {
        fetchRecords()
        fetchActiveConfigs()
    }, [fetchRecords, fetchActiveConfigs])

    // Reset tab when drawer opens or record changes
    useEffect(() => {
        if (drawerVisible) {
            setActiveTab('result')
        }
    }, [drawerVisible, selectedRecord?.id])

    const handleSearch = (keyword: string) => {
        setFilters({ keyword })
    }

    const handleDateChange = (dates: any) => {
        if (dates) {
            setFilters({
                startDate: dates[0].format('YYYY-MM-DD'),
                endDate: dates[1].format('YYYY-MM-DD')
            })
        } else {
            setFilters({ startDate: undefined, endDate: undefined })
        }
    }

    const handleConfigFilter = (configId: number | undefined) => {
        setFilters({ configId })
    }

    const handleView = (record: HistoryRecord) => {
        console.log('[History] Viewing record:', record.id)
        console.log('[History] Record prompt:', record.prompt?.substring(0, 100))
        console.log('[History] Record result:', record.result?.substring(0, 100))
        selectRecord(record)
        setDrawerVisible(true)
    }

    const handleReRecognize = (record: HistoryRecord) => {
        // 设置图片和提示词
        if (record.imageThumbnail) {
            const match = record.imageThumbnail.match(/^data:(.*?);base64,(.*)$/)
            if (match) {
                setImage(match[2], match[1])
            }
        }
        setPrompt(record.prompt)

        // 找到对应的配置
        const config = activeConfigs.find(c => c.id === record.configId)
        if (config) {
            setConfigId(config.id)
        }

        // 跳转到识别页面
        navigate('/recognition')
    }

    const handleDelete = async (id: number) => {
        await deleteRecord(id)
        message.success('删除成功')
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        await deleteRecords(selectedRowKeys)
        setSelectedRowKeys([])
        message.success(`已删除 ${selectedRowKeys.length} 条记录`)
    }

    const handleClearAll = async () => {
        const count = await clearAll()
        message.success(`已清空 ${count} 条记录`)
    }

    const handleExport = async (format: 'json' | 'csv') => {
        const data = await exportRecords()

        let content: string
        let extension: string

        if (format === 'json') {
            content = JSON.stringify(data, null, 2)
            extension = 'json'
        } else {
            // CSV 格式
            const headers = ['ID', '配置名称', '提示词', '结果', 'Token消耗', '耗时(ms)', '时间']
            const rows = data.map(r => [
                r.id,
                r.configName,
                `"${r.prompt.replace(/"/g, '""')}"`,
                `"${r.result.replace(/"/g, '""')}"`,
                r.tokensUsed || '',
                r.durationMs || '',
                r.createdAt
            ])
            content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
            extension = 'csv'
        }

        const success = await api.dialog.saveFile({
            content,
            defaultName: `历史记录_${Date.now()}.${extension}`,
            filters: [{ name: format.toUpperCase(), extensions: [extension] }]
        })

        if (success) {
            message.success('导出成功')
        }
    }

    const columns: ColumnsType<HistoryRecord> = [
        {
            title: '缩略图',
            dataIndex: 'imageThumbnail',
            key: 'imageThumbnail',
            width: 80,
            render: (thumbnail: string) => (
                thumbnail ? (
                    <img
                        src={thumbnail}
                        alt="缩略图"
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                    />
                ) : (
                    <div style={{ width: 60, height: 60, background: '#f0f0f0', borderRadius: 4 }} />
                )
            )
        },
        {
            title: '配置',
            dataIndex: 'configName',
            key: 'configName',
            width: 120
        },
        {
            title: '提示词',
            dataIndex: 'prompt',
            key: 'prompt',
            ellipsis: true,
            render: (prompt: string) => (
                <Text ellipsis style={{ maxWidth: 200 }}>
                    {prompt}
                </Text>
            )
        },
        {
            title: '结果预览',
            dataIndex: 'result',
            key: 'result',
            ellipsis: true,
            render: (result: string) => (
                <Text ellipsis style={{ maxWidth: 200 }}>
                    {result}
                </Text>
            )
        },
        {
            title: 'Token',
            dataIndex: 'tokensUsed',
            key: 'tokensUsed',
            width: 80
        },
        {
            title: '时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
        },
        {
            title: '操作',
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() => handleView(record)}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        size="small"
                        onClick={() => handleReRecognize(record)}
                    />
                    <Popconfirm
                        title="确定要删除此记录吗？"
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ]

    return (
        <>
            <div className="page-header">
                <h1>历史记录</h1>
            </div>
            <div className="page-content">
                <div className="card">
                    {/* 筛选栏 */}
                    <Space wrap style={{ marginBottom: 16 }}>
                        <Input.Search
                            placeholder="搜索提示词或结果"
                            allowClear
                            style={{ width: 250 }}
                            onSearch={handleSearch}
                        />
                        <RangePicker onChange={handleDateChange} />
                        <Select
                            placeholder="选择模型"
                            allowClear
                            style={{ width: 150 }}
                            onChange={handleConfigFilter}
                            options={activeConfigs.map(c => ({
                                value: c.id,
                                label: c.name
                            }))}
                        />
                        <Button onClick={clearFilters}>
                            清除筛选
                        </Button>
                    </Space>

                    {/* 操作栏 */}
                    <Space style={{ marginBottom: 16 }}>
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                                onConfirm={handleBatchDelete}
                            >
                                <Button danger icon={<DeleteOutlined />}>
                                    批量删除
                                </Button>
                            </Popconfirm>
                        )}
                        <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>
                            导出 JSON
                        </Button>
                        <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>
                            导出 CSV
                        </Button>
                        <Popconfirm
                            title="确定要清空所有记录吗？此操作不可恢复！"
                            onConfirm={handleClearAll}
                        >
                            <Button danger icon={<ClearOutlined />}>
                                清空全部
                            </Button>
                        </Popconfirm>
                    </Space>

                    <Table
                        rowSelection={{
                            selectedRowKeys,
                            onChange: (keys) => setSelectedRowKeys(keys as number[])
                        }}
                        columns={columns}
                        dataSource={records}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            current: page,
                            pageSize,
                            total,
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 条`,
                            onChange: (p, ps) => {
                                setPage(p)
                            }
                        }}
                    />
                </div>
            </div>

            {/* 详情抽屉 */}
            <Drawer
                title="记录详情"
                placement="right"
                width={500}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
            >
                {selectedRecord ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {selectedRecord.imageThumbnail && (
                            <div style={{ marginBottom: 16, textAlign: 'center', background: '#f5f5f5', padding: 8, borderRadius: 8 }}>
                                <Image
                                    src={selectedRecord.imageThumbnail}
                                    alt="图片"
                                    style={{ maxHeight: 200, objectFit: 'contain' }}
                                    preview={{ src: selectedRecord.imageThumbnail }}
                                />
                            </div>
                        )
                        }


                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <Tabs
                                key={selectedRecord.id}
                                rootClassName="full-height-tabs"
                                activeKey={activeTab}
                                onChange={setActiveTab}
                                destroyInactiveTabPane
                                items={[
                                    {
                                        key: 'result',
                                        label: '识别结果',
                                        children: (
                                            <div className="result-content" style={{ height: '100%', overflowY: 'auto', padding: '0 4px' }}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {selectedRecord.result}
                                                </ReactMarkdown>
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'prompt',
                                        label: '提示词',
                                        children: (
                                            <div style={{ height: '100%', overflowY: 'auto' }}>
                                                <Paragraph style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                                                    {selectedRecord.prompt}
                                                </Paragraph>
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'info',
                                        label: '详细信息',
                                        children: (
                                            <Descriptions column={1} bordered size="small">
                                                <Descriptions.Item label="模型配置">{selectedRecord.configName}</Descriptions.Item>
                                                <Descriptions.Item label="创建时间">{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                                                {selectedRecord.tokensUsed && (
                                                    <Descriptions.Item label="Token消耗">{selectedRecord.tokensUsed}</Descriptions.Item>
                                                )}
                                                {selectedRecord.durationMs && (
                                                    <Descriptions.Item label="耗时">{(selectedRecord.durationMs / 1000).toFixed(2)}s</Descriptions.Item>
                                                )}
                                            </Descriptions>
                                        )
                                    }
                                ]}
                                style={{ height: '100%' }}
                            />
                        </div>

                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0', textAlign: 'right' }}>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => {
                                    handleReRecognize(selectedRecord)
                                    setDrawerVisible(false)
                                }}
                            >
                                重新识别
                            </Button>
                        </div>
                    </div >
                ) : (
                    <Empty description="选择一条记录查看详情" />
                )
                }
            </Drawer >
        </>
    )
}
