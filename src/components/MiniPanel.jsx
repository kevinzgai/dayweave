import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pause, Play, Pin, X, Timer, ChevronRight, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { setMiniCompact, closeMiniWindow } from '../miniWindow'

/**
 * 浮窗卡片：
 * - mode="window"：Tauri 独立无边框置顶窗口，可贴边收起为小圆点
 * - mode="float"：浏览器 / 主窗口内的浮层，可拖动、可贴边收起
 */
export default function MiniPanel({ mode = 'float', onClose, onOpenMain }) {
  const { state, actions, derived } = useStore()
  const t = state.timer
  const [now, setNow] = useState(Date.now())
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState({ right: 26, bottom: 26 })
  const panelRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (!t.running) return
    const i = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(i)
  }, [t.running])

  const remaining = t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - now) / 1000)) : t.remaining
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  const tasks = useMemo(() => {
    const out = [], seen = new Set()
    const doing = state.tasks.filter(x => x.status === 'doing')
    const tops = derived.topTasks || []
    ;[...doing, ...tops].forEach(x => {
      if (!seen.has(x.id)) { seen.add(x.id); out.push(x) }
    })
    return out.slice(0, 5)
  }, [state.tasks, derived.topTasks])

  const toggleCollapse = async () => {
    const next = !collapsed
    setCollapsed(next)
    if (mode === 'window') await setMiniCompact(next)
  }

  const startDrag = (e) => {
    if (mode !== 'float' || collapsed) return
    if (e.target.closest('button')) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    const move = (ev) => {
      const left = Math.min(Math.max(8, ev.clientX - dragRef.current.dx), window.innerWidth - 120)
      const top = Math.min(Math.max(8, ev.clientY - dragRef.current.dy), window.innerHeight - 80)
      setPos({ left, top })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const focusThis = (task) => {
    actions.setTimerTask(task.title)
    actions.startTimer()
  }

  const style = mode === 'float' && pos.left != null ? { left: pos.left, top: pos.top } : undefined

  if (collapsed) {
    return (
      <button
        className={`mini-tab ${mode === 'window' ? 'in-window' : ''}`}
        style={style}
        onClick={toggleCollapse}
        title="展开浮窗"
      >
        <Timer size={15} />
        <span className="mini-tab-time">{mm}:{ss}</span>
        <span className="mini-tab-count">{tasks.length} 项</span>
      </button>
    )
  }

  return (
    <aside ref={panelRef} className={`mini-panel ${mode === 'window' ? 'in-window' : ''}`} style={style}>
      <header className="mini-head" onMouseDown={startDrag} data-tauri-drag-region>
        <span className={`mini-dot ${t.running ? 'live' : ''}`} />
        <span className="mini-title" data-tauri-drag-region>进行中 · {tasks.length} 项</span>
        <button className="mini-ico" onClick={toggleCollapse} title="贴边收起"><Pin size={13} /></button>
        <button className="mini-ico" onClick={async () => { if (mode === 'window') await closeMiniWindow(); else onClose?.() }} title="关闭浮窗"><X size={13} /></button>
      </header>

      <div className="mini-timer">
        <div className="mini-clock">{mm}:{ss}</div>
        <div className="mini-task" title={t.task}>{t.task}</div>
        <div className="mini-actions">
          <button
            className="mini-play"
            onClick={() => (t.running ? actions.pauseTimer() : actions.startTimer())}
            title={t.running ? '暂停' : '开始专注'}
          >
            {t.running ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="mini-finish" onClick={actions.finishTimer}><Check size={14} /> 完成本轮</button>
          <span className="mini-goal">今日 {derived.focusHours}h</span>
        </div>
      </div>

      <div className="mini-list">
        {tasks.length === 0 ? (
          <div className="mini-empty">
            <Sparkles size={20} />
            <div>今天还没有进行中的任务</div>
            <span>去任务页把要做的事标成「进行中」</span>
          </div>
        ) : tasks.map(x => (
          <div className="mini-row" key={x.id}>
            <button className="mini-check" onClick={() => actions.completeTask(x.id)} title="标记完成" />
            <div className="mini-row-body">
              <div className="mini-row-title" title={x.title}>{x.title}</div>
              <div className="mini-row-meta">
                <span className={`mini-tag ${x.status}`}>{x.status === 'doing' ? '进行中' : '今日要事'}</span>
                {x.time && <span className="mini-time">{x.time}</span>}
              </div>
            </div>
            <button className="mini-ico" onClick={() => focusThis(x)} title="开始专注这件事"><Timer size={13} /></button>
          </div>
        ))}
      </div>

      <button className="mini-foot" onClick={() => { onOpenMain?.(); if (mode === 'window') closeMiniWindow() }}>
        打开主窗口 <ChevronRight size={13} />
      </button>
    </aside>
  )
}
