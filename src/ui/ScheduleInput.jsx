import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react'

const pad = n => String(n).padStart(2, '0')
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function ScheduleInput({ type, value = '', onChange, className = '', ...props }) {
  const dateMode = type === 'date'
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [month, setMonth] = useState(() => new Date())
  const root = useRef(null)
  const trigger = useRef(null)
  const dialog = useRef(null)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (!open) return
    const panel = dialog.current
    panel.showModal()
    return () => {
      panel.close()
      trigger.current?.focus()
    }
  }, [open])
  const choose = (next, close = false) => {
    setDraft(next)
    onChange?.({ target: { value: next, name: props.name } })
    if (close) { setOpen(false); trigger.current?.focus() }
  }
  const valid = text => {
    if (!text) return true
    if (!dateMode) return /^([01]\d|2[0-3]):[0-5]\d$/.test(text)
    const d = new Date(`${text}T12:00:00`)
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(d.getTime()) && key(d) === text
  }
  const commit = () => valid(draft) ? choose(draft) : setDraft(value)
  const toggle = () => {
    if (!open && dateMode) setMonth(new Date(`${value || key(new Date())}T12:00:00`))
    setOpen(v => !v)
  }
  const Icon = dateMode ? CalendarDays : Clock
  const label = props['aria-label'] || (dateMode ? '日期' : '时间')
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const [hour = '09', minute = '00'] = (value || '09:00').split(':')
  return (
    <div className="schedule-input" ref={root} onKeyDown={e => {
      if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); trigger.current?.focus() }
    }}>
      <div className="schedule-control">
        <input {...props} className={`input ${className}`} type="text" data-schedule={type} aria-label={label}
          placeholder={dateMode ? '年-月-日' : '时:分'} value={draft} disabled={props.disabled}
          inputMode={dateMode ? 'text' : 'numeric'} onChange={e => {
            setDraft(e.target.value)
            if (valid(e.target.value)) onChange?.(e)
          }} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); setOpen(false) } }} />
        <button ref={trigger} type="button" className="schedule-toggle" disabled={props.disabled} aria-label={`选择${label}`} aria-expanded={open} onClick={toggle}><Icon size={16} /></button>
      </div>
      {open && createPortal(<dialog ref={dialog} className="schedule-picker" aria-label={`${label}选择器`} onCancel={e => { e.preventDefault(); e.stopPropagation(); setOpen(false) }} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) setOpen(false) } }}>
        <div className="schedule-dialog-head"><strong>{label}选择器</strong><button type="button" aria-label="关闭选择器" onClick={() => setOpen(false)}><X size={16} /></button></div>
        {dateMode ? <>
          <div className="schedule-heading">
            <button type="button" aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <strong>{month.getFullYear()} 年 {month.getMonth() + 1} 月</strong>
            <button type="button" aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="schedule-calendar">
            {['一', '二', '三', '四', '五', '六', '日'].map(d => <span key={d}>{d}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={`blank${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const day = key(new Date(month.getFullYear(), month.getMonth(), i + 1))
              return <button type="button" key={day} aria-label={day} aria-pressed={value === day} className={day === key(new Date()) ? 'is-today' : ''} onClick={() => choose(day, true)}>{i + 1}</button>
            })}
          </div>
        </> : <>
          <div className="schedule-heading"><strong>选择时间</strong><span>{value || '未安排'}</span></div>
          <div className="schedule-time-columns">
            <div><span className="schedule-caption">小时</span><div className="schedule-hours">{Array.from({ length: 24 }, (_, i) => <button type="button" key={i} aria-label={`${pad(i)}时`} aria-pressed={hour === pad(i)} onClick={() => choose(`${pad(i)}:${minute}`)}>{pad(i)}</button>)}</div></div>
            <div><span className="schedule-caption">分钟</span><div className="schedule-minutes">{Array.from({ length: 12 }, (_, i) => <button type="button" key={i} aria-label={`${pad(i * 5)}分`} aria-pressed={minute === pad(i * 5)} onClick={() => choose(`${hour}:${pad(i * 5)}`)}>{pad(i * 5)}</button>)}</div></div>
          </div>
        </>}
        <div className="schedule-shortcuts">
          {dateMode ? [0, 1].map(n => <button type="button" key={n} onClick={() => { const d = new Date(); d.setDate(d.getDate() + n); choose(key(d), true) }}>{n ? '明天' : '今天'}</button>) : ['09:00', '14:00', '18:00'].map(v => <button type="button" key={v} onClick={() => choose(v, true)}>{v}</button>)}
          <button type="button" onClick={() => choose('', true)}><X size={12} />清空</button>
          {!dateMode && <button type="button" className="schedule-confirm" onClick={() => choose(value || '09:00', true)}>确定</button>}
        </div>
      </dialog>, document.body)}
    </div>
  )
}
