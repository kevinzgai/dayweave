import React, { useMemo, useRef, useState } from 'react'
import { Printer, BookOpen, Info } from 'lucide-react'
import guideHtml from '../help/guide.html?raw'
import { useStore } from '../store'
import { themeVars } from '../theme'

// 手册是独立文档（iframe），把当前主题的关键令牌注入进去，配色与应用保持一致
const INJECT = [
  ['--brand-50', '--brand-50'],
  ['--brand-100', '--brand-100'],
  ['--brand-200', '--brand-200'],
  ['--brand-300', '--brand-300'],
  ['--brand-400', '--brand-400'],
  ['--brand-500', '--brand-500'],
  ['--brand-600', '--brand-600'],
  ['--brand-700', '--brand-700'],
  ['--ink', '--ink'],
  ['--ink-2', '--ink-2'],
  ['--ink-3', '--ink-3'],
  ['--line', '--line'],
  ['--line-strong', '--line-strong'],
  ['--bg', '--surface-sunk'],
  ['--surface', '--surface'],
  ['--accent-soft', '--accent-soft'],
  ['--accent-ink', '--accent-ink'],
  ['--hero-grad', '--hero-grad'],
  ['--on-brand', '--on-brand'],
  ['--indigo', '--brand-500'],
  ['--indigo-deep', '--brand-600'],
  ['--indigo-soft', '--brand-100'],
  ['--green', '--success'],
  ['--amber', '--warning'],
  ['--rose', '--danger'],
]

export default function HelpPage() {
  const { state } = useStore()
  const frameRef = useRef(null)
  const [printed, setPrinted] = useState(false)

  const srcDoc = useMemo(() => {
    const vars = themeVars(state.settings?.theme)
    const css = ':root{' + INJECT.map(([k, src]) => `${k}:${vars[src]};`).join('') + '}'
    return guideHtml.replace('</style>', css + '</style>')
  }, [state.settings?.theme])

  const print = () => {
    const win = frameRef.current?.contentWindow
    if (!win) return
    try {
      win.focus()
      win.print()
      setPrinted(true)
      setTimeout(() => setPrinted(false), 2200)
    } catch {
      setPrinted(false)
    }
  }

  return (
    <div>
      <div className="flex row-between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div className="section-head" style={{ margin: 0 }}>
          <span className="bar" />
          <h2>使用手册</h2>
          <span className="sub">从入门到熟练 · 内置离线文档</span>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          <span className="mini muted flex" style={{ gap: 6 }}><Info size={13} /> 左侧目录可搜索章节</span>
          <button className="btn btn-primary btn-sm" onClick={print}><Printer size={14} /> 打印 / 存为 PDF</button>
        </div>
      </div>

      <div className="help-frame-wrap">
        <iframe
          ref={frameRef}
          className="help-frame"
          title="织日使用手册"
          srcDoc={srcDoc}
        />
      </div>

      <div className="mini muted flex" style={{ marginTop: 12, gap: 6 }}>
        <BookOpen size={13} /> 手册随应用离线可用；需要纸质版时点右上「打印 / 存为 PDF」，选择「另存为 PDF」即可导出。
        {printed && <span style={{ color: 'var(--green)', marginLeft: 8 }}>已调用打印</span>}
      </div>
    </div>
  )
}
