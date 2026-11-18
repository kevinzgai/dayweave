import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, CornerDownLeft, Timer, HelpCircle, ArrowRight } from 'lucide-react'
import { useStore } from '../store'

/**
 * 全局命令面板（Ctrl/Cmd + K）
 * - 输入模块名：跳转到对应模块
 * - 输入任意文字后回车：直接记入收件箱
 */
export default function CommandPalette({ open, onClose, items, onNav }) {
  const { actions } = useStore()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    const matched = items
      .filter(it => !query || it.label.toLowerCase().includes(query) || (it.group || '').toLowerCase().includes(query))
      .map(it => ({ type: 'nav', key: it.key, label: it.label, group: it.group, item: it }))

    if (query) {
      matched.push({
        type: 'capture',
        key: '__capture',
        label: `记入收件箱：${q.trim()}`,
        group: '快速捕捉',
      })
    }
    return matched
  }, [q, items])

  useEffect(() => { setIdx(0) }, [q])

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [idx])

  if (!open) return null

  const run = (entry) => {
    if (!entry) return
    if (entry.type === 'capture') {
      actions.addInbox(q.trim())
      onClose()
      onNav(items.find(i => i.key === 'inbox'))
      return
    }
    onNav(entry.item)
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[idx]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="palette-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette" role="dialog" aria-label="命令面板">
        <div className="palette-search">
          <Search size={16} color="var(--ink-3)" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="跳转到模块，或输入内容回车记入收件箱…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="palette-esc">ESC</span>
        </div>

        <div className="palette-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="palette-empty">没有匹配的模块</div>
          ) : results.map((r, i) => (
            <button
              key={r.key}
              data-active={i === idx}
              className={`palette-item ${i === idx ? 'active' : ''}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(r)}
            >
              <span className="palette-ico">
                {r.type === 'capture' ? <CornerDownLeft size={15} /> : r.item.key === 'focus' ? <Timer size={15} /> : r.item.key === 'help' ? <HelpCircle size={15} /> : <ArrowRight size={15} />}
              </span>
              <span className="grow palette-label">{r.label}</span>
              {r.type === 'nav' && <span className="palette-group">{r.group}</span>}
              {r.type === 'capture' && <span className="palette-group">回车添加</span>}
            </button>
          ))}
        </div>

        <div className="palette-foot">
          <span><b>↑↓</b> 选择</span>
          <span><b>Enter</b> 确认</span>
          <span><b>Esc</b> 关闭</span>
        </div>
      </div>
    </div>
  )
}
