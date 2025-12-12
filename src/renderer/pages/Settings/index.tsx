import { useEffect, useState } from 'react'
import {
    Form,
    Select,
    InputNumber,
    Switch,
    Button,
    Space,
    message,
    Divider,
    Card,
    Typography,
    Table,
    Input,
    Popconfirm,
    Drawer,
    Spin
} from 'antd'
import {
    SaveOutlined,
    UndoOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { AppSettings, PromptTemplate } from '@shared/types'

import { useSettingsStore } from '../../store/settingsStore'
import { api } from '../../api'

const { Title, Text } = Typography

export default function SettingsPage() {
    const settings = useSettingsStore()
    const [templates, setTemplates] = useState<PromptTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [templateModalVisible, setTemplateModalVisible] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
    const [form] = Form.useForm()
    const [templateForm] = Form.useForm()

    // Sync settings to form when they change
    useEffect(() => {
        if (settings.initialized) {
            form.setFieldsValue({
                theme: settings.theme,
                language: settings.language,
                imageMaxSize: settings.imageMaxSize,
                compressThreshold: settings.compressThreshold,
                autoCompress: settings.autoCompress,
                defaultTemperature: settings.defaultTemperature,
                defaultTopP: settings.defaultTopP,
                defaultMaxTokens: settings.defaultMaxTokens,
                defaultStream: settings.defaultStream // Ensure this is synced
            })
        }
    }, [settings, form])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [templatesData] = await Promise.all([
                api.template.getAll()
            ])
            setTemplates(templatesData)
            // Settings are loaded by App.tsx via store
        } catch (error) {
            console.error('Failed to load data:', error)
            message.error('加载数据失败，请稍后重试')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveSettings = async (values: Partial<AppSettings>) => {
        await settings.updateSettings(values)
        message.success('设置已保存')
    }

    const handleResetSettings = async () => {
        await settings.resetSettings()
        message.success('设置已重置为默认值')
    }

    const handleAddTemplate = () => {
        setEditingTemplate(null)
        templateForm.resetFields()
        setTemplateModalVisible(true)
    }

    const handleEditTemplate = (template: PromptTemplate) => {
        setEditingTemplate(template)
        templateForm.setFieldsValue(template)
        setTemplateModalVisible(true)
    }

    const handleDeleteTemplate = async (id: number) => {
        await api.template.delete(id)
        message.success('模板已删除')
        loadData()
    }

    const handleSaveTemplate = async (values: { name: string; content: string; isDefault: boolean }) => {
        if (editingTemplate) {
            await api.template.update(editingTemplate.id, values)
            message.success('模板已更新')
        } else {
            await api.template.create(values.name, values.content, values.isDefault)
            message.success('模板已创建')
        }
        setTemplateModalVisible(false)
        loadData()
    }

    const templateColumns: ColumnsType<PromptTemplate> = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: '内容',
            dataIndex: 'content',
            key: 'content',
            ellipsis: true
        },
        {
            title: '使用次数',
            dataIndex: 'useCount',
            key: 'useCount',
            width: 100
        },
        {
            title: '默认',
            dataIndex: 'isDefault',
            key: 'isDefault',
            width: 80,
            render: (isDefault: boolean) => isDefault ? '是' : '否'
        },
        {
            title: '操作',
            key: 'actions',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => handleEditTemplate(record)}
                    />
                    <Popconfirm
                        title="确定要删除此模板吗？"
                        onConfirm={() => handleDeleteTemplate(record.id)}
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

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 50 }}>
                <Spin size="large" tip="加载中..." />
            </div>
        )
    }

    return (
        <>
            <div className="page-header">
                <h1>设置</h1>
            </div>
            <div className="page-content">
                {/* 通用设置 */}
                <Card title="通用设置" style={{ marginBottom: 16 }}>
                    <Form
                        form={form}
                        layout="horizontal"
                        labelCol={{ span: 6 }}
                        wrapperCol={{ span: 18 }}
                        onFinish={handleSaveSettings}
                    >
                        <Form.Item
                            name="imageMaxSize"
                            label="图片最大尺寸 (MB)"
                        >
                            <InputNumber min={1} max={50} />
                        </Form.Item>

                        <Form.Item
                            name="compressThreshold"
                            label="压缩触发阈值 (KB)"
                            tooltip="超过此大小的图片将尝试进行压缩"
                        >
                            <InputNumber min={10} max={10240} step={100} />
                        </Form.Item>

                        <Form.Item
                            name="autoCompress"
                            label="自动压缩"
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>

                        <Divider />

                        <Form.Item
                            name="defaultTemperature"
                            label="默认 Temperature"
                        >
                            <InputNumber min={0} max={1} step={0.1} />
                        </Form.Item>

                        <Form.Item
                            name="defaultTopP"
                            label="默认 Top P"
                        >
                            <InputNumber min={0} max={1} step={0.1} />
                        </Form.Item>

                        <Form.Item wrapperCol={{ offset: 6 }}>
                            <Space>
                                <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                                    保存设置
                                </Button>
                                <Popconfirm
                                    title="确定要重置所有设置为默认值吗？"
                                    onConfirm={handleResetSettings}
                                >
                                    <Button icon={<UndoOutlined />}>
                                        重置为默认
                                    </Button>
                                </Popconfirm>
                            </Space>
                        </Form.Item>
                    </Form>
                </Card>

                {/* 提示词模板管理 */}
                <Card title="提示词模板管理">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddTemplate}
                        style={{ marginBottom: 16 }}
                    >
                        添加模板
                    </Button>

                    <Table
                        columns={templateColumns}
                        dataSource={templates}
                        rowKey="id"
                        pagination={false}
                    />
                </Card>

                {/* 关于 */}
                <Card title="关于" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Text>图片识别工具 v1.0.0</Text>
                        <Text type="secondary">一款支持多 LLM 供应商的桌面图片识别应用</Text>
                        <Text type="secondary">支持 OpenAI、Anthropic 及兼容 OpenAI 格式的 API</Text>
                    </div>
                </Card>
            </div>

            {/* 模板编辑抽屉 */}
            <Drawer
                title={editingTemplate ? '编辑模板' : '添加模板'}
                placement="right"
                width={400}
                open={templateModalVisible}
                onClose={() => setTemplateModalVisible(false)}
                extra={
                    <Space>
                        <Button onClick={() => setTemplateModalVisible(false)}>取消</Button>
                        <Button type="primary" onClick={() => templateForm.submit()}>
                            {editingTemplate ? '更新' : '创建'}
                        </Button>
                    </Space>
                }
            >
                <Form
                    form={templateForm}
                    layout="vertical"
                    onFinish={handleSaveTemplate}
                >
                    <Form.Item
                        name="name"
                        label="模板名称"
                        rules={[{ required: true, message: '请输入模板名称' }]}
                    >
                        <Input placeholder="如: 详细描述" />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label="提示词内容"
                        rules={[{ required: true, message: '请输入提示词内容' }]}
                    >
                        <Input.TextArea rows={6} placeholder="请输入提示词..." />
                    </Form.Item>

                    <Form.Item
                        name="isDefault"
                        label="设为默认"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                </Form>
            </Drawer>
        </>
    )
}
