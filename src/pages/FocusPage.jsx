import React, { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, Check, Flame } from 'lucide-react'
import { useStore } from '../store'
import { Button, Pill, Segmented } from '../ui'

const PRESETS = [25, 45, 60, 90]

export default function FocusPage() {
  const { state, actions, derived } = useStore()
  const focusList = derived.focusSessionList || []
  const t = state.timer
  const [task, setTask] = useState(t.task)
  const [now, setNow] = useState(Date.now())

  // 计时中每 250ms 刷新显示；剩余时间由 endsAt 推导，切页/关浮窗都不丢进度
  useEffect(() => {
    if (!t.running) return
    const i = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(i)
  }, [t.running])

  // 浮窗里改了任务名时同步回输入框
  useEffect(() => { setTask(t.task) }, [t.task])

  const remaining = t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - now) / 1000)) : t.remaining
  const full = t.presetMin * 60
  const progress = full ? ((full - remaining) / full) * 100 : 0
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const R = 110, C = 2 * Math.PI * R

  const begin = () => {
    actions.setTimerTask(task.trim() || '深度专注')
    actions.startTimer()
  }

  return (
    <div>
      <div className="focus-layout">
        <div className="panel" style={{ textAlign: 'center', padding: '34px 28px' }}>
          <div className="section-head" style={{ justifyContent: 'center' }}><span className="bar" /><h2>专注计时器</h2></div>
          <div className="field" style={{ margin: '18px auto 24px', maxWidth: 260 }}>
            <input
              className="input"
              placeholder="这一轮专注做什么？"
              value={task}
              onChange={e => setTask(e.target.value)}
              onBlur={() => actions.setTimerTask(task.trim() || '深度专注')}
              style={{ textAlign: 'center' }}
            />
          </div>
          <div className="mb-6 flex justify-center">
            <Segmented
              value={t.presetMin}
              onChange={actions.setTimerPreset}
              items={PRESETS.map(m => ({ value: m, label: `${m} 分` }))}
            />
          </div>
          <div style={{ position: 'relative', width: 248, height: 248, margin: '0 auto 26px' }}>
            <svg width="248" height="248" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="124" cy="124" r={R} fill="none" stroke="var(--indigo-soft)" strokeWidth="12" />
              <circle cx="124" cy="124" r={R} fill="none" stroke="var(--indigo)" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} style={{ transition: 'stroke-dashoffset .5s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center' }}>
              <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
              <div className="mini muted" style={{ marginTop: 2 }}>
                {t.running ? '专注中…' : remaining === 0 ? '本轮完成 🎉' : t.remaining < full ? '已暂停' : '准备开始'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button
              icon={t.running ? Pause : Play}
              className="min-w-[110px]"
              onClick={() => (t.running ? actions.pauseTimer() : begin())}
            >
              {t.running ? '暂停' : remaining === 0 ? '再来一轮' : t.remaining < full ? '继续专注' : '开始专注'}
            </Button>
            <Button variant="ghost" icon={RotateCcw} onClick={actions.resetTimer}>重置</Button>
            <Button variant="ghost" icon={Check} onClick={actions.finishTimer}>完成</Button>
          </div>
          <div className="mini muted" style={{ marginTop: 16, lineHeight: 1.7 }}>
            计时在全局运行：切换页面或打开浮窗都会继续，倒计时结束自动记入今日专注。
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="section-head"><span className="bar" /><h2>今日专注概览</h2></div>
            <div className="focus-stat-row">
              <div className="focus-stat"><div className="n">{derived.focusSessions}</div><div className="l">专注块数</div></div>
              <div className="focus-stat"><div className="n">{derived.focusHours}h</div><div className="l">累计时长</div></div>
              <div className="focus-stat"><div className="n">{derived.focusRate}%</div><div className="l">目标达成</div></div>
            </div>
            <div className="row-between mini" style={{ marginBottom: 6 }}><span className="muted">今日目标 {state.focus.goalHours} 小时</span><span style={{ fontWeight: 700, color: 'var(--indigo-deep)' }}>{derived.focusHours} / {state.focus.goalHours} h</span></div>
            <div className="track"><i style={{ width: derived.focusRate + '%' }} /></div>
            <div className="flex" style={{ marginTop: 16, gap: 8 }}>
              <span className="mini muted">调整目标：</span>
              {[2, 3, 4, 6].map(h => <button key={h} className={`tab-pill ${state.focus.goalHours === h ? 'active' : ''}`} style={{ padding: '4px 10px' }} onClick={() => actions.setFocusGoal(h)}>{h}h</button>)}
            </div>
          </div>

          <div className="panel">
            <div className="section-head"><span className="bar" /><h2>今日专注记录</h2><span className="sub">{derived.focusSessions} 次</span></div>
            {focusList.length === 0 ? <div className="empty mini">今天还没有专注记录，开始第一轮吧</div> : (
              focusList.slice().reverse().map(s => (
                <div className="flex" key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="stat-ico !h-[30px] !w-[30px] bg-brand-100 text-brand-600"><Flame size={15} /></span>
                  <span className="grow truncate text-[12.5px] font-600">{s.task}</span>
                  <Pill tone="brand">{s.minutes} 分钟</Pill>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
