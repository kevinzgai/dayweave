import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { applyTheme, DEFAULT_THEME, THEMES } from './theme'

const STORAGE_KEY = 'time-master-state-v1'
const SYNC_CHANNEL = 'time-master-sync-v1'

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dateKey = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

export const QUADRANTS = {
  Q1: { key: 'Q1', label: '重要且紧急', hint: '立即做', color: 'var(--q1)', bg: 'var(--q1-soft)' },
  Q2: { key: 'Q2', label: '重要不紧急', hint: '计划做', color: 'var(--q2)', bg: 'var(--q2-soft)' },
  Q3: { key: 'Q3', label: '不重要但紧急', hint: '委托/压缩', color: 'var(--q3)', bg: 'var(--q3-soft)' },
  Q4: { key: 'Q4', label: '不重要不紧急', hint: '尽量少做', color: 'var(--q4)', bg: 'var(--q4-soft)' },
}

export const TASK_STATUS = {
  todo: { label: '待开始', color: 'var(--ink-3)' },
  doing: { label: '进行中', color: 'var(--brand-500)' },
  done: { label: '已完成', color: 'var(--success)' },
}

const GOAL_CATS = ['事业', '学习', '健康', '财务', '生活']
export { GOAL_CATS }

// 根据打卡历史计算连续天数（今天未打则从昨天起算，保持“未断”）
function calcStreak(history) {
  if (!history || !history.length) return 0
  const set = new Set(history)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!set.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (set.has(dateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

const seedState = () => ({
  profile: { name: 'Kevin', goal: '把时间花在最重要的事上' },
  settings: { weekStart: 1, autoStart: false, compact: false, theme: DEFAULT_THEME },
  inbox: [
    { id: 'i1', title: '整理下周会议纪要', createdAt: Date.now() - 3600e3 },
    { id: 'i2', title: '回复合作方邮件', createdAt: Date.now() - 7200e3 },
    { id: 'i3', title: '预约年度体检', createdAt: Date.now() - 10800e3 },
  ],
  tasks: [
    { id: 't1', title: '完成最重要的核心项目任务', quadrant: 'Q1', status: 'doing', progress: 70, time: '12:00', todayTop: true, createdAt: Date.now() },
    { id: 't2', title: '处理并推进关键事项', quadrant: 'Q3', status: 'todo', progress: 0, time: '16:00', todayTop: false, createdAt: Date.now() },
    { id: 't3', title: '完成今日计划内的输出/交付', quadrant: 'Q2', status: 'doing', progress: 60, time: '18:00', todayTop: true, createdAt: Date.now() },
    { id: 't4', title: '深度专注：核心任务 B', quadrant: 'Q1', status: 'done', progress: 100, time: '10:00', todayTop: true, createdAt: Date.now() },
    { id: 't5', title: '晨间规划 / 收件箱清理', quadrant: 'Q2', status: 'done', progress: 100, time: '08:00', todayTop: false, createdAt: Date.now() },
    { id: 't6', title: '会议 / 协作沟通', quadrant: 'Q3', status: 'todo', progress: 0, time: '14:00', todayTop: false, createdAt: Date.now() },
    { id: 't7', title: '今日复盘 / 明日规划', quadrant: 'Q2', status: 'todo', progress: 0, time: '19:00', todayTop: false, createdAt: Date.now() },
    { id: 't8', title: '更新知识素材库', quadrant: 'Q4', status: 'todo', progress: 0, time: '20:00', todayTop: false, createdAt: Date.now() },
  ],
  blocks: [
    { id: 'b1', start: '07:30', end: '08:00', title: '晨间规划 / 收件箱清理', icon: 'sun', status: 'done' },
    { id: 'b2', start: '08:00', end: '10:00', title: '深度专注：核心任务 A', icon: 'brain', status: 'done' },
    { id: 'b3', start: '10:30', end: '12:00', title: '核心任务 B（深度工作）', icon: 'target', status: 'doing' },
    { id: 'b4', start: '12:00', end: '13:30', title: '午休 / 休息放松', icon: 'coffee', status: 'todo' },
    { id: 'b5', start: '14:00', end: '15:00', title: '会议 / 协作沟通', icon: 'users', status: 'todo' },
    { id: 'b6', start: '15:30', end: '17:00', title: '输出 / 交付任务', icon: 'send', status: 'todo' },
    { id: 'b7', start: '19:00', end: '19:30', title: '今日复盘 / 明日规划', icon: 'reflect', status: 'todo' },
  ],
  focus: { goalHours: 4, sessions: [
    { id: 'f1', minutes: 90, task: '深度专注：核心任务 A', date: todayStr() },
    { id: 'f2', minutes: 60, task: '核心任务 B（深度工作）', date: todayStr() },
  ] },
  timer: { presetMin: 25, task: '深度专注', running: false, endsAt: null, remaining: 25 * 60, completedAt: null },
  reviews: {},
  projects: [
    { id: 'p1', name: '年度目标推进', desc: '围绕年度三大方向的持续投入', progress: 80, color: '#e8a13a', deadline: '2026-12-31', createdAt: Date.now() },
    { id: 'p2', name: '学习计划完成', desc: 'LangChain / LangGraph 学习', progress: 60, color: '#7170FF', deadline: '2026-12-31', createdAt: Date.now() },
    { id: 'p3', name: '健康计划', desc: '规律作息与运动', progress: 40, color: '#e8607a', deadline: '2026-12-31', createdAt: Date.now() },
  ],
  goals: [
    { id: 'g1', title: '完成 ScriptEval 评估系统 V2', cat: '事业', target: 100, current: 65, unit: '%', deadline: '2026-12-31', createdAt: Date.now() },
    { id: 'g2', title: '读完 12 本专业书', cat: '学习', target: 12, current: 9, unit: '本', deadline: '2026-12-31', createdAt: Date.now() },
    { id: 'g3', title: '每月跑步 60 公里', cat: '健康', target: 60, current: 38, unit: 'km', deadline: '2026-11-30', createdAt: Date.now() },
  ],
  habits: [
    { id: 'h1', name: '阅读 30min', done: true, history: [todayStr()], freq: '每日' },
    { id: 'h2', name: '运动 4次/周', done: true, history: [todayStr()], freq: '每周' },
    { id: 'h3', name: '写作/输出', done: false, history: [], freq: '每日' },
    { id: 'h4', name: '早睡早起', done: false, history: [], freq: '每日' },
  ],
  knowledge: [
    { id: 'k1', title: 'React 性能优化清单', content: 'memo / useMemo / 虚拟列表 / 分包懒加载，按场景取舍。', tags: ['前端', 'React'], createdAt: Date.now() },
    { id: 'k2', title: '四象限法的坑', content: '容易陷入“都在救火”，要强制为 Q2 预留时间块。', tags: ['方法论'], createdAt: Date.now() },
  ],
  experience: [
    { id: 'e1', title: '项目复盘：需求不清晰时先做原型', content: '与其反复开会，不如一个可点原型对齐认知，节省大量返工。', tags: ['复盘', '协作'], createdAt: Date.now() },
  ],
  workResults: [
    { id: 'w1', title: '完成核心任务 A 深度输出', desc: '2 小时深度专注，产出初稿', date: todayStr(), type: '任务' },
    { id: 'w2', title: '修复线上关键缺陷', desc: '定位并解决一个影响体验的问题', date: todayStr(), type: '任务' },
  ],
  achievements: { tasksDone: 7, focusHours: 2.5, coreResults: '2/3', goalDelta: '+1%' },
  reminders: [
    { id: 'r1', text: '收件箱还有 3 条待处理任务', level: 'high' },
    { id: 'r2', text: '14:00 会议与任务 B 时间冲突', level: 'high' },
    { id: 'r3', text: '今日专注块已达 2 个', level: 'low' },
  ],
})

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw)
    const base = seedState()
    const merged = { ...base, ...parsed }
    // 兼容旧版：确保新集合存在
    merged.knowledge = merged.knowledge || []
    merged.experience = merged.experience || []
    merged.workResults = merged.workResults || []
    merged.goals = merged.goals || []
    merged.settings = { ...base.settings, ...(merged.settings || {}) }
    if (!THEMES.some(t => t.id === merged.settings.theme)) merged.settings.theme = DEFAULT_THEME
    merged.habits = (merged.habits || []).map(h => ({ history: [], freq: '每日', ...h }))
    merged.tasks = (merged.tasks || []).map(t => ({ note: '', ...t }))
    merged.timer = { ...base.timer, ...(merged.timer || {}) }
    return merged
  } catch {
    return seedState()
  }
}

const StoreContext = createContext(null)

let idCounter = 0
const uid = (p) => `${p}${Date.now().toString(36)}${(idCounter++).toString(36)}`

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState)
  const channelRef = useRef(null)
  const lastRawRef = useRef('')
  const remoteRef = useRef(false)

  // 主题：状态变了就写一次 CSS 变量，主窗口 / 浮窗 / 重启后都一致
  useEffect(() => {
    applyTheme(state.settings?.theme)
    const root = document.documentElement
    root.classList.add('theme-anim')
    const timer = setTimeout(() => root.classList.remove('theme-anim'), 420)
    return () => clearTimeout(timer)
  }, [state.settings?.theme])

  // 跨窗口同步：浮窗（独立窗口）与主窗口共用 localStorage + BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(SYNC_CHANNEL)
    channelRef.current = ch

    const apply = (raw) => {
      if (!raw || raw === lastRawRef.current) return
      try {
        const next = JSON.parse(raw)
        remoteRef.current = true
        lastRawRef.current = raw
        setState(next)
      } catch { /* 忽略非法数据 */ }
    }

    ch.onmessage = (e) => apply(e.data?.raw)
    const onStorage = (e) => { if (e.key === STORAGE_KEY) apply(e.newValue) }
    window.addEventListener('storage', onStorage)

    return () => {
      ch.close()
      channelRef.current = null
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // 持久化 + 广播（来自其他窗口的更新不再回传，避免往返风暴）
  useEffect(() => {
    const raw = JSON.stringify(state)
    lastRawRef.current = raw
    if (remoteRef.current) {
      remoteRef.current = false
      return
    }
    localStorage.setItem(STORAGE_KEY, raw)
    channelRef.current?.postMessage({ raw })
  }, [state])

  // 计时器统一走这里：到点自动记一条专注记录，主窗口与浮窗同步
  useEffect(() => {
    if (!state.timer.running) return
    const timer = setInterval(() => {
      setState(s => {
        if (!s.timer.running || !s.timer.endsAt) return s
        if (Date.now() < s.timer.endsAt) return s
        return {
          ...s,
          focus: { ...s.focus, sessions: [...s.focus.sessions, { id: uid('f'), minutes: s.timer.presetMin, task: s.timer.task, date: todayStr() }] },
          timer: { ...s.timer, running: false, endsAt: null, remaining: 0, completedAt: Date.now() },
        }
      })
    }, 500)
    return () => clearInterval(timer)
  }, [state.timer.running])

  const actions = useMemo(() => ({
    // inbox
    addInbox: (title) => setState(s => ({ ...s, inbox: [...s.inbox, { id: uid('i'), title, createdAt: Date.now() }] })),
    removeInbox: (id) => setState(s => ({ ...s, inbox: s.inbox.filter(i => i.id !== id) })),
    inboxToTask: (id, extra = {}) => setState(s => {
      const item = s.inbox.find(i => i.id === id)
      if (!item) return s
      const task = { id: uid('t'), title: item.title, quadrant: 'Q2', status: 'todo', progress: 0, time: '', todayTop: false, createdAt: Date.now(), ...extra }
      return { ...s, inbox: s.inbox.filter(i => i.id !== id), tasks: [...s.tasks, task] }
    }),

    // tasks
    addTask: (task) => setState(s => ({ ...s, tasks: [{ id: uid('t'), status: 'todo', progress: 0, quadrant: 'Q2', time: '', todayTop: false, note: '', createdAt: Date.now(), ...task }, ...s.tasks] })),
    updateTask: (id, patch) => setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) })),
    removeTask: (id) => setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) })),
    completeTask: (id) => setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'done', progress: 100 } : t) })),
    // 圆点单击：已完成 ↔ 待开始（列表、四象限、浮窗共用同一语义）
    toggleTaskDone: (id) => setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id
      ? (t.status === 'done' ? { ...t, status: 'todo', progress: 0 } : { ...t, status: 'done', progress: 100 })
      : t) })),
    cycleTaskStatus: (id) => setState(s => ({ ...s, tasks: s.tasks.map(t => {
      if (t.id !== id) return t
      const order = ['todo', 'doing', 'done']
      const next = order[(order.indexOf(t.status) + 1) % order.length]
      return { ...t, status: next, progress: next === 'done' ? 100 : next === 'todo' ? 0 : t.progress }
    }) })),

    // blocks
    addBlock: (block) => setState(s => ({ ...s, blocks: [...s.blocks, { id: uid('b'), icon: 'target', status: 'todo', ...block }].sort((a, b) => a.start.localeCompare(b.start)) })),
    updateBlock: (id, patch) => setState(s => ({ ...s, blocks: s.blocks.map(b => b.id === id ? { ...b, ...patch } : b) })),
    removeBlock: (id) => setState(s => ({ ...s, blocks: s.blocks.filter(b => b.id !== id) })),
    cycleBlockStatus: (id) => setState(s => ({ ...s, blocks: s.blocks.map(b => {
      if (b.id !== id) return b
      const order = ['todo', 'doing', 'done']
      return { ...b, status: order[(order.indexOf(b.status) + 1) % order.length] }
    }) })),

    // focus
    setFocusGoal: (goalHours) => setState(s => ({ ...s, focus: { ...s.focus, goalHours } })),
    addFocusSession: (minutes, task) => setState(s => ({ ...s, focus: { ...s.focus, sessions: [...s.focus.sessions, { id: uid('f'), minutes, task, date: todayStr() }] } })),

    // timer（全局计时器，跨页面与浮窗共用）
    setTimerPreset: (m) => setState(s => ({ ...s, timer: { ...s.timer, presetMin: m, remaining: m * 60, running: false, endsAt: null, completedAt: null } })),
    setTimerTask: (task) => setState(s => ({ ...s, timer: { ...s.timer, task } })),
    startTimer: () => setState(s => {
      const t = s.timer
      const rest = t.remaining > 0 ? t.remaining : t.presetMin * 60
      return { ...s, timer: { ...t, running: true, endsAt: Date.now() + rest * 1000, remaining: rest, completedAt: null } }
    }),
    pauseTimer: () => setState(s => {
      const t = s.timer
      const rest = t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining
      return { ...s, timer: { ...t, running: false, endsAt: null, remaining: rest } }
    }),
    resetTimer: () => setState(s => ({ ...s, timer: { ...s.timer, running: false, endsAt: null, remaining: s.timer.presetMin * 60, completedAt: null } })),
    finishTimer: () => setState(s => {
      const t = s.timer
      const rest = t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining
      const spent = Math.max(1, Math.round((t.presetMin * 60 - rest) / 60))
      return {
        ...s,
        focus: { ...s.focus, sessions: [...s.focus.sessions, { id: uid('f'), minutes: spent, task: t.task, date: todayStr() }] },
        timer: { ...t, running: false, endsAt: null, remaining: 0, completedAt: Date.now() },
      }
    }),

    // reviews
    saveReview: (review) => setState(s => ({ ...s, reviews: { ...s.reviews, [todayStr()]: { ...review, date: todayStr(), updatedAt: Date.now() } } })),

    // projects
    addProject: (p) => setState(s => ({ ...s, projects: [...s.projects, { id: uid('p'), progress: 0, color: '#7170FF', desc: '', deadline: '', createdAt: Date.now(), ...p }] })),
    updateProject: (id, patch) => setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) })),
    removeProject: (id) => setState(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) })),

    // goals
    addGoal: (g) => setState(s => ({ ...s, goals: [...s.goals, { id: uid('g'), target: 100, current: 0, unit: '%', cat: '事业', deadline: '', createdAt: Date.now(), ...g }] })),
    updateGoal: (id, patch) => setState(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, ...patch } : g) })),
    removeGoal: (id) => setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) })),

    // habits
    addHabit: (h) => setState(s => ({ ...s, habits: [...s.habits, { id: uid('h'), done: false, history: [], freq: '每日', ...h }] })),
    removeHabit: (id) => setState(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) })),
    toggleHabit: (id) => setState(s => ({ ...s, habits: s.habits.map(h => {
      if (h.id !== id) return h
      const today = todayStr()
      const has = (h.history || []).includes(today)
      const history = has ? h.history.filter(d => d !== today) : [...(h.history || []), today]
      return { ...h, done: !has, history }
    }) })),

    // knowledge
    addKnowledge: (k) => setState(s => ({ ...s, knowledge: [{ id: uid('k'), tags: [], createdAt: Date.now(), ...k }, ...s.knowledge] })),
    updateKnowledge: (id, patch) => setState(s => ({ ...s, knowledge: s.knowledge.map(k => k.id === id ? { ...k, ...patch } : k) })),
    removeKnowledge: (id) => setState(s => ({ ...s, knowledge: s.knowledge.filter(k => k.id !== id) })),

    // experience
    addExperience: (e) => setState(s => ({ ...s, experience: [{ id: uid('e'), tags: [], createdAt: Date.now(), ...e }, ...s.experience] })),
    removeExperience: (id) => setState(s => ({ ...s, experience: s.experience.filter(e => e.id !== id) })),

    // work results
    addWorkResult: (w) => setState(s => ({ ...s, workResults: [{ id: uid('w'), date: todayStr(), type: '任务', createdAt: Date.now(), ...w }, ...s.workResults] })),
    removeWorkResult: (id) => setState(s => ({ ...s, workResults: s.workResults.filter(w => w.id !== id) })),

    // profile & settings
    setGoal: (goal) => setState(s => ({ ...s, profile: { ...s.profile, goal } })),
    updateProfile: (patch) => setState(s => ({ ...s, profile: { ...s.profile, ...patch } })),
    updateSettings: (patch) => setState(s => ({ ...s, settings: { ...s.settings, ...patch } })),
    setTheme: (theme) => setState(s => ({ ...s, settings: { ...s.settings, theme: THEMES.some(t => t.id === theme) ? theme : DEFAULT_THEME } })),

    // data io
    importData: (json) => setState(() => {
      const parsed = JSON.parse(json)
      const base = seedState()
      return { ...base, ...parsed }
    }),
    resetAll: () => setState(seedState()),
  }), [])

  const derived = useMemo(() => {
    const tasks = state.tasks
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'done').length
    const doing = tasks.filter(t => t.status === 'doing').length
    const todo = tasks.filter(t => t.status === 'todo').length
    const completion = total ? Math.round((done / total) * 100) : 0
    const quadrantCounts = {
      Q1: tasks.filter(t => t.quadrant === 'Q1' && t.status !== 'done').length,
      Q2: tasks.filter(t => t.quadrant === 'Q2' && t.status !== 'done').length,
      Q3: tasks.filter(t => t.quadrant === 'Q3' && t.status !== 'done').length,
      Q4: tasks.filter(t => t.quadrant === 'Q4' && t.status !== 'done').length,
    }
    const topTasks = tasks.filter(t => t.todayTop && t.status !== 'done').slice(0, 3)
    const todayFocus = state.focus.sessions.filter(s => s.date === todayStr())
    const focusMinutes = todayFocus.reduce((a, s) => a + s.minutes, 0)
    const focusHours = Math.round((focusMinutes / 60) * 10) / 10
    const focusRate = state.focus.goalHours ? Math.min(100, Math.round((focusHours / state.focus.goalHours) * 100)) : 0
    const habits = (state.habits || []).map(h => ({ ...h, streak: calcStreak(h.history) }))
    const habitsDone = habits.filter(h => h.done).length
    return { total, done, doing, todo, completion, quadrantCounts, topTasks, focusHours, focusRate, focusSessions: todayFocus.length, focusSessionList: todayFocus, habits, habitsDone }
  }, [state])

  return (
    <StoreContext.Provider value={{ state, actions, derived, uid }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
