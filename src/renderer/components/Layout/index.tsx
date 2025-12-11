import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import {
    PictureOutlined,
    SettingOutlined,
    HistoryOutlined,
    ApiOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

interface LayoutProps {
    children: ReactNode
}

const menuItems: MenuProps['items'] = [
    {
        key: '/recognition',
        icon: <PictureOutlined />,
        label: '图片识别'
    },
    {
        key: '/config',
        icon: <ApiOutlined />,
        label: '模型配置'
    },
    {
        key: '/history',
        icon: <HistoryOutlined />,
        label: '历史记录'
    },
    {
        key: '/settings',
        icon: <SettingOutlined />,
        label: '设置'
    }
]

export default function Layout({ children }: LayoutProps) {
    const navigate = useNavigate()
    const location = useLocation()

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        navigate(key)
    }

    return (
        <div className="app-layout">
            <div className="sidebar">
                <div className="sidebar-header">
                    <PictureOutlined style={{ marginRight: 8 }} />
                    图片识别工具
                </div>
                <div className="sidebar-menu">
                    <Menu
                        mode="inline"
                        theme="dark"
                        selectedKeys={[location.pathname]}
                        items={menuItems}
                        onClick={handleMenuClick}
                        style={{ borderRight: 0 }}
                    />
                </div>
            </div>
            <div className="main-content">
                {children}
            </div>
        </div>
    )
}
