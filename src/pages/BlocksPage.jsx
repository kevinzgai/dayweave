import React, { useState } from 'react'
import { Plus, Trash2, Sun, Coffee, Users, Send, Target, Brain, RefreshCw, Clock, Check } from 'lucide-react'
import { useStore } from '../store'
import {
  Button, Card, EmptyState, FormField, FormGrid, IconButton, Modal, PageToolbar,
  Select, Stat, StatGrid, TextInput,
} from '../ui'

const icons = { sun: Sun, brain: Brain, target: Target, coffee: Coffee, users: Users, send: Send, reflect: RefreshCw }
const iconKeys = Object.keys(icons)
const ICON_LABEL = { sun: '上午 · 轻任务', brain: '深度思考', target: '核心目标', coffee: '休息', users: '沟通协作', send: '输出交付', reflect: '复盘' }
const STATUS = {
  done: { label: '已完成', cls: 'bg-success-soft text-success' },
  doing: { label: '进行中', cls: 'bg-brand-100 text-brand-600' },
  todo: { label: '待开始', cls: 'bg-surface-sunk text-ink-mute' },
}

function AddBlock({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', start: '09:00', end: '10:00', icon: 'target' })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const close = () => {
    setOpen(false)
    setError('')
    setForm({ title: '', start: '09:00', end: '10:00', icon: 'target' })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('请填写这段时间要做什么')
    if (form.end <= form.start) return setError('结束时间需要晚于开始时间')
    onAdd({ title: form.title.trim(), start: form.start, end: form.end, icon: form.icon })
    close()
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>新增时间块</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="新增时间块"
        subtitle="为重要的事预留一段不被打扰的时间"
        icon={Clock}
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="安排内容" required error={error}>
          <TextInput autoFocus placeholder="这段时间做什么？" value={form.title} onChange={e => { set('title', e.target.value); setError('') }} />
        </FormField>
        <FormGrid>
          <FormField label="开始时间">
            <TextInput type="time" value={form.start} onChange={e => set('start', e.target.value)} />
          </FormField>
          <FormField label="结束时间">
            <TextInput type="time" value={form.end} onChange={e => set('end', e.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="类型图标">
          <Select value={form.icon} onChange={e => set('icon', e.target.value)}>
            {iconKeys.map(k => <option key={k} value={k}>{ICON_LABEL[k]}</option>)}
          </Select>
        </FormField>
      </Modal>
    </>
  )
}

export default function BlocksPage() {
  const { state, actions, derived } = useStore()
  const blocks = state.blocks
  const totalMin = blocks.reduce((a, b) => {
    const [h1, m1] = b.start.split(':').map(Number), [h2, m2] = b.end.split(':').map(Number)
    return a + Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1))
  }, 0)

  return (
    <div>
      <StatGrid className="mb-6">
        <Stat icon={Clock} value={blocks.length} label="时间块总数" tone="brand" />
        <Stat icon={Target} value={`${(totalMin / 60).toFixed(1)}h`} label="规划时长" tone="success" />
        <Stat icon={RefreshCw} value={blocks.filter(b => b.status === 'done').length} label="已完成" tone="warning" />
        <Stat icon={Brain} value={`${derived.focusHours}h`} label="实际专注" tone="danger" />
      </StatGrid>

      <PageToolbar title="今日时间块安排" sub="点击状态标签切换进度" actions={<AddBlock onAdd={actions.addBlock} />} />

      <Card>
        {blocks.length === 0 ? (
          <div className="empty">还没有安排时间块，先加一个吧</div>
        ) : blocks.map((b, idx) => {
          const Icon = icons[b.icon] || Target
          const st = STATUS[b.status]
          return (
            <div
              className="top3-item"
              key={b.id}
              style={{ borderBottom: idx === blocks.length - 1 ? 'none' : '1px solid var(--line)' }}
            >
              <div className="tl-time w-[92px] shrink-0">{b.start}–{b.end}</div>
              <span className="stat-ico !h-8 !w-8 !rounded-[10px] bg-canvas text-ink-soft"><Icon size={16} /></span>
              <div className="top3-body"><div className="top3-title">{b.title}</div></div>
              <button className={`pill shrink-0 ${st.cls}`} onClick={() => actions.cycleBlockStatus(b.id)}>{st.label}</button>
              <IconButton icon={Trash2} label="删除时间块" tone="danger" size={13} onClick={() => actions.removeBlock(b.id)} />
            </div>
          )
        })}
      </Card>
    </div>
  )
}
