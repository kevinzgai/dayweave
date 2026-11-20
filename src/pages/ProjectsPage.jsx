import React, { useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Calendar, Check, CheckCircle2, Clock, Flag, FolderKanban,
  ListTodo, MessageSquarePlus, Pencil, Plus, Target, Trash2,
} from 'lucide-react'
import {
  useStore, todayStr, projectProgress, projectHealth, lastActivity, lastActivityDays,
  PROJECT_STATUS, UPDATE_TYPES, STALL_DAYS, TASK_STATUS,
} from '../store'
import {
  Button, Card, EmptyState, FormField, FormGrid, IconButton, Modal, PageToolbar,
  Pill, SectionHead, Segmented, Select, Stat, StatGrid, TextInput,
} from '../ui'

const COLORS = ['#7170FF', '#E8A13A', '#3FB37F', '#E8607A', '#4F8EF7', '#9B7BE8']

const HEALTH = {
  overdue: { label: '已逾期', tone: 'danger' },
  stalled: { label: `停滞 ${STALL_DAYS}+ 天`, tone: 'warning' },
}

const mdShort = (d) => (d ? d.slice(5) : '')

const lastLabel = (p) => {
  const d = lastActivity(p)
  if (!d) return '尚未跟进'
  const days = lastActivityDays(p)
  return days === 0 ? '今天有跟进' : `最后跟进 ${mdShort(d)} · ${days} 天前`
}

// 计划周期条数据：需要开始 + 完成两个日期
function planInfo(p) {
  const startDate = p.startDate || ''
  const deadline = p.deadline || ''
  if (!startDate || !deadline) return null
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${deadline}T00:00:00`)
  const now = new Date(`${todayStr()}T00:00:00`)
  const span = Math.max(86400000, end - start)
  const elapsed = Math.min(1, Math.max(0, (now - start) / span))
  const reached = Math.min(Math.max(now.getTime(), start.getTime()), end.getTime())
  return {
    startDate, deadline, elapsed, over: now > end,
    days: Math.round(span / 86400000),
    elapsedDays: Math.max(0, Math.round((reached - start.getTime()) / 86400000)),
  }
}

function PlanBar({ p, color, className }) {
  const info = planInfo(p)
  if (!info) {
    const single = p.startDate ? `计划开始 ${p.startDate}` : p.deadline ? `截止 ${p.deadline}` : ''
    if (!single) return null
    return (
      <div className={`ui-help flex items-center gap-1.5 ${className || ''}`}>
        <Calendar size={12} /> {single}
      </div>
    )
  }
  return (
    <div className={className}>
      <div className="tl-track">
        <i style={{ width: `${info.elapsed * 100}%`, background: info.over ? 'var(--danger)' : color }} />
        <b style={{ left: `${info.elapsed * 100}%` }} />
      </div>
      <div className="tl-labels">
        <span>{mdShort(info.startDate)} 开始</span>
        <span style={info.over ? { color: 'var(--danger)' } : undefined}>{info.over ? '已超期' : '今天'}</span>
        <span>{mdShort(info.deadline)} 截止</span>
      </div>
    </div>
  )
}

function AddProject({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', desc: '', startDate: '', deadline: '', color: COLORS[0] })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const close = () => {
    setOpen(false)
    setForm({ name: '', desc: '', startDate: '', deadline: '', color: COLORS[0] })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onAdd({ ...form, name: form.name.trim() })
    close()
  }
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>新建项目</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="新建项目"
        subtitle="把一件大事拆成可推进的里程碑"
        icon={FolderKanban}
        size="lg"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="项目名称" required>
          <TextInput autoFocus placeholder="例如：官网改版" value={form.name} onChange={e => set('name', e.target.value)} />
        </FormField>
        <FormField label="简介" hint="一句话说明项目目标">
          <TextInput placeholder="例如：重构首页，把首屏加载压到 1s 内" value={form.desc} onChange={e => set('desc', e.target.value)} />
        </FormField>
        <FormGrid>
          <FormField label="计划开始">
            <TextInput type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </FormField>
          <FormField label="截止日期">
            <TextInput type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="标识颜色">
          <div className="flex flex-wrap items-center gap-2 py-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`选择颜色 ${c}`}
                onClick={() => set('color', c)}
                className="h-6 w-6 rounded-sm transition-transform hover:scale-110"
                style={{
                  background: c,
                  boxShadow: form.color === c ? '0 0 0 2px var(--surface), 0 0 0 4px ' + c : 'none',
                }}
              />
            ))}
          </div>
        </FormField>
      </Modal>
    </>
  )
}

/* ----------------------------- 列表视图 ----------------------------- */
function ProjectsList({ onSelect }) {
  const { state, actions } = useStore()
  const projects = state.projects
  const total = projects.length
  const doneCount = projects.filter(p => p.status === 'done' || projectProgress(p) >= 100).length
  const attention = projects.filter(p => projectHealth(p) !== 'ok').length
  const avg = total ? Math.round(projects.reduce((a, p) => a + projectProgress(p), 0) / total) : 0

  return (
    <div>
      <StatGrid className="mb-6">
        <Stat icon={FolderKanban} value={total} label="项目总数" tone="brand" />
        <Stat icon={CheckCircle2} value={doneCount} label="已完成" tone="success" />
        <Stat icon={AlertTriangle} value={attention} label="需要关注" tone="danger" />
        <Stat icon={Clock} value={`${avg}%`} label="平均进度" tone="violet" />
      </StatGrid>

      <PageToolbar title="项目列表" sub="点击卡片进入跟进详情" actions={<AddProject onAdd={actions.addProject} />} />

      {total === 0 ? (
        <EmptyState icon={FolderKanban} title="还没有项目" hint="点击右上角新建，把长期目标拆成可推进的单元" />
      ) : (
        <div className="grid-2">
          {projects.map(p => {
            const progress = projectProgress(p)
            const health = projectHealth(p)
            const milestones = p.milestones || []
            const doneMs = milestones.filter(m => m.done).length
            return (
              <Card
                key={p.id}
                interactive
                className="project-card flex min-h-[196px] flex-col"
                style={{ borderTop: `3px solid ${p.color}` }}
                onClick={() => onSelect(p.id)}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="text-[14px] font-700 leading-snug">{p.name}</div>
                  <div className="flex shrink-0 items-center gap-1">
                    {health !== 'ok' && <Pill tone={HEALTH[health].tone}>{HEALTH[health].label}</Pill>}
                    <IconButton
                      icon={Trash2} label="删除项目" tone="danger" size={13}
                      onClick={e => { e.stopPropagation(); actions.removeProject(p.id) }}
                    />
                  </div>
                </div>
                {p.desc && <div className="ui-help mb-2">{p.desc}</div>}

                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Pill tone={PROJECT_STATUS[p.status]?.tone || 'neutral'}>{PROJECT_STATUS[p.status]?.label || '进行中'}</Pill>
                  {milestones.length > 0 && <span className="ui-help">节点 {doneMs}/{milestones.length}</span>}
                  <span className="ui-help">{lastLabel(p)}</span>
                </div>

                <PlanBar p={p} color={p.color} className="mb-3" />

                <div className="grow" />

                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-ink-mute">进度</span>
                  <span className="font-700 tabular-nums" style={{ color: p.color }}>{progress}%</span>
                </div>
                <div className="bar-track"><i style={{ width: `${progress}%`, background: p.color }} /></div>
                {/* 阻断滑条点击冒泡，避免拖动时跳进详情 */}
                <div className="pt-2" onClick={e => e.stopPropagation()}>
                  {p.progressMode === 'manual' ? (
                    <input
                      type="range" min="0" max="100" value={progress}
                      aria-label={`${p.name} 进度`}
                      onChange={e => actions.updateProject(p.id, { progress: +e.target.value })}
                      className="w-full"
                      style={{ accentColor: p.color }}
                    />
                  ) : (
                    <div className="ui-help text-center">进度由节点自动计算</div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- 详情视图 ----------------------------- */
function ProjectDetail({ projectId, onBack }) {
  const { state, actions } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [ms, setMs] = useState({ title: '', due: '', weight: 1 })
  const [upd, setUpd] = useState({ type: 'progress', content: '', progress: '' })
  const feedRef = useRef(null)
  const taRef = useRef(null)

  const p = state.projects.find(x => x.id === projectId)
  if (!p) {
    return <EmptyState icon={FolderKanban} title="项目不存在" action={<Button icon={ArrowLeft} onClick={onBack}>返回列表</Button>} />
  }

  const progress = projectProgress(p)
  const health = projectHealth(p)
  const milestones = p.milestones || []
  const doneMs = milestones.filter(m => m.done).length
  const updates = p.updates || []
  const linked = state.tasks.filter(t => t.projectId === p.id)
  const info = planInfo(p)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openEdit = () => {
    setForm({
      name: p.name, desc: p.desc || '', startDate: p.startDate || '',
      deadline: p.deadline || '', color: p.color,
    })
    setEditOpen(true)
  }
  const saveEdit = (e) => {
    e.preventDefault()
    if (!form?.name?.trim()) return
    actions.updateProject(p.id, { ...form, name: form.name.trim() })
    setEditOpen(false)
  }
  const addMs = (e) => {
    e.preventDefault()
    if (!ms.title.trim()) return
    actions.addMilestone(p.id, {
      title: ms.title.trim(), due: ms.due || '', weight: Math.max(0.5, Number(ms.weight) || 1),
    })
    setMs({ title: '', due: '', weight: 1 })
  }
  const addUpd = (e) => {
    e.preventDefault()
    if (!upd.content.trim()) return
    const payload = { type: upd.type, content: upd.content.trim() }
    if (p.progressMode !== 'auto' && upd.progress !== '') payload.progress = upd.progress
    actions.addProjectUpdate(p.id, payload)
    setUpd({ type: upd.type, content: '', progress: '' })
  }
  const jumpToFeed = () => {
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => taRef.current?.focus(), 320)
  }

  return (
    <div>
      {/* 头部：状态 / 操作 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <IconButton icon={ArrowLeft} label="返回项目列表" onClick={onBack} />
        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-700">{p.name}</span>
            <Pill tone={PROJECT_STATUS[p.status]?.tone || 'neutral'}>{PROJECT_STATUS[p.status]?.label || '进行中'}</Pill>
            {health !== 'ok' && <Pill tone={HEALTH[health].tone}>{HEALTH[health].label}</Pill>}
          </div>
          {p.desc && <div className="ui-help mt-0.5">{p.desc}</div>}

      {/* 关联目标：这个项目服务于哪个目标 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="ui-help flex items-center gap-1.5"><Target size={12} /> 服务于目标</span>
        <div className="w-64">
          <Select
            aria-label="关联目标"
            value={p.goalId || ''}
            onChange={e => actions.updateProject(p.id, { goalId: e.target.value })}
          >
            <option value="">不关联</option>
            {(state.goals || []).map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </Select>
        </div>
        {p.goalId && (state.goals || []).find(g => g.id === p.goalId) && (
          <span className="ui-help">
            目标当前 {(() => { const g = (state.goals || []).find(x => x.id === p.goalId); return `${g.current} / ${g.target} ${g.unit}` })()}
          </span>
        )}
      </div>
        </div>
        <Segmented
          value={p.status}
          onChange={v => actions.updateProject(p.id, { status: v })}
          items={Object.entries(PROJECT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <div className="flex items-center gap-2">
          <Button variant="soft" icon={Pencil} onClick={openEdit}>编辑计划</Button>
          <Button icon={MessageSquarePlus} onClick={jumpToFeed}>记录进展</Button>
        </div>
      </div>

      {/* 进度概览 + 计划时间线 */}
      <div className="grid-2 mb-4">
        <Card>
          <SectionHead title="进度概览" icon={CheckCircle2} flush />
          <div className="mb-3 flex items-end justify-between gap-3 pt-2">
            <div>
              <div className="text-[34px] font-800 leading-none tabular-nums" style={{ color: p.color }}>{progress}%</div>
              <div className="ui-help mt-1.5">{p.progressMode === 'auto' ? '由节点自动计算' : '手动进度'}</div>
            </div>
            <div className="text-right">
              <div className="mini font-700">节点 {doneMs} / {milestones.length}</div>
              <div className="ui-help mt-1">{lastLabel(p)}</div>
            </div>
          </div>
          <div className="bar-track"><i style={{ width: `${progress}%`, background: p.color }} /></div>
          {p.progressMode === 'manual' && (
            <input
              type="range" min="0" max="100" value={progress} aria-label="项目进度"
              onChange={e => actions.updateProject(p.id, { progress: +e.target.value })}
              className="mt-3 w-full" style={{ accentColor: p.color }}
            />
          )}
          <div className="flex justify-end pt-3">
            <Button size="sm" variant="plain" onClick={() => actions.toggleProgressMode(p.id)}>
              {p.progressMode === 'auto' ? '改为手动进度' : '按节点自动计算'}
            </Button>
          </div>
        </Card>

        <Card>
          <SectionHead title="计划时间线" icon={Calendar} flush />
          <div className="pt-3">
            {info ? (
              <>
                <PlanBar p={p} color={p.color} />
                <div className="ui-help mt-2 flex items-center gap-3">
                  <span>共 {info.days} 天</span>
                  <span>已推进 {info.elapsedDays} 天</span>
                  {info.over && <span style={{ color: 'var(--danger)' }}>已超期</span>}
                </div>
              </>
            ) : (
              <div className="ui-help leading-relaxed">
                {p.startDate || p.deadline
                  ? <>当前只有{p.startDate ? '开始日期' : '截止日期'}，补全另一端可查看计划周期条。</>
                  : '尚未设置计划开始与完成时间。'}
                {' '}
                <button type="button" className="underline" onClick={openEdit}>补记时间 →</button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 节点里程碑 */}
      <Card className="mb-4">
        <SectionHead
          title="节点里程碑"
          icon={Flag}
          sub={`${doneMs} / ${milestones.length} 已完成`}
          right={(
            <Pill tone={p.progressMode === 'auto' ? 'brand' : 'neutral'}>
              {p.progressMode === 'auto' ? '进度自动计算' : '进度手动'}
            </Pill>
          )}
        />
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={addMs}>
          <FormField label="节点标题" className="min-w-[180px] grow">
            <TextInput
              placeholder="例如：需求评审通过"
              value={ms.title}
              onChange={e => setMs(s => ({ ...s, title: e.target.value }))}
            />
          </FormField>
          <FormField label="截止日期">
            <TextInput type="date" value={ms.due} onChange={e => setMs(s => ({ ...s, due: e.target.value }))} />
          </FormField>
          <FormField label="权重" hint="越大占比越高">
            <TextInput
              type="number" min="0.5" step="0.5" className="w-24"
              value={ms.weight}
              onChange={e => setMs(s => ({ ...s, weight: e.target.value }))}
            />
          </FormField>
          <Button type="submit" icon={Plus} disabled={!ms.title.trim()}>添加节点</Button>
        </form>

        {milestones.length === 0 ? (
          <div className="empty mini mt-3">还没有节点 — 把项目拆成 3~5 个关键节点，进度就有了依据</div>
        ) : (
          <ul className="mt-3 ms-list">
            {milestones.map(m => {
              const over = !m.done && m.due && m.due < todayStr()
              return (
                <li key={m.id} className="ms-item">
                  <label className="ms-main">
                    <input
                      type="checkbox" className="ui-checkbox" checked={!!m.done}
                      onChange={e => actions.updateMilestone(p.id, m.id, { done: e.target.checked })}
                    />
                    <span className={m.done ? 'ms-title done' : 'ms-title'}>{m.title}</span>
                  </label>
                  <div className="flex shrink-0 items-center gap-2">
                    {Number(m.weight) !== 1 && <span className="ui-help">×{m.weight}</span>}
                    {m.due && (over
                      ? <Pill tone="danger">{mdShort(m.due)} 逾期</Pill>
                      : <span className="ui-help tabular-nums">{mdShort(m.due)} 截止</span>)}
                    <IconButton
                      icon={Trash2} label="删除节点" tone="danger" size={12}
                      onClick={() => actions.removeMilestone(p.id, m.id)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* 跟进记录 + 关联任务 */}
      <div className="grid-2">
        <Card>
          <SectionHead title="跟进记录" icon={MessageSquarePlus} sub={`${updates.length} 条`} />
          <form className="mt-3" onSubmit={addUpd}>
            <Segmented
              value={upd.type}
              onChange={v => setUpd(u => ({ ...u, type: v }))}
              items={Object.entries(UPDATE_TYPES).map(([k, v]) => ({ value: k, label: v.label }))}
            />
            <textarea
              ref={taRef}
              className="textarea mt-2 w-full"
              rows={3}
              placeholder="这条记录写了什么？最近推进了什么 / 卡在哪 / 计划怎么调整"
              value={upd.content}
              onChange={e => setUpd(u => ({ ...u, content: e.target.value }))}
            />
            <div className="mt-2 flex items-end gap-2">
              {p.progressMode !== 'auto' && (
                <FormField label="当前进度 %" className="w-32">
                  <TextInput
                    type="number" min="0" max="100" placeholder={String(progress)}
                    value={upd.progress}
                    onChange={e => setUpd(u => ({ ...u, progress: e.target.value }))}
                  />
                </FormField>
              )}
              <div className="grow" />
              <Button type="submit" icon={Check} disabled={!upd.content.trim()}>记录</Button>
            </div>
          </form>

          <div ref={feedRef} className="mt-3">
            {updates.length === 0 ? (
              <div className="empty mini">还没有跟进记录，第一条从今天开始</div>
            ) : updates.map(u => (
              <div key={u.id} className="feed-item">
                <div className="mb-1 flex items-center gap-2">
                  <span className="mini font-700 tabular-nums">{u.date}</span>
                  <Pill tone={UPDATE_TYPES[u.type]?.tone || 'neutral'}>{UPDATE_TYPES[u.type]?.label || '记录'}</Pill>
                  {u.progress != null && <span className="mini muted">进度 {u.progress}%</span>}
                  <div className="grow" />
                  <IconButton
                    icon={Trash2} label="删除记录" tone="danger" size={12}
                    onClick={() => actions.removeProjectUpdate(p.id, u.id)}
                  />
                </div>
                <div className="text-[12.5px] leading-relaxed">{u.content}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHead title="关联任务" icon={ListTodo} sub={`${linked.length} 个`} />
          <div className="mt-2">
            {linked.length === 0 ? (
              <div className="empty mini">在任务编辑里选择「归属项目」，任务就会挂到这里</div>
            ) : linked.map(t => (
              <div key={t.id} className="feed-item flex items-center gap-2">
                <span className={`grow text-[12.5px] ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                <Pill tone={t.status === 'done' ? 'success' : t.status === 'doing' ? 'brand' : 'neutral'}>
                  {TASK_STATUS[t.status]?.label || t.status}
                </Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 编辑计划 */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        as="form"
        onSubmit={saveEdit}
        title="编辑计划"
        subtitle="名称、起止时间与标识颜色"
        icon={Pencil}
        size="lg"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={() => setEditOpen(false)}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="项目名称" required>
          <TextInput value={form?.name || ''} onChange={e => set('name', e.target.value)} />
        </FormField>
        <FormField label="简介" hint="一句话说明项目目标">
          <TextInput value={form?.desc || ''} onChange={e => set('desc', e.target.value)} />
        </FormField>
        <FormGrid>
          <FormField label="计划开始">
            <TextInput type="date" value={form?.startDate || ''} onChange={e => set('startDate', e.target.value)} />
          </FormField>
          <FormField label="计划完成">
            <TextInput type="date" value={form?.deadline || ''} onChange={e => set('deadline', e.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="标识颜色">
          <div className="flex flex-wrap items-center gap-2 py-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`选择颜色 ${c}`}
                onClick={() => set('color', c)}
                className="h-6 w-6 rounded-sm transition-transform hover:scale-110"
                style={{
                  background: c,
                  boxShadow: form?.color === c ? '0 0 0 2px var(--surface), 0 0 0 4px ' + c : 'none',
                }}
              />
            ))}
          </div>
        </FormField>
      </Modal>
    </div>
  )
}

export default function ProjectsPage() {
  const { state } = useStore()
  const [selectedId, setSelectedId] = useState(null)
  const selected = state.projects.some(p => p.id === selectedId) ? selectedId : null
  if (selected) return <ProjectDetail projectId={selected} onBack={() => setSelectedId(null)} />
  return <ProjectsList onSelect={setSelectedId} />
}
