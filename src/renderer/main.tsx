import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { getCurrentWindow } from '@tauri-apps/api/window'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)

// 页面加载完成后显示窗口
setTimeout(() => {
    getCurrentWindow().show()
}, 100)
