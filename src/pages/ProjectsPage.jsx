import React, { useState } from 'react'
import { Plus, Trash2, FolderKanban, Calendar, CheckCircle2, PauseCircle, Check } from 'lucide-react'
import { useStore } from '../store'
import {
  Button, Card, EmptyState, FormField, FormGrid, IconButton, Modal, PageToolbar,
  Stat, StatGrid, TextInput,
} from '../ui'

const COLORS = ['#7170FF', '#E8A13A', '#3FB37F', '#E8607A', '#4F8EF7', '#9B7BE8']

function AddProject({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', desc: '', deadline: '', color: COLORS[0] })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const close = () => {
    setOpen(false)
    setForm({ name: '', desc: '', deadline: '', color: COLORS[0] })
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
          <FormField label="截止日期">
            <TextInput type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </FormField>
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
        </FormGrid>
      </Modal>
    </>
  )
}

export default function ProjectsPage() {
  const { state, actions } = useStore()
  const total = state.projects.length
  const avg = total ? Math.round(state.projects.reduce((a, p) => a + p.progress, 0) / total) : 0
  const doneCount = state.projects.filter(p => p.progress >= 100).length

  return (
    <div>
      <StatGrid className="mb-6">
        <Stat icon={FolderKanban} value={total} label="项目总数" tone="brand" />
        <Stat icon={CheckCircle2} value={doneCount} label="已完成" tone="success" />
        <Stat icon={PauseCircle} value={total - doneCount} label="进行中" tone="warning" />
        <Stat icon={FolderKanban} value={`${avg}%`} label="平均进度" tone="violet" />
      </StatGrid>

      <PageToolbar title="项目列表" sub="拖动进度条更新" actions={<AddProject onAdd={actions.addProject} />} />

      {state.projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="还没有项目" hint="点击右上角新建，把长期目标拆成可推进的单元" />
      ) : (
        <div className="grid-2">
          {state.projects.map(p => (
            <Card key={p.id} style={{ borderTop: `3px solid ${p.color}` }} className="flex flex-col">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="text-[14px] font-700 leading-snug">{p.name}</div>
                <IconButton icon={Trash2} label="删除项目" tone="danger" size={13} onClick={() => actions.removeProject(p.id)} />
              </div>
              {p.desc && <div className="ui-help mb-2.5">{p.desc}</div>}
              {p.deadline && (
                <div className="ui-help mb-2.5 flex items-center gap-1.5">
                  <Calendar size={12} /> 截止 {p.deadline}
                </div>
              )}
              <div className="grow" />
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-ink-mute">进度</span>
                <span className="font-700" style={{ color: p.color }}>{p.progress}%</span>
              </div>
              <div className="bar-track"><i style={{ width: p.progress + '%', background: p.color }} /></div>
              <input
                type="range" min="0" max="100" value={p.progress}
                aria-label={`${p.name} 进度`}
                onChange={e => actions.updateProject(p.id, { progress: +e.target.value })}
                className="mt-2.5 w-full"
                style={{ accentColor: p.color }}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
