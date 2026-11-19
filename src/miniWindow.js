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
      // 任务栏里没有浮窗图标，被 Win+D / Win+M 最小化后无法从任务栏点回来，
      // 所以重新唤起时先还原再显示。
      await existing.unminimize()
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
      // 浮窗是「卡片」而非独立应用窗口：不占任务栏图标，也不允许最小化。
      // skipTaskbar 在 tao 0.37 走 ITaskbarList::DeleteTab（删任务栏按钮），
      // 不改窗口样式，所以 Alt+Tab 与贴边 Snap 都不受影响；
      // 但 explorer 重启后按钮可能回来，届时需要重新 set skip_taskbar。
      // minimizable:false 去掉 WS_MINIMIZEBOX，任务栏右键/Alt+Space 里都没有「最小化」。
      // 不要改回 skipTaskbar:false——那会让任务栏重新多出一个浮窗图标。
      minimizable: false,
      // maximizable 保持 true：Windows 的贴边 Snap 依赖 WS_MAXIMIZEBOX，关掉就吸附不了。
      maximizable: true,
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
  // 优先走 Rust command：托盘、单实例、浮窗共用同一套唤起逻辑，
  // 且不受打包后 JS 窗口注册表时序影响（getByLabel 偶发返回 null 的根因）。
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('show_main_window')
    return true
  } catch (e) {
    console.warn('通过 Rust 唤起主窗口失败，尝试 JS 回退：', e)
  }
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const main = await WebviewWindow.getByLabel('main')
    if (!main) return false
    await main.unminimize()
    await main.show()
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

/** 查询当前浮窗是否置顶（浏览器环境返回 false） */
export async function isMiniAlwaysOnTop() {
  if (!isTauri()) return false
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return await getCurrentWindow().isAlwaysOnTop()
  } catch { return false }
}

/** 切换浮窗置顶状态，返回切换后的状态；浏览器环境无操作 */
export async function toggleMiniAlwaysOnTop() {
  if (!isTauri()) return false
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const w = getCurrentWindow()
    const next = !(await w.isAlwaysOnTop())
    await w.setAlwaysOnTop(next)
    return next
  } catch { return false }
}

/** 从指定边缘开始系统级拖拽调整窗口大小（无边框窗口的缩放能力） */
export async function startMiniResize(direction) {
  if (!isTauri()) return false
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().startResizeDragging(direction)
    return true
  } catch (e) {
    console.warn('开始缩放浮窗失败：', e)
    return false
  }
}
