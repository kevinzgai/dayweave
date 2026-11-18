import React, { useState, useMemo } from 'react'
import { FileText, Timer, RefreshCw, Award, TrendingUp, Calendar } from 'lucide-react'
import { useStore, todayStr } from '../store'
import { Segmented, Stat, StatGrid } from '../ui'

const pad = n => String(n).padStart(2, '0')
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function rangeFor(kind) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const end = new Date(now)
  let start = new Date(now)
  if (kind === 'week') {
    const dow = (now.getDay() + 6) % 7 // 周一为 0
    start.setDate(now.getDate() - dow)
  } else if (kind === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (kind === '7d') {
    start.setDate(now.getDate() - 6)
  } else if (kind === '30d') {
    start.setDate(now.getDate() - 29)
  }
  return { start, end }
}

export default function ReportPage() {
  const { state } = useStore()
  const [kind, setKind] = useState('week')
  const { start, end } = rangeFor(kind)
  const inRange = (dateStr) => dateStr >= keyOf(start) && dateStr <= keyOf(end)

  const sessions = state.focus.sessions.filter(s => inRange(s.date))
  const focusMinutes = sessions.reduce((a, s) => a + s.minutes, 0)
  const reviews = Object.values(state.reviews).filter(r => inRange(r.date))
  const results = (state.workResults || []).filter(w => inRange(w.date))

  // 每日专注分布
  const days = []
  const cur = new Date(start)
  while (cur <= end) {
    const key = keyOf(cur)
    const mins = state.focus.sessions.filter(s => s.date === key).reduce((a, s) => a + s.minutes, 0)
    days.push({ key, label: `${cur.getMonth() + 1}/${cur.getDate()}`, mins })
    cur.setDate(cur.getDate() + 1)
  }
  const maxMin = Math.max(60, ...days.map(d => d.mins))

  // 天数多时（本月后半段、近 30 天）柱子会细到放不下日期，这时把图表面板横跨整行，
  // 日期标签按步长抽样显示，其余日期靠 title 提示。
  const compact = days.length > 14
  const labelStep = compact ? Math.ceil(days.length / 6) : 1
  const showLabel = (i) => !compact || i % labelStep === 0 || i === days.length - 1

  const rangeLabel = {
    week: '本周', month: '本月', '7d': '近 7 天', '30d': '近 30 天',
  }[kind]

  const summary = useMemo(() => {
    const activeDays = days.filter(d => d.mins > 0).length
    const avg = activeDays ? Math.round(focusMinutes / activeDays) : 0
    return { activeDays, avg }
  }, [focusMinutes, days])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={kind}
          onChange={setKind}
          items={[
            { value: 'week', label: '本周' },
            { value: 'month', label: '本月' },
            { value: '7d', label: '近7天' },
            { value: '30d', label: '近30天' },
          ]}
        />
        <div className="ui-help flex items-center gap-1.5"><Calendar size={13} /> {keyOf(start)} ~ {keyOf(end)}</div>
      </div>

      <StatGrid className="mb-6">
        <Stat icon={Timer} value={`${(focusMinutes / 60).toFixed(1)}h`} label={`${rangeLabel}专注时长`} tone="brand" />
        <Stat icon={TrendingUp} value={sessions.length} label="专注次数" tone="success" />
        <Stat icon={RefreshCw} value={reviews.length} label="复盘篇数" tone="warning" />
        <Stat icon={Award} value={results.length} label="成果记录" tone="danger" />
      </StatGrid>

      {/* compact 时把网格压成单列，图表面板自然占满整行 */}
      <div className="grid-2" style={compact ? { gridTemplateColumns: '1fr' } : undefined}>
        <div className="panel min-w-0">
          <div className="section-head"><span className="bar" /><h2>每日专注分布</h2><span className="sub">分钟</span></div>
          {/* 这里用 grid 而非 .flex 类：项目的 .flex 自带 align-items:center 与 gap:10px，
              会盖掉 stretch / 窄间距，柱子会被压扁 */}
          <div
            className="pt-3"
            data-testid="focus-bars"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              gap: compact ? 4 : 6,
              height: 190,
            }}
          >
            {days.map((d, i) => (
              <div
                key={d.key}
                title={`${d.label}: ${d.mins} 分钟`}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: '12px 1fr 12px', gap: 6, minWidth: 0 }}
              >
                <div className="mini tabular-nums" style={{ fontSize: 9, lineHeight: '12px', color: 'var(--ink-3)', textAlign: 'center' }}>{d.mins || ''}</div>
                {/* 高度百分比以这层轨道为基准，不再和上下文字行互抢空间 */}
                <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ width: '100%', maxWidth: compact ? 22 : 34, height: `${(d.mins / maxMin) * 100}%`, minHeight: d.mins > 0 ? 4 : 2, background: d.mins > 0 ? 'var(--brand-grad)' : 'var(--line)', borderRadius: 4, transition: 'height .4s' }} />
                </div>
                <div className="mini" style={{ fontSize: 9, lineHeight: '12px', color: 'var(--ink-3)', whiteSpace: 'nowrap', textAlign: 'center' }}>{showLabel(i) ? d.label : ''}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`grid min-w-0 gap-[22px]${compact ? ' sm:grid-cols-2' : ''}`}>
          <div className="panel">
            <div className="section-head"><span className="bar" /><h2>周期小结</h2></div>
            <div className="bar-row"><div className="bar-top"><span className="name">有专注记录的天数</span><span className="val">{summary.activeDays} 天</span></div></div>
            <div className="bar-row"><div className="bar-top"><span className="name">平均单日专注</span><span className="val">{summary.avg} 分钟</span></div></div>
            <div className="bar-row"><div className="bar-top"><span className="name">当前任务完成率</span><span className="val">{Math.round((state.tasks.filter(t => t.status === 'done').length / (state.tasks.length || 1)) * 100)}%</span></div></div>
            <div className="bar-row"><div className="bar-top"><span className="name">习惯今日完成</span><span className="val">{state.habits.filter(h => h.done).length} / {state.habits.length}</span></div></div>
          </div>

          <div className="panel">
            <div className="section-head"><span className="bar" /><h2>复盘摘录</h2><span className="sub">{reviews.length} 篇</span></div>
            {reviews.length === 0 ? <div className="empty mini">该周期暂无复盘记录</div> : reviews.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(r => (
              <div key={r.date} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="mini" style={{ fontWeight: 700, marginBottom: 3 }}>{r.date}</div>
                <div className="mini muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.biggest || r.done || '（无摘要）'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mini muted" style={{ marginTop: 16 }}>说明：统计基于专注记录、复盘与成果记录自动聚合；任务完成率为当前快照。</div>
    </div>
  )
}
