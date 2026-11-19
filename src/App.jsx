import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard, Inbox, ListTodo, CalendarDays, Grid2x2, Timer,
  FolderKanban, Target, CheckCircle2, BookOpen, Lightbulb, Award,
  FileText, RefreshCw, Settings, HelpCircle, Command, PanelRight, Menu,
} from 'lucide-react'
import { useStore } from './store'
import CommandPalette from './components/CommandPalette'
import MiniPanel from './components/MiniPanel'
import WindowControls from './components/WindowControls'
import { ThemeQuickSwitch } from './components/ThemePicker'
import { isTauri, openMiniWindow } from './miniWindow'

import logoMark from './assets/logo-mark.png'
import Dashboard from './pages/Dashboard'
import InboxPage from './pages/InboxPage'
import TasksPage from './pages/TasksPage'
import BlocksPage from './pages/BlocksPage'
import FocusPage from './pages/FocusPage'
import ReviewPage from './pages/ReviewPage'
import ProjectsPage from './pages/ProjectsPage'
import GoalsPage from './pages/GoalsPage'
import HabitsPage from './pages/HabitsPage'
import KnowledgePage from './pages/KnowledgePage'
import ExperiencePage from './pages/ExperiencePage'
import AchievementsPage from './pages/AchievementsPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import HelpPage from './pages/HelpPage'
import Placeholder from './pages/Placeholder'

const NAV = [
  { group: '工作台', items: [
    { key: 'dashboard', label: '首页驾驶舱', icon: LayoutDashboard, page: 'dashboard' },
    { key: 'inbox', label: '闪念', icon: Inbox, page: 'inbox', badge: true },
    { key: 'tasks', label: '任务管理', icon: ListTodo, page: 'tasks' },
    { key: 'blocks', label: '日程 / 时间块', icon: CalendarDays, page: 'blocks' },
  ]},
  { group: '效率', items: [
    { key: 'matrix', label: '优先级 / 四象限', icon: Grid2x2, page: 'tasks', tab: 'matrix' },
    { key: 'focus', label: '专注计时', icon: Timer, page: 'focus' },
    { key: 'projects', label: '项目管理', icon: FolderKanban, page: 'projects' },
    { key: 'goals', label: '目标管理', icon: Target, page: 'goals' },
    { key: 'habits', label: '习惯打卡', icon: CheckCircle2, page: 'habits' },
  ]},
  { group: '知识', items: [
    { key: 'knowledge', label: '知识素材库', icon: BookOpen, page: 'knowledge' },
    { key: 'experience', label: '经验素材库', icon: Lightbulb, page: 'experience' },
    { key: 'achievements', label: '工作成果', icon: Award, page: 'achievements' },
  ]},
  { group: '复盘', items: [
    { key: 'report', label: '周报 / 月报', icon: FileText, page: 'report' },
    { key: 'review', label: '时间复盘', icon: RefreshCw, page: 'review' },
    { key: 'settings', label: '设置中心', icon: Settings, page: 'settings' },
    { key: 'help', label: '使用手册', icon: HelpCircle, page: 'help' },
  ]},
]

const TITLES = {
  dashboard: ['时间管理工作台', '把时间花在最重要的事上'],
  inbox: ['闪念', '闪念一响，先接住再想'],
  tasks: ['任务管理', '聚焦执行，逐个击破'],
  blocks: ['日程 / 时间块', '为重要的事预留专属时段'],
  focus: ['专注计时', '一次只做一件事'],
  review: ['时间复盘', '沉淀经验，持续进化'],
  projects: ['项目管理', '把大事拆成可推进的里程碑'],
  goals: ['目标管理', '有目标，时间才有方向'],
  habits: ['习惯打卡', '坚持会带来复利'],
  knowledge: ['知识素材库', '把碎片沉淀成资产'],
  experience: ['经验素材库', '踩过的坑都是护城河'],
  achievements: ['工作成果', '看得见的积累'],
  report: ['周报 / 月报', '用数据看清时间去向'],
  settings: ['设置中心', '个性化与数据管理'],
  help: ['使用手册', '三分钟看懂全部功能'],
}

function Sidebar({ active, onNav }) {
  const { state } = useStore()
  return (
    <aside className="sidebar">
      <div className="brand" data-tauri-drag-region="deep">
        <div className="brand-mark"><img src={logoMark} alt="" /></div>
        <div>
          <div className="brand-title">织日</div>
          <div className="brand-sub">DAYWEAVE</div>
        </div>
      </div>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="nav-label">{g.group}</div>
          {g.items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                className={`nav-item ${active === item.key ? 'active' : ''}`}
                onClick={() => onNav(item)}
              >
                <span className="nav-ico"><Icon size={17} strokeWidth={2} /></span>
                <span>{item.label}</span>
                {item.badge && state.inbox.length > 0 && <span className="nav-badge">{state.inbox.length}</span>}
                {item.soon && <span className="nav-soon">即将上线</span>}
              </button>
            )
          })}
        </div>
      ))}
      <div className="sidebar-foot">
        <div className="kbd-hint"><Command size={11} /> <b>Ctrl</b> / <b>⌘</b> + <b>K</b> 快速跳转与捕捉</div>
        <div className="quote">"<b>你的时间</b>，值得被认真对待。<br/>今天也要做时间的主人。"</div>
      </div>
    </aside>
  )
}

function getWeekday() {
  return ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][new Date().getDay()]
}

export default function App() {
  const [nav, setNav] = useState({ key: 'dashboard', page: 'dashboard' })
  const { state } = useStore()
  const [tabHint, setTabHint] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [floatOpen, setFloatOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const onNav = (item) => {
    setNav(item)
    setTabHint(item.tab || null)
    setNavOpen(false)
  }

  // 窄屏抽屉：Esc 关闭
  useEffect(() => {
    if (!navOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  // 拉宽到桌面尺寸时自动收起抽屉，避免遮罩状态残留
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)')
    const onChange = (e) => { if (e.matches) setNavOpen(false) }
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  // 全局快捷键：Ctrl/Cmd + K 打开命令面板
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const flatNav = NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.group })))

  const renderPage = () => {
    switch (nav.page) {
      case 'dashboard': return <Dashboard onNav={onNav} />
      case 'inbox': return <InboxPage />
      case 'tasks': return <TasksPage key={nav.key + (tabHint || '')} initialTab={tabHint} />
      case 'blocks': return <BlocksPage />
      case 'focus': return <FocusPage />
      case 'review': return <ReviewPage />
      case 'projects': return <ProjectsPage />
      case 'goals': return <GoalsPage />
      case 'habits': return <HabitsPage />
      case 'knowledge': return <KnowledgePage />
      case 'experience': return <ExperiencePage />
      case 'achievements': return <AchievementsPage />
      case 'report': return <ReportPage />
      case 'settings': return <SettingsPage />
      case 'help': return <HelpPage />
      default:
        return <Placeholder title={TITLES[nav.page]?.[0] || nav.label || '模块'} label={NAV.flatMap(g=>g.items).find(i=>i.key===nav.key)?.label} />
    }
  }

  const [title, subtitle] = TITLES[nav.page] || [NAV.flatMap(g=>g.items).find(i=>i.key===nav.key)?.label || '织日', '把时间和念头，织成每一天']
  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 · ${getWeekday()}`

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar active={nav.key} onNav={onNav} />
      {navOpen && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setNavOpen(false)} />}
      <div className="main">
        {/* 无边框窗口：顶栏即标题栏。deep 让整条顶栏（含文字/图标）都能拖拽，
            按钮等可点击元素本身会拦截拖拽，双击空白处触发最大化/还原。 */}
        <header className="topbar" data-tauri-drag-region="deep">
          <button className="nav-toggle" aria-label="打开导航" onClick={() => setNavOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1>{title}</h1>
            <div className="date">{dateStr}</div>
          </div>
          <div className="topbar-spacer" />
          <button className="top-btn" title="浮窗卡片：随时看到进行中的任务与专注倒计时" onClick={async () => {
            if (isTauri()) {
              const ok = await openMiniWindow()
              if (!ok) setFloatOpen(true)
            } else {
              setFloatOpen(v => !v)
            }
          }}>
            <PanelRight size={14} /> <span className="top-btn-kbd">浮窗</span>
          </button>
          <button className="top-btn" title="打开命令面板（Ctrl / ⌘ + K）" onClick={() => setPaletteOpen(true)}>
            <Command size={14} /> <span className="top-btn-kbd">Ctrl K</span>
          </button>
          <button className="top-btn icon" title="使用手册" onClick={() => onNav(flatNav.find(i => i.key === 'help'))}>
            <HelpCircle size={16} />
          </button>
          <ThemeQuickSwitch />
          <div className="top-avatar">{state.profile.name?.[0]?.toUpperCase() || 'K'}</div>
          <WindowControls />
        </header>
        <main className="content">
          <div className="content-inner">
            {renderPage()}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={flatNav} onNav={onNav} />
      {floatOpen && (
        <MiniPanel
          mode="float"
          onClose={() => setFloatOpen(false)}
          onOpenMain={() => onNav(flatNav.find(i => i.key === 'focus'))}
        />
      )}
    </div>
  )
}
