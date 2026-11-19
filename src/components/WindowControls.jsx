import React, { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { isTauri } from '../miniWindow'

/**
 * 无边框主窗口的应用内「窗口功能键」：最小化 / 最大化-还原 / 关闭。
 * - 仅 Tauri 桌面端渲染；浏览器（含 E2E）返回 null，不影响既有选择器与布局。
 * - 关闭走 window.close()，Rust 侧 CloseRequested 已接管为「隐藏到托盘」。
 * - 最大化状态由 isMaximized() 初值 + onResized 增量同步，图标随之切换；
 *   同时给 <html> 打 is-maximized 类，供 CSS 处理最大化时的边缘补偿。
 */
export default function WindowControls() {
  const desktop = isTauri()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!desktop) return
    let alive = true
    let unlisten = null
    ;(async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        const sync = async () => {
          try {
            const next = await win.isMaximized()
            if (!alive) return
            setMaximized(next)
            document.documentElement.classList.toggle('is-maximized', next)
          } catch { /* 窗口正在销毁时忽略 */ }
        }
        await sync()
        unlisten = await win.onResized(() => { sync() })
      } catch (e) {
        console.warn('同步最大化状态失败：', e)
      }
    })()
    return () => {
      alive = false
      if (unlisten) unlisten()
      document.documentElement.classList.remove('is-maximized')
    }
  }, [desktop])

  if (!desktop) return null

  const run = async (fn) => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await fn(getCurrentWindow())
    } catch (e) {
      console.warn('窗口操作失败：', e)
    }
  }

  return (
    <div className="win-controls" role="group" aria-label="窗口控制">
      <button
        className="win-btn"
        title="最小化"
        aria-label="最小化"
        onClick={() => run(w => w.minimize())}
      >
        <Minus size={15} />
      </button>
      <button
        className="win-btn"
        title={maximized ? '向下还原' : '最大化'}
        aria-label={maximized ? '向下还原' : '最大化'}
        onClick={() => run(w => w.toggleMaximize())}
      >
        {maximized ? <Copy size={12.5} /> : <Square size={12.5} />}
      </button>
      <button
        className="win-btn close"
        title="关闭到托盘"
        aria-label="关闭到托盘"
        onClick={() => run(w => w.close())}
      >
        <X size={15} />
      </button>
    </div>
  )
}
