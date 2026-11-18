import React, { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Flame, CalendarDays, Check } from 'lucide-react'
import { useStore } from '../store'
import {
  Button, Card, FormField, IconButton, Modal, PageToolbar,
  Select, Stat, StatGrid, TextInput,
} from '../ui'

function AddHabit({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', freq: '每日' })
  const close = () => {
    setOpen(false)
    setForm({ name: '', freq: '每日' })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onAdd({ name: form.name.trim(), freq: form.freq })
    close()
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>新增习惯</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="新增习惯"
        subtitle="从小到不可能失败的动作开始"
        icon={CalendarDays}
        size="sm"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="习惯名称" required>
          <TextInput autoFocus placeholder="例如：阅读 30 分钟" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="频率">
          <Select value={form.freq} onChange={e => setForm(f => ({ ...f, freq: e.target.value }))}>
            <option>每日</option><option>每周</option>
          </Select>
        </FormField>
      </Modal>
    </>
  )
}

function HistoryDots({ history }) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ key, hit: (history || []).includes(key), label: `${d.getMonth() + 1}/${d.getDate()}` })
  }
  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      {days.map(d => (
        <div
          key={d.key}
          title={d.label}
          className="h-4 w-4 rounded-[5px]"
          style={{ background: d.hit ? 'var(--green)' : 'var(--line)' }}
        />
      ))}
    </div>
  )
}

export default function HabitsPage() {
  const { actions, derived } = useStore()
  const habits = derived.habits || []

  return (
    <div>
      <StatGrid className="mb-6">
        <Stat icon={CalendarDays} value={habits.length} label="习惯总数" tone="brand" />
        <Stat icon={CheckCircle2} value={derived.habitsDone} label="今日已打卡" tone="success" />
        <Stat icon={Flame} value={Math.max(0, ...habits.map(h => h.streak))} label="最长连续天数" tone="warning" />
        <Stat icon={CalendarDays} value={`${habits.length ? Math.round((derived.habitsDone / habits.length) * 100) : 0}%`} label="今日完成率" tone="violet" />
      </StatGrid>

      <PageToolbar title="习惯打卡" sub="坚持就是复利" actions={<AddHabit onAdd={actions.addHabit} />} />

      <Card>
        {habits.length === 0 ? (
          <div className="empty">还没有习惯，添加一个开始打卡</div>
        ) : habits.map((h, idx) => (
          <div
            key={h.id}
            className="flex items-center gap-3 py-3.5"
            style={{ borderBottom: idx === habits.length - 1 ? 'none' : '1px solid var(--line)' }}
          >
            <span
              className={`habit-check ${h.done ? 'done' : ''}`}
              style={{ width: 20, height: 20 }}
              role="checkbox"
              aria-checked={h.done}
              aria-label={`打卡 ${h.name}`}
              onClick={() => actions.toggleHabit(h.id)}
            >
              {h.done && <CheckCircle2 size={14} />}
            </span>
            <div className="min-w-0 grow">
              <div
                className="truncate text-[13px] font-600"
                style={{ color: h.done ? 'var(--ink-3)' : 'var(--ink)', textDecoration: h.done ? 'line-through' : 'none' }}
              >
                {h.name}
              </div>
              <div className="ui-help mt-0.5">{h.freq}</div>
            </div>
            <HistoryDots history={h.history} />
            <div className="flex min-w-[66px] items-center justify-end gap-1">
              <Flame size={14} color={h.streak > 0 ? 'var(--warning)' : 'var(--line-strong)'} />
              <span className="text-[11px] font-700" style={{ color: h.streak > 0 ? 'var(--warning)' : 'var(--ink-3)' }}>{h.streak} 天</span>
            </div>
            <IconButton icon={Trash2} label="删除习惯" tone="danger" size={13} onClick={() => actions.removeHabit(h.id)} />
          </div>
        ))}
      </Card>
      <div className="ui-help mt-3">虚线框内的小方块代表最近 7 天打卡情况，绿色为已打卡。</div>
    </div>
  )
}
