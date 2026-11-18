import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import MiniPanel from './components/MiniPanel'
import { StoreProvider } from './store'
import { applyTheme, readStoredTheme } from './theme'
import 'virtual:uno.css'
import './styles.css'

// 首帧之前先套用上次选择的配色，避免启动瞬间闪一下默认主题
applyTheme(readStoredTheme())

// 独立浮窗走同一份前端，靠查询参数切换根组件
const isMini = new URLSearchParams(window.location.search).get('mini') === '1' || window.location.hash === '#mini'
if (isMini) document.body.classList.add('mini-route')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      {isMini ? <MiniPanel mode="window" /> : <App />}
    </StoreProvider>
  </React.StrictMode>,
)
