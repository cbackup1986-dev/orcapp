import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Layout from './components/Layout'
import RecognitionPage from './pages/Recognition'
import ConfigPage from './pages/Config'
import HistoryPage from './pages/History'
import SettingsPage from './pages/Settings'
import { useSettingsStore } from './store/settingsStore'

function App() {
    const { loadSettings, initialized } = useSettingsStore()

    useEffect(() => {
        loadSettings()
    }, [loadSettings])

    if (!initialized) {
        return null
    }

    return (
        <ConfigProvider
            locale={zhCN}
            theme={{
                token: {
                    colorPrimary: '#1890ff',
                    borderRadius: 6,
                },
            }}
        >
            <HashRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/recognition" replace />} />
                        <Route path="/recognition" element={<RecognitionPage />} />
                        <Route path="/config" element={<ConfigPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </Layout>
            </HashRouter>
        </ConfigProvider>
    )
}

export default App
