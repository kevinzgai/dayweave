import React, { useState } from 'react'
import { Plus, Trash2, Target, Calendar, Minus, Check, FolderKanban, ListTodo } from 'lucide-react'
import { useStore, GOAL_CATS } from '../store'
import {
  Button, Card, EmptyState, FormField, FormGrid, IconButton, Modal, PageHero,
  PageToolbar, Select, TextInput,
} from '../ui'

const CAT_COLOR = { 事业: '#7170FF', 学习: '#E8A13A', 健康: '#E8607A', 财务: '#3FB37F', 生活: '#4F8EF7' }

function AddGoal({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', cat: '事业', target: 100, unit: '%', deadline: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const close = () => {
    setOpen(false)
    setForm({ title: '', cat: '事业', target: 100, unit: '%', deadline: '' })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({ ...form, title: form.title.trim(), target: +form.target || 100 })
    close()
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>新建目标</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="新建目标"
        subtitle="设定一个可量化、可推进的目标"
        icon={Target}
        size="lg"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="目标" required>
          <TextInput autoFocus placeholder="例如：今年读完 24 本书" value={form.title} onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormGrid>
          <FormField label="分类">
            <Select value={form.cat} onChange={e => set('cat', e.target.value)}>
              {GOAL_CATS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="截止日期">
            <TextInput type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </FormField>
          <FormField label="目标值">
            <TextInput type="number" min="1" value={form.target} onChange={e => set('target', e.target.value)} />
          </FormField>
          <FormField label="单位" hint="例如：本、次、小时、%">
            <TextInput value={form.unit} onChange={e => set('unit', e.target.value)} />
          </FormField>
        </FormGrid>
      </Modal>
    </>
  )
}

export default function GoalsPage() {
  const { state, actions } = useStore()
  const goals = state.goals || []
  const byCat = GOAL_CATS.map(c => ({ cat: c, items: goals.filter(g => g.cat === c) })).filter(x => x.items.length)

  return (
    <div>
      <PageHero
        eyebrow="GOALS · 目标管理"
        title="有目标，"
        highlight="时间才有方向。"
        desc="设定可量化的目标，让每天的投入都朝着它靠近。"
        metric={goals.length}
        metricLabel="进行中目标"
        metricWidth={120}
      />

      <PageToolbar title="我的目标" sub="点 +/− 更新进度" actions={<AddGoal onAdd={actions.addGoal} />} />

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="还没有目标" hint="先定一个，哪怕只写一个方向" />
      ) : byCat.map(group => (
        <div key={group.cat} className="mb-6">
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-700" style={{ color: CAT_COLOR[group.cat] }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CAT_COLOR[group.cat] }} />
            {group.cat}
          </div>
          <Card>
            {group.items.map((g, idx) => {
              const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0
              const col = CAT_COLOR[g.cat]
              return (
                <div
                  key={g.id}
                  className="py-3"
                  style={{ borderBottom: idx === group.items.length - 1 ? 'none' : '1px solid var(--line)' }}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Target size={15} style={{ color: col }} className="shrink-0" />
                      <span className="truncate text-[13px] font-600">{g.title}</span>
                      {g.deadline && (
                        <span className="ui-help flex shrink-0 items-center gap-1">
                          <Calendar size={11} /> {g.deadline}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" aria-label="减少进度" onClick={() => actions.updateGoal(g.id, { current: Math.max(0, g.current - Math.max(1, Math.round(g.target * 0.05))) })}>
                        <Minus size={12} />
                      </Button>
                      <span className="min-w-[76px] text-center text-[11px] font-700">{g.current} / {g.target} {g.unit}</span>
                      <Button variant="ghost" size="sm" aria-label="增加进度" onClick={() => actions.updateGoal(g.id, { current: Math.min(g.target, g.current + Math.max(1, Math.round(g.target * 0.05))) })}>
                        <Plus size={12} />
                      </Button>
                      <IconButton icon={Trash2} label="删除目标" tone="danger" size={12} onClick={() => actions.removeGoal(g.id)} />
                    </div>
                  </div>
                  <div className="bar-track"><i style={{ width: pct + '%', background: col }} /></div>
                  <div className="ui-help mt-1.5">完成度 {pct}%</div>
                  {/* 关联：这条目标下面挂着哪些项目 / 任务 */}
                  {(() => {
                    const relProjects = (state.projects || []).filter(p => p.goalId === g.id)
                    const relTasks = (state.tasks || []).filter(t => t.goalId === g.id)
                    if (!relProjects.length && !relTasks.length) return null
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {relProjects.length > 0 && (
                          <span className="ui-help flex items-center gap-1">
                            <FolderKanban size={11} /> {relProjects.length} 个项目
                            {relProjects.slice(0, 2).map(p => ` · ${p.name}`).join('')}
                          </span>
                        )}
                        {relTasks.length > 0 && (
                          <span className="ui-help flex items-center gap-1">
                            <ListTodo size={11} /> {relTasks.length} 个任务
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </Card>
        </div>
      ))}
    </div>
  )
}
