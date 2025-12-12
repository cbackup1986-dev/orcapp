import { useEffect, useState } from 'react'
import {
    Table,
    Button,
    Space,
    Drawer,
    Form,
    Input,
    Select,
    InputNumber,
    Switch,
    message,
    Popconfirm,
    Tag,
    Tooltip,
    Divider
} from 'antd'
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ApiOutlined,
    StarOutlined,
    StarFilled,
    CheckCircleOutlined,
    CloseCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useConfigStore } from '../../store'
import type { ModelConfigListItem, ModelConfigInput } from '@shared/types'
import { api } from '../../api'

const providerOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'azure', label: 'Azure OpenAI' },
    { value: 'oneapi', label: 'OneAPI' },
    { value: 'custom', label: '自定义' }
]

const providerColors: Record<string, string> = {
    openai: 'green',
    anthropic: 'orange',
    azure: 'blue',
    oneapi: 'purple',
    custom: 'default'
}

export default function ConfigPage() {
    const { configs, loading, fetchConfigs, createConfig, updateConfig, deleteConfig, setDefaultConfig, testConnection } = useConfigStore()
    const [drawerVisible, setDrawerVisible] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [testing, setTesting] = useState<number | null>(null)
    const [testingForm, setTestingForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [form] = Form.useForm()

    useEffect(() => {
        fetchConfigs()
    }, [fetchConfigs])

    const handleAdd = () => {
        setEditingId(null)
        form.resetFields()
        form.setFieldsValue({ maxTokens: 4096, isActive: true })
        setDrawerVisible(true)
    }

    const handleEdit = async (record: ModelConfigListItem) => {
        setEditingId(record.id)
        const fullConfig = await api.config.getById(record.id)
        if (fullConfig) {
            form.setFieldsValue({
                name: fullConfig.name,
                provider: fullConfig.provider,
                apiUrl: fullConfig.apiUrl,
                apiKey: fullConfig.apiKey,
                modelName: fullConfig.modelName,
                maxTokens: fullConfig.maxTokens,
                isActive: fullConfig.isActive
            })
        }
        setDrawerVisible(true)
    }

    const handleDelete = async (id: number) => {
        await deleteConfig(id)
        message.success('删除成功')
    }

    const handleSubmit = async (values: ModelConfigInput) => {
        setSubmitting(true)
        try {
            if (editingId) {
                await updateConfig(editingId, values)
                message.success('更新成功')
            } else {
                await createConfig(values)
                message.success('创建成功')
            }
            setDrawerVisible(false)
        } catch (error) {
            message.error((error as Error).message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleTest = async (id: number) => {
        setTesting(id)
        try {
            const result = await testConnection(id)
            if (result.success) {
                message.success(result.message)
            } else {
                message.error(result.message)
            }
        } finally {
            setTesting(null)
        }
    }

    const handleTestForm = async () => {
        try {
            const values = await form.validateFields(['provider', 'apiUrl', 'apiKey', 'modelName'])
            setTestingForm(true)
            const result = await api.config.testConnectionWithData(values)
            if (result.success) {
                message.success(result.message)
            } else {
                message.error(result.message)
            }
        } catch {
            message.warning('请先填写必要的配置信息')
        } finally {
            setTestingForm(false)
        }
    }

    const handleSetDefault = async (id: number) => {
        await setDefaultConfig(id)
        message.success('已设为默认')
    }

    const handleCloseDrawer = () => {
        setDrawerVisible(false)
        form.resetFields()
    }

    const columns: ColumnsType<ModelConfigListItem> = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 150,
            render: (name, record) => (
                <Space>
                    {name}
                    {record.isDefault && (
                        <Tooltip title="默认配置">
                            <StarFilled style={{ color: '#faad14' }} />
                        </Tooltip>
                    )}
                </Space>
            )
        },
        {
            title: '供应商',
            dataIndex: 'provider',
            key: 'provider',
            width: 100,
            render: (provider: string) => (
                <Tag color={providerColors[provider]}>
                    {providerOptions.find(p => p.value === provider)?.label || provider}
                </Tag>
            )
        },
        {
            title: '模型',
            dataIndex: 'modelName',
            key: 'modelName',
            width: 180
        },
        {
            title: 'API Key',
            dataIndex: 'apiKeyMasked',
            key: 'apiKeyMasked',
            width: 200,
            ellipsis: true,
            render: (key: string) => <code>{key}</code>
        },
        {
            title: '状态',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => (
                active
                    ? <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
                    : <Tag icon={<CloseCircleOutlined />} color="default">禁用</Tag>
            )
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="测试连接">
                        <Button
                            icon={<ApiOutlined />}
                            size="small"
                            loading={testing === record.id}
                            onClick={() => handleTest(record.id)}
                        />
                    </Tooltip>
                    {!record.isDefault && (
                        <Tooltip title="设为默认">
                            <Button
                                icon={<StarOutlined />}
                                size="small"
                                onClick={() => handleSetDefault(record.id)}
                            />
                        </Tooltip>
                    )}
                    <Tooltip title="编辑">
                        <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="确定要删除此配置吗？"
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Tooltip title="删除">
                            <Button
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ]

    return (
        <>
            <div className="page-header">
                <h1>模型配置</h1>
            </div>
            <div className="page-content">
                <div className="card">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        style={{ marginBottom: 16 }}
                    >
                        添加配置
                    </Button>

                    <Table
                        columns={columns}
                        dataSource={configs}
                        rowKey="id"
                        loading={loading}
                        pagination={false}
                    />
                </div>
            </div>

            <Drawer
                title={editingId ? '编辑配置' : '添加配置'}
                placement="right"
                width={480}
                open={drawerVisible}
                onClose={handleCloseDrawer}
                extra={
                    <Space>
                        <Button onClick={handleCloseDrawer}>取消</Button>
                        <Button
                            type="primary"
                            onClick={() => form.submit()}
                            loading={submitting}
                        >
                            {editingId ? '更新' : '创建'}
                        </Button>
                    </Space>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="配置名称"
                        rules={[{ required: true, message: '请输入配置名称' }]}
                    >
                        <Input placeholder="如: GPT-4 Vision" />
                    </Form.Item>

                    <Form.Item
                        name="provider"
                        label="供应商"
                        rules={[{ required: true, message: '请选择供应商' }]}
                    >
                        <Select options={providerOptions} placeholder="请选择供应商" />
                    </Form.Item>

                    <Form.Item
                        name="apiUrl"
                        label="API 地址"
                        rules={[{ required: true, message: '请输入 API 地址' }]}
                    >
                        <Input placeholder="如: https://api.openai.com/v1/chat/completions" />
                    </Form.Item>

                    <Form.Item
                        name="apiKey"
                        label="API Key"
                        rules={[{ required: true, message: '请输入 API Key' }]}
                    >
                        <Input.Password placeholder="请输入 API Key" />
                    </Form.Item>

                    <Form.Item
                        name="modelName"
                        label="模型名称"
                        rules={[{ required: true, message: '请输入模型名称' }]}
                    >
                        <Input placeholder="如: gpt-4-vision-preview" />
                    </Form.Item>

                    <Divider />

                    <Form.Item
                        name="maxTokens"
                        label="最大 Token 数"
                    >
                        <InputNumber min={100} max={128000} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="isActive"
                        label="启用状态"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>

                    <Divider />

                    <Button
                        block
                        icon={<ApiOutlined />}
                        onClick={handleTestForm}
                        loading={testingForm}
                    >
                        测试连接
                    </Button>
                </Form>
            </Drawer>
        </>
    )
}
