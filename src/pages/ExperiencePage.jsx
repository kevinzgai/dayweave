import React, { useState } from 'react'
import { Plus, Trash2, Lightbulb, Tag, Check } from 'lucide-react'
import { useStore } from '../store'
import {
  Button, Card, EmptyState, FormField, IconButton, Modal, PageHero, Pill,
  TextArea, TextInput,
} from '../ui'

function AddExperience({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', tags: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const close = () => {
    setOpen(false)
    setForm({ title: '', content: '', tags: '' })
  }
  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({
      title: form.title.trim(),
      content: form.content.trim(),
      tags: form.tags.split(/[,，\s]+/).filter(Boolean),
    })
    close()
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>记录经验</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="记录一条经验"
        subtitle="把踩过的坑变成可复用的方法"
        icon={Lightbulb}
        size="lg"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="经验标题" required>
          <TextInput autoFocus placeholder="例如：需求不清晰时先做原型" value={form.title} onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormField label="具体经验 / 教训" hint="写清楚背景、做法和结果，下次才用得上">
          <TextArea placeholder="当时的情况是什么，后来怎么解决的…" value={form.content} onChange={e => set('content', e.target.value)} />
        </FormField>
        <FormField label="标签" hint="用逗号或空格分隔">
          <TextInput placeholder="例如：复盘, 协作, 沟通" value={form.tags} onChange={e => set('tags', e.target.value)} />
        </FormField>
      </Modal>
    </>
  )
}

export default function ExperiencePage() {
  const { state, actions } = useStore()
  const list = state.experience || []

  return (
    <div>
      <PageHero
        eyebrow="EXPERIENCE · 经验素材库"
        title="踩过的坑，"
        highlight="都变成护城河。"
        desc="把每次复盘提炼成可复用的经验，下次直接调用，不重复交学费。"
        metric={list.length}
        metricLabel="条经验"
        metricWidth={120}
      />

      <div className="ui-toolbar">
        <div>
          <div className="section-head flush">
            <span className="bar" />
            <h2>经验清单</h2>
            <span className="sub">持续累积</span>
          </div>
        </div>
        <div className="toolbar-actions flex items-center gap-2">
          <AddExperience onAdd={actions.addExperience} />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Lightbulb} title="还没有经验记录" hint="从今天的一次复盘中提炼一条吧" />
      ) : (
        <div className="grid-2">
          {list.map(e => (
            <Card key={e.id} className="!border-l-[3px] !border-l-warning">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[13px] font-700">
                  <Lightbulb size={15} className="shrink-0 text-warning" /> {e.title}
                </div>
                <IconButton icon={Trash2} label="删除经验" tone="danger" size={12} onClick={() => actions.removeExperience(e.id)} />
              </div>
              {e.content && <div className="ui-help whitespace-pre-wrap !text-[11.5px] !leading-[1.7]">{e.content}</div>}
              {e.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.tags.map(t => (
                    <Pill key={t} tone="warning"><Tag size={9} /> {t}</Pill>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
