/**
 * Tauri 独立浮窗的窗口控制封装。
 * 浏览器环境下 isTauri() 为 false，调用方自动回退到应用内浮层。
 */
export const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

export const MINI_SIZES = { width: 304, height: 430, compactWidth: 196, compactHeight: 60 }
let expandedBounds = null

export async function openMiniWindow() {
  if (!isTauri()) return false
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const existing = await WebviewWindow.getByLabel('mini')
    if (existing) {
      await existing.show()
      await existing.setFocus()
      return true
    }

    const options = {
      url: 'index.html#mini',
      title: '织日 · 浮窗',
      width: MINI_SIZES.width,
      height: MINI_SIZES.height,
      minWidth: 260,
      minHeight: 320,
      resizable: true,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focus: true,
    }

    try {
      const { currentMonitor } = await import('@tauri-apps/api/window')
      const mon = await currentMonitor()
      if (mon) {
        const sf = mon.scaleFactor || 1
        options.x = mon.position.x / sf + mon.size.width / sf - MINI_SIZES.width - 20
        options.y = mon.position.y / sf + 96
      }
    } catch { /* 定位失败时交给系统默认 */ }

    new WebviewWindow('mini', options)
    return true
  } catch (e) {
    console.warn('打开浮窗失败：', e)
    return false
  }
}

export async function openMainWindow() {
  if (!isTauri()) return false
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const main = await WebviewWindow.getByLabel('main')
    if (!main) return false
    await main.show()
    await main.unminimize()
    await main.setFocus()
    return true
  } catch (e) {
    console.warn('打开主窗口失败：', e)
    return false
  }
}

export async function closeMiniWindow() {
  if (!isTauri()) return false
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
    return true
  } catch { return false }
}

/** 贴边收起 / 展开：收起后变成屏幕右侧一颗小圆点 */
export async function setMiniCompact(compact) {
  if (!isTauri()) return false
  try {
    const { getCurrentWindow, LogicalSize, LogicalPosition, currentMonitor } = await import('@tauri-apps/api/window')
    const w = getCurrentWindow()
    let mw = 1440, mx = 0, my = 0
    try {
      const mon = await currentMonitor()
      if (mon) {
        const sf = mon.scaleFactor || 1
        mw = mon.size.width / sf
        mx = mon.position.x / sf
        my = mon.position.y / sf
      }
    } catch { /* 拿不到显示器信息就用默认值 */ }

    if (compact) {
      const [size, position] = await Promise.all([w.innerSize(), w.outerPosition()])
      expandedBounds = { size, position }
      await w.setMinSize(new LogicalSize(MINI_SIZES.compactWidth, MINI_SIZES.compactHeight))
      await w.setSize(new LogicalSize(MINI_SIZES.compactWidth, MINI_SIZES.compactHeight))
      await w.setPosition(new LogicalPosition(mx + mw - MINI_SIZES.compactWidth - 12, my + 140))
    } else {
      await w.setSize(expandedBounds?.size || new LogicalSize(MINI_SIZES.width, MINI_SIZES.height))
      await w.setPosition(expandedBounds?.position || new LogicalPosition(mx + mw - MINI_SIZES.width - 20, my + 96))
      await w.setMinSize(new LogicalSize(260, 320))
      expandedBounds = null
    }
    return true
  } catch { return false }
}
