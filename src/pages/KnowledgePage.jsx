import React, { useState } from 'react'
import { Plus, Trash2, Search, Tag, BookOpen, Check } from 'lucide-react'
import { useStore } from '../store'
import {
  Button, Card, EmptyState, FormField, IconButton, Modal, PageHero, Pill,
  TextInput, TextArea,
} from '../ui'

function AddKnowledge({ onAdd }) {
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
      <Button icon={Plus} onClick={() => setOpen(true)}>收录素材</Button>
      <Modal
        open={open}
        onClose={close}
        as="form"
        onSubmit={submit}
        title="收录一条素材"
        subtitle="先存下来，需要时再用"
        icon={BookOpen}
        size="lg"
        footer={
          <>
            <div className="grow" />
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button type="submit" icon={Check}>保存</Button>
          </>
        }
      >
        <FormField label="标题" required>
          <TextInput autoFocus placeholder="这条素材讲什么？" value={form.title} onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormField label="内容" hint="可以直接粘贴原文、链接或自己的理解">
          <TextArea placeholder="把关键信息记下来…" value={form.content} onChange={e => set('content', e.target.value)} />
        </FormField>
        <FormField label="标签" hint="用逗号或空格分隔，便于之后筛选">
          <TextInput placeholder="例如：前端, React, 性能" value={form.tags} onChange={e => set('tags', e.target.value)} />
        </FormField>
      </Modal>
    </>
  )
}

export default function KnowledgePage() {
  const { state, actions } = useStore()
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState(null)
  const all = state.knowledge || []
  const allTags = [...new Set(all.flatMap(k => k.tags || []))]
  const list = all.filter(k =>
    (!tagFilter || (k.tags || []).includes(tagFilter)) &&
    (!q || k.title.includes(q) || (k.content || '').includes(q) || (k.tags || []).some(t => t.includes(q)))
  )

  return (
    <div>
      <PageHero
        eyebrow="KNOWLEDGE · 知识素材库"
        title="把碎片"
        highlight="沉淀成资产。"
        desc="看到的好内容、灵光一闪，先存进来，需要时不再从零开始。"
        metric={all.length}
        metricLabel="条素材"
        metricWidth={120}
      />

      <div className="ui-toolbar">
        <div className="flex min-w-0 grow items-center gap-2.5 rounded-field bg-surface px-3 shadow-card sm:max-w-[420px]">
          <Search size={15} className="shrink-0 text-ink-mute" />
          <input
            className="input grow !border-none !bg-transparent !px-0 !shadow-none"
            placeholder="搜索标题 / 内容 / 标签"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="toolbar-actions flex items-center gap-2">
          <AddKnowledge onAdd={actions.addKnowledge} />
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-4.5 flex flex-wrap items-center gap-2">
          <button
            className={`tab-pill ${!tagFilter ? 'active' : ''}`}
            style={{ background: !tagFilter ? 'var(--surface)' : 'var(--bg)' }}
            onClick={() => setTagFilter(null)}
          >
            全部
          </button>
          {allTags.map(t => (
            <button
              key={t}
              className={`tab-pill ${tagFilter === t ? 'active' : ''}`}
              style={{ background: tagFilter === t ? 'var(--surface)' : 'var(--bg)' }}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={all.length === 0 ? '还没有素材' : '没有匹配的结果'}
          hint={all.length === 0 ? '看到值得留存的内容，就收录第一条' : '换个关键词或清除标签筛选试试'}
        />
      ) : (
        <div className="grid-3">
          {list.map(k => (
            <Card key={k.id} className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-[13px] font-700 leading-snug">{k.title}</div>
                <IconButton icon={Trash2} label="删除素材" tone="danger" size={12} onClick={() => actions.removeKnowledge(k.id)} />
              </div>
              {k.content && (
                <div className="ui-help grow whitespace-pre-wrap !text-[11.5px] !leading-[1.7]">{k.content}</div>
              )}
              {k.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {k.tags.map(t => (
                    <Pill key={t} tone="brand"><Tag size={9} /> {t}</Pill>
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
