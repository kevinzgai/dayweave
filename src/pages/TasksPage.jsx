import React, { useEffect, useRef, useState } from 'react'
import {
  Plus, Trash2, CheckCircle2, Grid2x2, ListTodo, Clock, Flag, Check,
  Pencil, Move, Search, X, ArrowUpNarrowWide, ArrowDownWideNarrow, ListFilter,
} from 'lucide-react'
import { useStore, QUADRANTS, TASK_STATUS } from '../store'
import TaskEditor from '../components/TaskEditor'
import {
  Button, Card, Checkbox, ConfirmDialog, FormField, FormGrid, IconButton, Modal,
  Pill, Segmented, Select, TextInput, TONES, cx,
} from '../ui'

function AddTask({ onAdd }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', quadrant: 'Q2', time: '', todayTop: false })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const topCount = state.tasks.filter(t => t.todayTop && t.status !== 'done').length
  const topFull = topCount >= 3
  const close = () => {
    setOpen(false)
    setForm({ title: '', quadrant: 'Q2', time: '', todayTop: false })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({ ...form, title: form.title.trim() })
    close()
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>新建任务</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="新建任务"
        subtitle="先写下来，细节可以之后在编辑里补"
        icon={ListTodo}
        size="lg"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="任务标题" required>
          <TextInput autoFocus placeholder="要做什么？" value={form.title} onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormGrid>
          <FormField label="四象限">
            <Select value={form.quadrant} onChange={e => set('quadrant', e.target.value)}>
              {Object.values(QUADRANTS).map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
            </Select>
          </FormField>
          <FormField label="计划时间">
            <TextInput type="time" value={form.time} onChange={e => set('time', e.target.value)} />
          </FormField>
        </FormGrid>
        <Checkbox
          label={topFull
            ? '今日要事已满 3 条，先取消已有的一个再标记'
            : `标记为「今日最重要的 3 件事」（已选 ${topCount}/3）`}
          icon={Flag}
          checked={form.todayTop}
          disabled={topFull}
          className={topFull ? 'opacity-60' : undefined}
          onChange={e => set('todayTop', e.target.checked)}
        />
      </Modal>
    </>
  )
}

/**
 * 状态标签：传了 onCycle 就变成可点的状态切换按钮（与时间块页一致），否则只读展示
 */
function StatusPill({ status, onCycle }) {
  const s = TASK_STATUS[status]
  const tone = status === 'done' ? 'success' : status === 'doing' ? 'brand' : 'neutral'
  if (!onCycle) return <Pill tone={tone}>{s.label}</Pill>
  return (
    <button
      type="button"
      className={cx('pill shrink-0', TONES[tone])}
      title="点击切换状态：待开始 → 进行中 → 已完成"
      onClick={(e) => { e.stopPropagation(); onCycle() }}
    >
      {s.label}
    </button>
  )
}

/* ---------------------------------- 右键菜单 ---------------------------------- */

/** 行内右键菜单：编辑为主入口，状态切换 / 复制 / 删除为补充 */
function TaskMenu({ task, x, y, onClose, onEdit }) {
  const { actions } = useStore()
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const onScroll = () => onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  // 视口内侧边约束
  const style = {
    left: Math.max(8, Math.min(x, (window.innerWidth || 0) - 158)),
    top: Math.max(8, Math.min(y, (window.innerHeight || 0) - 184)),
  }

  const dup = () => {
    actions.addTask({
      title: task.title,
      quadrant: task.quadrant,
      time: task.time,
      // 复制件不继承「今日要事」，避免悄悄挤掉当天的 3 个名额
      todayTop: false,
      status: 'todo',
      note: task.note || '',
    })
    onClose()
  }

  const setDone = () => {
    actions.updateTask(task.id, { status: 'done', progress: 100 })
    onClose()
  }
  const setDoing = () => {
    actions.updateTask(task.id, { status: 'doing' })
    onClose()
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="task-menu"
      style={style}
      data-testid="task-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="task-menu-title">{task.title}</div>
      <button role="menuitem" className="task-menu-item" onClick={() => { onClose(); onEdit(task) }}>
        <Pencil size={13} /> 编辑任务
      </button>
      <button role="menuitem" className="task-menu-item" onClick={task.status === 'done' ? setDoing : setDone}>
        <CheckCircle2 size={13} /> {task.status === 'done' ? '标记为进行中' : '标记为已完成'}
      </button>
      <button role="menuitem" className="task-menu-item" onClick={dup}>
        <Plus size={13} /> 复制任务
      </button>
      <div className="ui-divider my-1" />
      <button
        role="menuitem"
        className="task-menu-item danger"
        onClick={() => { onClose(); actions.removeTask(task.id) }}
      >
        <Trash2 size={13} /> 删除任务
      </button>
    </div>
  )
}

/* ---------------------------------- 状态复选框 ---------------------------------- */

/**
 * 任务标记（复选框）
 * 单击 → 切换完成状态，与驾驶舱、计时浮窗的圆点保持同一语义；
 * 编辑任务走「单击任务行 / 悬停铅笔 / 右键菜单」，避免圆点承担两种含义。
 */
function TaskCheck({ task }) {
  const { actions } = useStore()
  const done = task.status === 'done'
  const toggle = () => actions.toggleTaskDone(task.id)
  return (
    <span
      className="top3-check task-check"
      role="checkbox"
      tabIndex={0}
      aria-checked={done}
      aria-label={done ? `取消完成「${task.title}」` : `完成「${task.title}」`}
      title={done ? '单击取消完成' : '单击标记完成'}
      style={{
        borderColor: done ? 'var(--brand-500)' : 'var(--line-strong)',
        background: done ? 'var(--brand-500)' : 'transparent',
      }}
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          toggle()
        }
      }}
    >
      {done && <CheckCircle2 size={13} />}
    </span>
  )
}

/* ---------------------------- 行内编辑提示（悬停可见） ---------------------------- */

/**
 * 悬停时才淡入的编辑图标（整行单击即可编辑，所以只给一个铅笔图标，不加文案与按钮）
 * 纯提示元素：pointer-events 关闭，不抢任务行的点击与拖拽命中。
 */
function EditHint() {
  return <Pencil size={12} className="row-edit-hint" aria-hidden="true" />
}

/** 点击点落在交互控件（按钮 / 圆点 / 输入框）上时，不触发整行编辑 */
const hitRowControl = (e) => !!e.target.closest('button, .task-check, input, select, textarea')

/**
 * 象限专属配色，用来在列表里一眼区分紧急程度
 * 红 = 重要且紧急（立即做）· 橙 = 重要不紧急（计划做）
 * 蓝 = 不重要但紧急（委托 / 压缩）· 灰 = 不重要不紧急（尽量少做）
 */
const quadStyle = (key) => ({ background: QUADRANTS[key].bg, color: QUADRANTS[key].color })

/* ------------------------------ 搜索 / 筛选 / 排序 ------------------------------ */

const SORT_OPTIONS = [
  { value: 'manual', label: '录入顺序' },
  { value: 'priority', label: '优先级' },
  { value: 'time', label: '计划时间' },
  { value: 'created', label: '创建时间' },
]

const QUAD_ORDER = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 }

const STATUS_TABS = [
  { value: 'all', label: '全部' },
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

/**
 * 列表与四象限共用同一套查询规则：先按关键词 / 象限 / 状态过滤，再排序。
 * 默认值下（无关键词、全部象限、全部状态、录入顺序）原样返回，顺序与 state.tasks 一致。
 */
function applyQuery(tasks, { query = '', quad = 'all', status = 'all', sort = 'manual', desc = false } = {}) {
  const kw = query.trim().toLowerCase()
  let out = tasks
  if (kw) {
    out = out.filter(t =>
      (t.title || '').toLowerCase().includes(kw) || (t.note || '').toLowerCase().includes(kw))
  }
  if (quad !== 'all') out = out.filter(t => t.quadrant === quad)
  if (status !== 'all') out = out.filter(t => t.status === status)
  if (sort === 'manual') return desc ? [...out].reverse() : out

  const key = (t) => (
    sort === 'priority' ? (QUAD_ORDER[t.quadrant] ?? 99)
      : sort === 'time' ? (t.time || '99:99')   // 没排时间的沉到底部
        : (t.createdAt || 0)
  )
  // 取反比较而非 reverse()，这样同值项在新旧两个方向上都保持原有相对顺序
  return [...out].sort((a, b) => {
    const x = key(a); const y = key(b)
    const r = x < y ? -1 : x > y ? 1 : 0
    return desc ? -r : r
  })
}

const isDirty = ({ query, quad, status, sort, desc }) =>
  !!query.trim() || quad !== 'all' || status !== 'all' || sort !== 'manual' || !!desc

/** 搜索 / 筛选 / 排序工具条：两个视图共用，避免各自维护一套条件 */
function TaskFilterBar({ value, onChange, total, shown, onReset }) {
  const { query, quad, status, sort, desc } = value
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="task-filter">
      <Segmented value={status} onChange={v => set('status', v)} items={STATUS_TABS} />
      <div className="flex min-w-[160px] grow items-center gap-2 rounded-field bg-surface px-3 shadow-card sm:max-w-[280px]">
        <Search size={14} className="shrink-0 text-ink-mute" />
        <input
          className="input grow !border-none !bg-transparent !px-0 !shadow-none"
          placeholder="搜索标题 / 备注"
          aria-label="搜索任务"
          data-testid="task-search"
          value={query}
          onChange={e => set('query', e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="shrink-0 text-ink-mute transition-colors hover:text-ink"
            aria-label="清空搜索"
            onClick={() => set('query', '')}
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="w-[148px] shrink-0">
        <Select value={quad} onChange={e => set('quad', e.target.value)} aria-label="按象限筛选" data-testid="task-quad">
          <option value="all">全部象限</option>
          {Object.values(QUADRANTS).map(q => (
            <option key={q.key} value={q.key}>{q.label}</option>
          ))}
        </Select>
      </div>
      <div className="w-[132px] shrink-0">
        <Select value={sort} onChange={e => set('sort', e.target.value)} aria-label="排序方式" data-testid="task-sort">
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <IconButton
        icon={desc ? ArrowDownWideNarrow : ArrowUpNarrowWide}
        label={desc ? '当前降序，点击改为升序' : '当前升序，点击改为降序'}
        data-testid="task-dir"
        onClick={() => set('desc', !desc)}
      />
      {isDirty(value) && (
        <Button variant="ghost" size="sm" icon={ListFilter} data-testid="task-clear" onClick={onReset}>
          清空筛选
        </Button>
      )}
      <span className="ui-help ml-auto" data-testid="task-count">
        {shown === total ? `共 ${total} 项` : `筛选出 ${shown} / ${total} 项`}
      </span>
    </div>
  )
}

/* ---------------------------------- 列表视图 ---------------------------------- */

function ListView({ tasks, onEdit, onRequestDelete }) {
  const { actions } = useStore()
  const [menu, setMenu] = useState(null)

  // 单击行即编辑（主入口）；双击保留为兼容入口，照顾老习惯
  const onRowActivate = (t, e) => {
    if (hitRowControl(e)) return
    e.preventDefault()
    onEdit(t)
  }

  return (
    <>
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <span className="ui-help flex items-center gap-1" data-testid="list-hint">
          <Pencil size={11} /> 单击任务编辑 · 点左侧圆圈标记完成 · 点状态标签切状态
        </span>
      </div>
      {tasks.length === 0 ? (
        <div className="empty">没有符合条件的任务</div>
      ) : (
        <Card>
          {tasks.map((t, idx) => (
            <div
              className="top3-item task-row"
              key={t.id}
              title="单击编辑 · 点圆圈标记完成 · 右键更多操作"
              onClick={(e) => onRowActivate(t, e)}
              onDoubleClick={(e) => onRowActivate(t, e)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ task: t, x: e.clientX, y: e.clientY })
              }}
              style={{
                borderBottom: idx === tasks.length - 1 ? 'none' : '1px solid var(--line)',
              }}
            >
              <TaskCheck task={t} />
              <div className="top3-body">
                <div
                  className="top3-title"
                  title="单击编辑 · 点圆圈标记完成 · 右键更多操作"
                  style={t.status === 'done' ? { color: 'var(--ink-3)', textDecoration: 'line-through' } : {}}
                >
                  {t.title}
                </div>
                {t.note && <div className="top3-note" title={t.note}>{t.note}</div>}
                <div className="top3-meta">
                  <StatusPill status={t.status} onCycle={() => actions.cycleTaskStatus(t.id)} />
                  <Pill
                    className="quad-pill"
                    style={quadStyle(t.quadrant)}
                    title={QUADRANTS[t.quadrant].hint}
                  >
                    {QUADRANTS[t.quadrant].label}
                  </Pill>
                  {t.todayTop && <Pill tone="warning">★ 今日要事</Pill>}
                  {t.time && <span className="ui-help flex items-center gap-1"><Clock size={11} /> {t.time}</span>}
                </div>
              </div>
              <div className="mini-track hidden w-[60px] shrink-0 sm:block"><i style={{ width: t.progress + '%' }} /></div>
              <span className="top3-prog hidden sm:inline">{t.progress}%</span>
              <EditHint />
              <IconButton icon={Trash2} label="删除任务" tone="danger" size={13} onClick={() => onRequestDelete(t)} />
            </div>
          ))}
        </Card>
      )}
      {menu && <TaskMenu {...menu} onClose={() => setMenu(null)} onEdit={onEdit} />}
    </>
  )
}

/* ---------------------------------- 矩阵视图 ---------------------------------- */

function MatrixView({ tasks, filtered, onEdit, onRequestDelete }) {
  const { actions } = useStore()
  const [menu, setMenu] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [overQuad, setOverQuad] = useState(null)
  const active = tasks

  // 拖拽落点：跨象限移动时只改 quadrant，其余字段保持不变
  const moveToQuadrant = (id, quadrant) => {
    if (!id) return
    const task = state.tasks.find(t => t.id === id)
    if (!task || task.quadrant === quadrant) return
    actions.updateTask(id, { quadrant })
  }

  return (
    <>
      <div className="ui-help mb-3 flex items-center gap-1" data-testid="matrix-hint">
        <Move size={11} /> 单击编辑 · 点圆圈标记完成 · 拖拽到其他象限调整重要 / 紧急程度 · 右键更多操作
      </div>
      <div className="quad-grid gap-4">
        {Object.values(QUADRANTS).map(q => {
          const list = active.filter(t => t.quadrant === q.key)
          const isOver = overQuad === q.key
          return (
            <Card
              key={q.key}
              className={isOver ? 'quad-drop-active' : undefined}
              style={{ borderTop: `3px solid ${q.color}` }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (overQuad !== q.key) setOverQuad(q.key)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOverQuad(prev => (prev === q.key ? null : prev))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || draggingId
                setOverQuad(null)
                setDraggingId(null)
                moveToQuadrant(id, q.key)
              }}
            >
              <div className="mb-3">
                <div className="text-[14px] font-700" style={{ color: q.color }}>{q.label}</div>
                <div className="ui-help mt-0.5">{q.hint} · {list.length} 项</div>
              </div>
              {list.length === 0 ? <div className="ui-help py-4">{filtered ? '暂无匹配任务' : '暂无任务'}</div> : list.map((t, idx) => (
                <div
                  className={`task-row flex items-center gap-2 py-2${draggingId === t.id ? ' is-dragging' : ''}`}
                  key={t.id}
                  data-task-id={t.id}
                  draggable
                  title="单击编辑 · 点圆圈标记完成 · 拖拽到其他象限调整 · 右键更多操作"
                  onClick={(e) => { if (hitRowControl(e)) return; onEdit(t) }}
                  onDragStart={(e) => {
                    e.stopPropagation()
                    setDraggingId(t.id)
                    e.dataTransfer.setData('text/plain', t.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => { setDraggingId(null); setOverQuad(null) }}
                  onDoubleClick={(e) => { e.preventDefault(); onEdit(t) }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ task: t, x: e.clientX, y: e.clientY })
                  }}
                  style={{ borderBottom: idx === list.length - 1 ? 'none' : '1px solid var(--line)' }}
                >
                  <TaskCheck task={t} />
                  <span className="grow cursor-grab truncate text-[12.5px]" title="单击编辑 · 拖拽调整象限 · 右键更多操作" onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(t) }}>{t.title}</span>
                  <EditHint />
                  <IconButton icon={Trash2} label="删除任务" tone="danger" size={12} onClick={() => onRequestDelete(t)} />
                </div>
              ))}
            </Card>
          )
        })}
      </div>
      {menu && <TaskMenu {...menu} onClose={() => setMenu(null)} onEdit={onEdit} />}
    </>
  )
}

const FILTER_INIT = { query: '', quad: 'all', status: 'all', sort: 'manual', desc: false }

export default function TasksPage({ initialTab }) {
  const { state, actions } = useStore()
  const [tab, setTab] = useState(initialTab === 'matrix' ? 'matrix' : 'list')
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [query, setQuery] = useState(FILTER_INIT)

  const matched = applyQuery(state.tasks, query)
  // 四象限看的是「还没完成的活」：状态选「全部」时沿用这个口径，选了具体状态才按状态过滤
  const shown = tab === 'matrix' && query.status === 'all'
    ? matched.filter(t => t.status !== 'done')
    : matched

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { value: 'list', label: '列表', icon: ListTodo },
            { value: 'matrix', label: '四象限', icon: Grid2x2 },
          ]}
        />
        <div className="toolbar-actions flex items-center gap-2">
          <AddTask onAdd={actions.addTask} />
        </div>
      </div>
      <TaskFilterBar
        value={query}
        onChange={setQuery}
        total={state.tasks.length}
        shown={shown.length}
        onReset={() => setQuery(FILTER_INIT)}
      />
      {tab === 'list'
        ? <ListView tasks={shown} onEdit={setEditing} onRequestDelete={setPendingDelete} />
        : <MatrixView tasks={shown} filtered={isDirty(query)} onEdit={setEditing} onRequestDelete={setPendingDelete} />}
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!pendingDelete}
        title="删除任务"
        message={pendingDelete ? `确定删除「${pendingDelete.title}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        danger
        onConfirm={() => {
          actions.removeTask(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}