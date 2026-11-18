import React, { useMemo } from 'react'
import {
  CheckCircle2, Sun, Coffee, Users,
  Send, Target, Brain, RefreshCw, Timer, ArrowUpRight,
  TrendingUp, ChevronRight, Plus,
} from 'lucide-react'
import { useStore, QUADRANTS, TASK_STATUS, todayStr } from '../store'

const blockIcons = { sun: Sun, brain: Brain, target: Target, coffee: Coffee, users: Users, send: Send, reflect: RefreshCw }
const statusStyle = {
  done: { label: '已完成', color: 'var(--success)', bg: 'var(--success-soft)' },
  doing: { label: '进行中', color: 'var(--brand-500)', bg: 'var(--brand-100)' },
  todo: { label: '待开始', color: 'var(--ink-3)', bg: 'var(--surface-sunk)' },
}

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}

/* 进度环：conic-gradient 画弧，进度值走 CSS 变量 --p，0 时不会算出 NaN */
function Ring({ value, size, width, className = '', children }) {
  const p = Math.max(0, Math.min(100, Number(value) || 0))
  const style = { '--p': String(p) }
  if (size) { style.width = size; style.height = size }
  if (width) style['--ring-w'] = width + 'px'
  return <div className={`dash-ring ${className}`.trim()} style={style}>{children}</div>
}

export default function Dashboard({ onNav }) {
  const { state, derived, actions } = useStore()
  const reviewToday = state.reviews[todayStr()]
  const avgProject = state.projects.length
    ? Math.round(state.projects.reduce((a, p) => a + p.progress, 0) / state.projects.length)
    : 0
  const resultsToday = (state.workResults || []).filter(w => w.date === todayStr()).length

  // 根据真实数据生成当日提醒，而不是写死的文案
  const reminders = useMemo(() => {
    const list = []
    const hour = new Date().getHours()
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

    if (state.inbox.length > 0) {
      list.push({ id: 'r-inbox', level: 'high', text: `收件箱还有 ${state.inbox.length} 条待处理，建议先清空` })
    }
    if (derived.topTasks.length === 0) {
      list.push({ id: 'r-top', level: 'high', text: '今天还没标记「最重要的 3 件事」，去任务里挑一下' })
    }
    const overdue = state.blocks.find(b => b.status !== 'done' && b.end && toMin(b.end) < nowMin)
    if (overdue) {
      list.push({ id: 'r-block', level: 'high', text: `「${overdue.title}」已过预定结束时间 ${overdue.end}，确认是否顺延` })
    }
    if (derived.focusRate < 100 && derived.focusHours > 0) {
      const gap = Math.max(0, state.focus.goalHours - derived.focusHours)
      list.push({ id: 'r-focus', level: 'low', text: `今日专注 ${derived.focusHours}h，距目标还差 ${gap.toFixed(1)}h` })
    }
    if (hour >= 20 && !reviewToday) {
      list.push({ id: 'r-review', level: 'high', text: '今天的复盘还没写，10 分钟就能收尾' })
    } else if (hour >= 20 && state.habits.some(h => !h.done)) {
      list.push({ id: 'r-habit', level: 'low', text: `还有 ${state.habits.filter(h => !h.done).length} 个习惯未打卡` })
    }
    if (list.length === 0) {
      list.push({ id: 'r-ok', level: 'low', text: reviewToday ? '今日复盘已记录，收工愉快' : '当前没有待处理提醒，保持节奏' })
    }
    return list.slice(0, 4)
  }, [state, derived, reviewToday])

  // 已排时长与最大空档：时间块本身不带日期，按当日排布直接算
  const schedule = useMemo(() => {
    const sorted = state.blocks.filter(b => b.start && b.end).slice().sort((a, b) => toMin(a.start) - toMin(b.start))
    const minutes = sorted.reduce((a, b) => a + Math.max(0, toMin(b.end) - toMin(b.start)), 0)
    let gap = 0
    let gapAt = null
    for (let i = 1; i < sorted.length; i++) {
      const g = toMin(sorted[i].start) - toMin(sorted[i - 1].end)
      if (g > gap) { gap = g; gapAt = [sorted[i - 1].end, sorted[i].start] }
    }
    return { count: state.blocks.length, hours: Math.round((minutes / 60) * 10) / 10, gapMinutes: gap, gapAt }
  }, [state.blocks])

  const topTasks = derived.topTasks
  const emptySlots = Math.max(0, 3 - topTasks.length)

  return (
    <div>
      {/* 头条：金句 + 今日完成度大环 + 四项计数退成渐小字，一屏一个视觉焦点 */}
      <section className="hero dash-hero">
        <div className="hero-main">
          <div className="hero-eyebrow">TODAY'S FOCUS</div>
          <div className="hero-title">今天最重要的，不是做很多，<br/>而是<em>做好这 3 件事</em>。</div>
          <div className="hero-desc">{state.profile.goal}</div>
          <div className="dash-hero-chip">已完成 {derived.done} / {derived.total} 项任务</div>
        </div>

        <div className="dash-hero-ring">
          <Ring value={derived.completion} className="lg">
            <div className="dash-ring-in">
              <b>{derived.completion}%</b>
              <span>今日完成度</span>
            </div>
          </Ring>
        </div>

        <div className="dash-hero-counts">
          <div className="c"><b>{derived.total}</b><span>今日任务</span></div>
          <div className="c"><b>{derived.done}</b><span>已完成</span></div>
          <div className="c"><b>{derived.doing}</b><span>进行中</span></div>
          <div className="c"><b>{derived.todo}</b><span>待完成</span></div>
        </div>
      </section>

      {/* 今日要事：每张卡自带小进度环，是当天最该动手的三件事 */}
      <section className="dash-section">
        <div className="section-head">
          <span className="bar" /><h2>今天最重要的 3 件事</h2><span className="sub">专注优先</span>
          <span className="right">
            <button className="btn btn-ghost btn-sm" onClick={() => onNav({ key: 'tasks', page: 'tasks' })}>
              管理任务 <ChevronRight size={14} />
            </button>
          </span>
        </div>

        {topTasks.length === 0 ? (
          <div className="panel">
            <div className="empty"><div className="big">🎯</div>还没有标记今日要事，去任务管理里加几件吧</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => onNav({ key: 'tasks', page: 'tasks' })}>
              去挑任务 <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="dash-prior">
            {topTasks.map((t, idx) => (
              <div className="panel dash-card" key={t.id}>
                <div className="dash-card-top">
                  <span className={`top3-check ${t.status === 'done' ? 'done' : ''}`} onClick={() => actions.cycleTaskStatus(t.id)}>
                    {t.status === 'done' && <CheckCircle2 size={13} />}
                  </span>
                  <span className="dash-card-idx">0{idx + 1}</span>
                  <span className="pill" style={{ color: QUADRANTS[t.quadrant].color, background: QUADRANTS[t.quadrant].bg }}>
                    {TASK_STATUS[t.status].label}
                  </span>
                </div>
                <div className="dash-card-title">{t.title}</div>
                <div className="dash-card-foot">
                  <Ring value={t.progress}>
                    <b>{t.progress}<i>%</i></b>
                  </Ring>
                  <div className="dash-card-meta">
                    <span>计划 {t.time || '全天'}</span>
                    <span style={{ color: QUADRANTS[t.quadrant].color }}>{QUADRANTS[t.quadrant].label}</span>
                  </div>
                </div>
              </div>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <button className="dash-slot" key={'slot' + i} onClick={() => onNav({ key: 'tasks', page: 'tasks' })}>
                <Plus size={15} /> 添加今日要事
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 三列：左边时间怎么排，中间任务怎么分，右边专注与习惯的当下状态 */}
      <section className="dash-trace">
        <div className="panel">
          <div className="section-head"><span className="bar" /><h2>今日时间块安排</h2><span className="sub">按时序</span></div>
          <div className="timeline">
            {state.blocks.length === 0 && <div className="empty mini">还没有安排时间块，去「日程 / 时间块」加一个</div>}
            {state.blocks.slice(0, 7).map(b => {
              const Icon = blockIcons[b.icon] || Target
              const st = statusStyle[b.status]
              return (
                <div className="tl-item" key={b.id}>
                  <div className="tl-time">{b.start}–{b.end}</div>
                  <div className="tl-dot" style={{ background: st.color }} />
                  <div className="tl-body">
                    <div className="flex">
                      <Icon size={13} color="var(--ink-3)" />
                      <span className="tl-title">{b.title}</span>
                    </div>
                    <span className="tl-status" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {schedule.count > 0 && (
            <div className="dash-note">
              已排 <b>{schedule.count}</b> 块 / 共 <b>{schedule.hours}h</b>
              {schedule.gapMinutes >= 30 && schedule.gapAt && (
                <> · 最长空闲 <b>{Math.round((schedule.gapMinutes / 60) * 10) / 10}h</b>（{schedule.gapAt[0]}–{schedule.gapAt[1]}）</>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="section-head"><span className="bar" /><h2>四象限 · 任务分布</h2><span className="sub">按重要 / 紧急</span></div>
          <div className="quad-grid">
            {Object.values(QUADRANTS).map(q => (
              <div className="quad-cell" key={q.key} style={{ background: q.bg }} onClick={() => onNav({ key: 'matrix', page: 'tasks', tab: 'matrix' })}>
                <div className="q-label" style={{ color: q.color }}>{q.label}</div>
                <div className="q-num" style={{ color: q.color }}>{derived.quadrantCounts[q.key]}<span style={{ fontSize: 11, fontWeight: 500 }}> 项</span></div>
                <div className="q-hint" style={{ color: q.color, opacity: .8 }}>{q.hint}</div>
              </div>
            ))}
          </div>

          <div className="section-head dash-sub-head">
            <span className="bar" /><h2>今日提醒</h2><span className="sub">{reminders.length} 条</span>
          </div>
          {reminders.map(r => (
            <div className="reminder" key={r.id}><span className="dot" style={r.level === 'low' ? { background: 'var(--ink-3)' } : undefined} /><span>{r.text}</span></div>
          ))}
        </div>

        <div className="panel">
          <div className="section-head">
            <span className="bar" /><h2>今日专注</h2>
            <span className="right">
              <button className="btn btn-primary btn-sm" onClick={() => onNav({ key: 'focus', page: 'focus' })}><Timer size={13} /> 开始专注</button>
            </span>
          </div>
          <div className="dash-focus-kpi">
            <b>{derived.focusHours}</b><span>小时 / 目标 {state.focus.goalHours}h</span>
          </div>
          <div className="track"><i style={{ width: derived.focusRate + '%' }} /></div>
          <div className="dash-note">
            达成率 <b>{derived.focusRate}%</b> · 已完成 <b>{derived.focusSessions}</b> 个专注块
          </div>

          <div className="section-head dash-sub-head">
            <span className="bar" /><h2>习惯打卡</h2><span className="sub">{derived.habitsDone}/{state.habits.length}</span>
          </div>
          {state.habits.length === 0 ? <div className="empty mini">暂无习惯</div> : state.habits.slice(0, 5).map(h => (
            <div className={`habit-row ${h.done ? 'done' : ''}`} key={h.id}>
              <span className={`habit-check ${h.done ? 'done' : ''}`} onClick={() => actions.toggleHabit(h.id)}>{h.done && <CheckCircle2 size={12} />}</span>
              <span className="habit-name">{h.name}</span>
              <span className="habit-tag" style={{ color: h.done ? 'var(--success)' : 'var(--ink-3)' }}>{h.done ? '已达成' : '待完成'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-bottom">
        <div className="panel tight">
          <div className="section-head"><span className="bar" /><h2>项目进度</h2></div>
          {state.projects.length === 0 ? <div className="empty mini">暂无项目</div> : state.projects.slice(0, 4).map(p => (
            <div className="bar-row" key={p.id}>
              <div className="bar-top"><span className="name">{p.name}</span><span className="val">{p.progress}%</span></div>
              <div className="bar-track"><i style={{ width: p.progress + '%', background: p.color }} /></div>
            </div>
          ))}
        </div>

        <div className="panel tight">
          <div className="section-head"><span className="bar" /><h2>今日工作成果</h2></div>
          <div className="bar-row"><div className="bar-top"><span className="name"><CheckCircle2 size={13} style={{ verticalAlign: -2, color: 'var(--brand-500)' }} /> 完成任务</span><span className="val">{derived.done} 项</span></div></div>
          <div className="bar-row"><div className="bar-top"><span className="name"><Timer size={13} style={{ verticalAlign: -2, color: 'var(--warning)' }} /> 专注时长</span><span className="val">{derived.focusHours} 小时</span></div></div>
          <div className="bar-row"><div className="bar-top"><span className="name"><Target size={13} style={{ verticalAlign: -2, color: 'var(--success)' }} /> 成果记录</span><span className="val">{resultsToday} 条</span></div></div>
          <div className="bar-row"><div className="bar-top"><span className="name"><TrendingUp size={13} style={{ verticalAlign: -2, color: 'var(--danger)' }} /> 项目均进度</span><span className="val">{avgProject}%</span></div></div>
        </div>

        <div className="panel tight">
          <div className="section-head"><span className="bar" /><h2>今日复盘</h2><span className="sub">{reviewToday ? '已填写' : '待填写'}</span></div>
          {['今天完成了什么？', '最大的成果是什么？', '时间花在哪了？', '明天最重要的 3 件事？'].map((q, i) => (
            <div className="review-q" key={q}><span className="num">0{i+1}</span><span>{q}</span></div>
          ))}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={() => onNav({ key: 'review', page: 'review' })}>
            去写复盘 <ArrowUpRight size={14} />
          </button>
        </div>
      </section>
    </div>
  )
}
