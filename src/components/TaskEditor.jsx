import React, { useEffect, useState } from 'react'
import { Save, Trash2, Star, Clock, Flag, AlignLeft } from 'lucide-react'
import { useStore, QUADRANTS, TASK_STATUS, canBeTodayTop } from '../store'
import {
  Button, Checkbox, ConfirmDialog, FormField, FormGrid, Modal,
  Select, TextArea, TextInput,
} from '../ui'

export default function TaskEditor({ task, onClose }) {
  const { state, actions } = useStore()
  const [form, setForm] = useState({
    title: task.title || '',
    note: task.note || '',
    quadrant: task.quadrant || 'Q2',
    status: task.status || 'todo',
    date: task.date || '',
    time: task.time || '',
    progress: task.progress ?? 0,
    todayTop: !!task.todayTop,
    projectId: task.projectId || '',
    goalId: task.goalId || '',
  })
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setForm({
      title: task.title || '',
      note: task.note || '',
      quadrant: task.quadrant || 'Q2',
      status: task.status || 'todo',
      date: task.date || '',
      time: task.time || '',
      progress: task.progress ?? 0,
      todayTop: !!task.todayTop,
      projectId: task.projectId || '',
      goalId: task.goalId || '',
    })
  }, [task])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'date' && !canBeTodayTop({ date: v }) ? { todayTop: false } : {}) }))
  const future = !canBeTodayTop(form)

  // 今日要事名额：只统计未完成的其它任务，与驾驶舱「今日最重要的 3 件事」口径一致
  const topCount = state.tasks.filter(t => t.todayTop && t.status !== 'done' && t.id !== task.id && canBeTodayTop(t)).length
  const topFull = topCount >= 3

  // 状态与进度联动：完成→100，待开始→0
  const setStatus = (v) => setForm(f => ({
    ...f,
    status: v,
    progress: v === 'done' ? 100 : v === 'todo' ? 0 : f.progress,
  }))

  const save = (e) => {
    e?.preventDefault()
    const title = form.title.trim()
    if (!title) return
    actions.updateTask(task.id, { ...form, title, progress: Number(form.progress) || 0 })
    onClose()
  }

  const remove = () => {
    actions.removeTask(task.id)
    setConfirmOpen(false)
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        as="form"
        onSubmit={save}
        title="编辑任务"
        subtitle="补充备注、调整优先级与进度"
        icon={Flag}
        size="lg"
        dismissible={false}
        footer={
          <>
            <Button variant="ghost" icon={Trash2} className="!text-danger" onClick={() => setConfirmOpen(true)}>删除</Button>
            <div className="grow" />
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button type="submit" icon={Save}>保存</Button>
          </>
        }
      >
        <FormField label="任务标题" required>
          <TextInput autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="要做什么？" />
        </FormField>

        <FormField label={<><AlignLeft size={11} className="mr-1" /> 备注</>}>
          <TextArea
            style={{ minHeight: 68 }}
            value={form.note}
            onChange={e => set('note', e.target.value)}
            placeholder="补充说明、验收标准、相关链接…"
          />
        </FormField>

        <FormGrid>
          <FormField label={<><Flag size={11} className="mr-1" /> 四象限</>}>
            <Select value={form.quadrant} onChange={e => set('quadrant', e.target.value)}>
              {Object.values(QUADRANTS).map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
            </Select>
          </FormField>
          <FormField label="状态">
            <Select value={form.status} onChange={e => setStatus(e.target.value)}>
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </FormField>
          <FormField label="计划日期（可留空）">
            <TextInput type="date" aria-label="计划日期" value={form.date} onChange={e => set('date', e.target.value)} />
          </FormField>
          <FormField label={<><Clock size={11} className="mr-1" /> 计划时间</>}>
            <TextInput type="time" value={form.time} onChange={e => set('time', e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label={`进度：${form.progress}%`} className="!mb-1.5">
          <input
            type="range" min="0" max="100" value={form.progress}
            aria-label="任务进度"
            onChange={e => set('progress', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--indigo)' }}
          />
        </FormField>

        <Checkbox
          label={future ? '未来日期任务不能设为今日要事' : topFull
            ? '今日要事已满 3 条，先取消已有的一个再标记'
            : `标记为「今日最重要的 3 件事」（已选 ${topCount}/3）`}
          icon={Star}
          checked={form.todayTop && !future}
          disabled={future || (topFull && !form.todayTop)}
          className={future || topFull ? 'opacity-60' : undefined}
          onChange={e => set('todayTop', e.target.checked)}
        />

        <FormField label="归属项目（可选）" hint="挂上后可在项目详情里跟进">
          <Select value={form.projectId || ''} onChange={e => set('projectId', e.target.value)}>
            <option value="">不关联</option>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>

        <FormField label="服务于目标（可选）" hint="把任务挂到某个年度/阶段目标上">
          <Select value={form.goalId || ''} onChange={e => set('goalId', e.target.value)}>
            <option value="">不关联</option>
            {(state.goals || []).map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </Select>
        </FormField>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="删除任务"
        message={`确定删除「${task.title}」吗？此操作不可恢复。`}
        confirmText="删除"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
