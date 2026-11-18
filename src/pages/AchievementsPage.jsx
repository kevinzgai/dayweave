import React, { useState } from 'react'
import { Plus, Trash2, Award, CheckCircle2, Timer, Target, TrendingUp, Check } from 'lucide-react'
import { useStore } from '../store'
import {
  Button, Card, EmptyState, FormField, IconButton, Modal, Pill,
  Stat, StatGrid, TextInput, Select, PageToolbar,
} from '../ui'

function AddResult({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', desc: '', type: '任务' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const close = () => {
    setOpen(false)
    setForm({ title: '', desc: '', type: '任务' })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({ title: form.title.trim(), desc: form.desc.trim(), type: form.type })
    close()
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>添加成果</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="添加工作成果"
        subtitle="记录一件值得被看见的事"
        icon={Award}
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="成果标题" required>
          <TextInput autoFocus placeholder="例如：完成首页改版并上线" value={form.title} onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormField label="说明" hint="可选，补充数据、影响范围或协作方">
          <TextInput placeholder="一句话说明这件事的价值" value={form.desc} onChange={e => set('desc', e.target.value)} />
        </FormField>
        <FormField label="类型">
          <Select value={form.type} onChange={e => set('type', e.target.value)}>
            <option>任务</option><option>项目</option><option>里程碑</option><option>其他</option>
          </Select>
        </FormField>
      </Modal>
    </>
  )
}

export default function AchievementsPage() {
  const { state, actions, derived } = useStore()
  const results = state.workResults || []

  return (
    <div>
      <StatGrid className="mb-6">
        <Stat icon={CheckCircle2} value={derived.done} label="今日完成任务" tone="success" />
        <Stat icon={Timer} value={`${derived.focusHours}h`} label="今日专注时长" tone="warning" />
        <Stat icon={Target} value={results.length} label="成果记录" tone="brand" />
        <Stat icon={TrendingUp} value={`${derived.completion}%`} label="任务完成率" tone="danger" />
      </StatGrid>

      <PageToolbar title="工作成果" sub="看得见的积累" actions={<AddResult onAdd={actions.addWorkResult} />} />

      {results.length === 0 ? (
        <EmptyState icon={Award} title="还没有成果记录" hint="完成一件事就来记一笔，月底回看会很有成就感" />
      ) : (
        <Card>
          {results.map((r, i) => (
            <div
              className="flex items-center gap-3 py-3"
              key={r.id}
              style={{ borderBottom: i === results.length - 1 ? 'none' : '1px solid var(--line)' }}
            >
              <span className="stat-ico h-9 w-9 rounded-lg bg-success-soft text-success">
                <Award size={16} />
              </span>
              <div className="min-w-0 grow">
                <div className="truncate text-[13px] font-600">{r.title}</div>
                {r.desc && <div className="ui-help mt-0.5">{r.desc}</div>}
              </div>
              <Pill tone="brand">{r.type}</Pill>
              <span className="ui-help hidden whitespace-nowrap sm:inline">{r.date}</span>
              <IconButton icon={Trash2} label="删除成果" tone="danger" size={13} onClick={() => actions.removeWorkResult(r.id)} />
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
