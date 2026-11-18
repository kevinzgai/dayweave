import React, { useEffect, useRef, useState } from 'react'
import { Check, Palette, Sparkles } from 'lucide-react'
import { THEMES } from '../theme'
import { useStore } from '../store'

/** 迷你预览：用主题自己的色值画一个「侧栏 + 卡片」缩略图 */
function Preview({ t }) {
  return (
    <div className="theme-preview" style={{ background: t.bg }}>
      <div className="theme-preview-nav" style={{ background: t.nav }}>
        <i style={{ background: t.navActive, width: '100%' }} />
        <i style={{ background: 'rgba(255,255,255,.2)', width: '100%' }} />
        <i style={{ background: 'rgba(255,255,255,.13)', width: '78%' }} />
      </div>
      <div className="theme-preview-body">
        <div className="theme-preview-bar" style={{ background: t.brand[500], width: '62%' }} />
        <div className="theme-preview-bar" style={{ background: t.line, width: '88%' }} />
        <div
          className="theme-preview-chip"
          style={{ background: t.surface, boxShadow: `inset 0 0 0 1px ${t.line}` }}
        />
      </div>
    </div>
  )
}

/** 设置页：5 套配色方案卡片 */
export function ThemeGrid({ className }) {
  const { state, actions } = useStore()
  const active = state.settings?.theme
  return (
    <div className={`theme-grid ${className || ''}`} data-testid="theme-grid">
      {THEMES.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            data-theme-id={t.id}
            aria-pressed={on}
            className={`theme-card ${on ? 'is-active' : ''}`}
            onClick={() => actions.setTheme(t.id)}
          >
            <Preview t={t} />
            <div className="theme-name">{t.name}</div>
            <div className="theme-desc">{t.desc}</div>
            {on && (
              <span className="theme-check"><Check size={11} strokeWidth={3.4} /></span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** 顶栏：随时切换配色（Esc / 点外部关闭） */
export function ThemeQuickSwitch() {
  const { state, actions } = useStore()
  const active = state.settings?.theme
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        className="top-btn icon"
        title="切换配色方案"
        aria-label="切换配色方案"
        data-testid="theme-quick"
        onClick={() => setOpen(v => !v)}
      >
        <Palette size={16} />
      </button>
      {open && (
        <div className="theme-pop" role="menu" data-testid="theme-pop">
          <div className="theme-pop-title flex items-center gap-1.5">
            <Sparkles size={11} /> 配色方案
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={active === t.id}
              data-theme-id={t.id}
              className={`theme-pop-item ${active === t.id ? 'is-active' : ''}`}
              onClick={() => { actions.setTheme(t.id); setOpen(false) }}
            >
              <span className="theme-dots">
                {t.swatch.map((c, i) => <i key={i} style={{ background: c }} />)}
              </span>
              <span>{t.name}</span>
              {active === t.id && <Check size={13} className="tick" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
