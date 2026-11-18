import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pause, Play, Pin, X, Timer, Home, Sparkles, ChevronLeft } from 'lucide-react'
import { useStore, taskSchedule, isTaskOverdue } from '../store'
import AddTask from './AddTask'
import { setMiniCompact, closeMiniWindow, openMainWindow } from '../miniWindow'

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
  const [created, setCreated] = useState(false)

  useEffect(() => {
    if (!created) return
    const timeout = setTimeout(() => setCreated(false), 4000)
    return () => clearTimeout(timeout)
  }, [created])
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
    state.tasks.filter(x => x.status !== 'done').forEach(x => {
      if (!seen.has(x.id)) { seen.add(x.id); out.push(x) }
    })
    return out
  }, [state.tasks, derived.topTasks])

  const toggleCollapse = async () => {
    const next = !collapsed
    if (mode === 'window' && !(await setMiniCompact(next))) return
    setCollapsed(next)
  }

  const startDrag = (e) => {
    if (mode !== 'float' || collapsed) return
    if (e.target.closest('button, [role="dialog"]')) return
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
        onClick={toggleCollapse}
        title="展开浮窗"
        aria-label={`展开浮窗，剩余 ${mm} 分 ${ss} 秒，${tasks.length} 项未完成`}
      >
        <span className={`mini-tab-icon ${t.running ? 'live' : ''}`}><Timer size={19} /></span>
        <span className="mini-tab-body"><span className="mini-tab-time">{mm}:{ss}</span><span className="mini-tab-count">{t.running ? t.task || '深度专注' : `已暂停 · ${tasks.length} 项`}</span></span>
        <ChevronLeft size={16} className="mini-tab-expand" />
      </button>
    )
  }

  if (t.running) {
    return (
      <aside ref={panelRef} className={`mini-panel mini-focusing ${mode === 'window' ? 'in-window' : ''}`} style={style} onMouseDown={startDrag} data-tauri-drag-region>
        <button className="mini-clock mini-focus-clock" onClick={actions.pauseTimer} title="暂停专注，返回任务列表" aria-label={`剩余 ${mm} 分 ${ss} 秒，点击暂停专注`}>{mm}:{ss}</button>
        <div className="mini-task mini-focus-task" data-tauri-drag-region>{t.task || '深度专注'}</div>
      </aside>
    )
  }

  return (
    <aside ref={panelRef} className={`mini-panel ${mode === 'window' ? 'in-window' : ''}`} style={style}>
      <header className="mini-head" onMouseDown={startDrag} data-tauri-drag-region>
        <span className={`mini-dot ${t.running ? 'live' : ''}`} />
        <span className="mini-title" data-tauri-drag-region>未完成 · {tasks.length} 项</span>
        <AddTask compact portalTarget={panelRef} onAdd={actions.addTask} onCreated={() => setCreated(true)} />
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

      {created && <div className="mini-created" role="status">任务已创建，可在任务列表中查看</div>}
      <div className="mini-list">
        {tasks.length === 0 ? (
          <div className="mini-empty">
            <Sparkles size={20} />
            <div>暂无未完成任务</div>
            <span>点击右上角「＋」创建任务</span>
          </div>
        ) : tasks.map(x => (
          <div className="mini-row" key={x.id}>
            <button className="mini-check" onClick={() => actions.completeTask(x.id)} title="标记完成" />
            <div className="mini-row-body">
              <div className="mini-row-title" title={x.title}>{x.title}</div>
              <div className="mini-row-meta">
                <span className={`mini-tag ${x.status}`}>{x.status === 'doing' ? '进行中' : x.todayTop ? '今日要事' : '待开始'}</span>
                {taskSchedule(x) && <span className="mini-time">{taskSchedule(x)}</span>}
                {isTaskOverdue(x) && <span className="mini-time" style={{ color: 'var(--danger)' }}>逾期</span>}
              </div>
            </div>
            <button className="mini-ico" onClick={() => focusThis(x)} title="开始专注这件事"><Timer size={13} /></button>
          </div>
        ))}
      </div>

      <button
        className="mini-foot"
        title="打开主窗口"
        aria-label="打开主窗口"
        onClick={async () => {
          if (mode === 'window') await openMainWindow()
          else onOpenMain?.()
        }}
      >
        <Home size={16} />
      </button>
    </aside>
  )
}
