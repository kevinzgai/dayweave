import React, { useState } from 'react'
import { Plus, ListTodo, Check, Flag } from 'lucide-react'
import { useStore, QUADRANTS, todayStr, canBeTodayTop } from '../store'
import { Button, Checkbox, FormField, FormGrid, Modal, Select, TextInput } from '../ui'

export default function AddTask({ onAdd, compact = false, onCreated, portalTarget }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', quadrant: 'Q2', date: todayStr(), time: '', todayTop: false, projectId: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'date' && !canBeTodayTop({ date: v }) ? { todayTop: false } : {}) }))
  const topCount = state.tasks.filter(t => t.todayTop && t.status !== 'done' && canBeTodayTop(t)).length
  const topFull = topCount >= 3
  const future = !canBeTodayTop(form)
  const show = () => { setForm({ title: '', quadrant: 'Q2', date: todayStr(), time: '', todayTop: false, projectId: '' }); setOpen(true) }
  const close = () => {
    setOpen(false)
    setForm({ title: '', quadrant: 'Q2', date: todayStr(), time: '', todayTop: false, projectId: '' })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({ ...form, title: form.title.trim(), todayTop: form.todayTop && !topFull })
    close()
    onCreated?.()
  }

  return (
    <>
      {compact ? (
        <button className="mini-add" onClick={show} title="新建任务" aria-label="新建任务">
          <Plus size={14} />
        </button>
      ) : <Button icon={Plus} onClick={show}>新建任务</Button>}
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="新建任务"
        subtitle={compact ? undefined : '先写下来，细节可以之后在编辑里补'}
        icon={ListTodo}
        size={compact ? 'sm' : 'lg'}
        className={compact ? 'mini-create-modal' : undefined}
        maskClassName={compact ? 'mini-create-mask' : undefined}
        portalTarget={portalTarget?.current}
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check} disabled={compact && !form.title.trim()}>保存</Button>
          </>
        }
      >
        <FormField label="任务标题" required>
          <TextInput autoFocus placeholder="要做什么？" value={form.title} onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormGrid className={compact ? 'mini-create-grid' : undefined}>
          <FormField label="四象限">
            <Select value={form.quadrant} onChange={e => set('quadrant', e.target.value)}>
              {Object.values(QUADRANTS).map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
            </Select>
          </FormField>
          <FormField label="计划日期（可留空）">
            <TextInput type="date" aria-label="计划日期" value={form.date} onChange={e => set('date', e.target.value)} />
          </FormField>
          <FormField label="计划时间">
            <TextInput type="time" value={form.time} onChange={e => set('time', e.target.value)} />
          </FormField>
        </FormGrid>
        <Checkbox
          label={future ? '未来日期任务不能设为今日要事' : topFull
            ? '今日要事已满 3 条，先取消已有的一个再标记'
            : compact ? `标记为今日要事（${topCount}/3）` : `标记为「今日最重要的 3 件事」（已选 ${topCount}/3）`}
          icon={Flag}
          checked={form.todayTop && !topFull && !future}
          disabled={topFull || future}
          className={topFull || future ? 'opacity-60' : undefined}
          onChange={e => set('todayTop', e.target.checked)}
        />

        <FormField label="归属项目（可选）" hint="挂上后可在项目详情里跟进">
          <Select value={form.projectId || ''} onChange={e => set('projectId', e.target.value)}>
            <option value="">不关联</option>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
      </Modal>
    </>
  )
}
