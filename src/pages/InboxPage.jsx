import React, { useState } from 'react'
import { Inbox, Plus, Trash2, ArrowRight, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { Button, Card, EmptyState, IconButton, PageHero } from '../ui'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return `${Math.floor(s / 86400)} 天前`
}

export default function InboxPage() {
  const { state, actions } = useStore()
  const [text, setText] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    actions.addInbox(v)
    setText('')
  }

  return (
    <div>
      <PageHero
        eyebrow="INBOX · 零压力捕捉"
        title="脑子里蹦出来的，"
        highlight="先扔进来。"
        desc="不用分类、不用想优先级。捕捉之后，再决定它该去哪。"
        metric={state.inbox.length}
        metricLabel="待处理条目"
        metricWidth={130}
      />

      <Card className="max-w-[860px]">
        <form onSubmit={submit} className="mb-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex grow items-center gap-2 rounded-field border border-line bg-canvas px-3 transition-colors focus-within:border-brand focus-within:bg-surface focus-within:ring-3 focus-within:ring-brand-100">
            <Plus size={15} className="shrink-0 text-ink-mute" />
            <input
              className="input grow !border-none !bg-transparent !px-0 !shadow-none"
              placeholder="例如：下周要跟设计确认首页方案…  按回车捕捉"
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" icon={Plus} className="shrink-0">捕捉</Button>
        </form>

        {state.inbox.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="收件箱空了，说明你处理得很干净 ✦"
            hint="有想法随时回来记一笔"
            className="!shadow-none !p-8"
          />
        ) : (
          <div>
            <div className="section-head">
              <span className="bar" />
              <h2>待处理</h2>
              <span className="sub">逐条清空</span>
            </div>
            {state.inbox.map((item, idx) => (
              <div
                className="top3-item"
                key={item.id}
                style={{ borderBottom: idx === state.inbox.length - 1 ? 'none' : '1px solid var(--line)' }}
              >
                <span className="top3-check shrink-0" style={{ borderColor: 'var(--line-strong)' }} />
                <div className="top3-body">
                  <div className="top3-title">{item.title}</div>
                  <div className="ui-help mt-1">{timeAgo(item.createdAt)}</div>
                </div>
                <Button variant="ghost" size="sm" icon={ArrowRight} title="转为任务" onClick={() => actions.inboxToTask(item.id)}>转任务</Button>
                <IconButton icon={Trash2} label="删除条目" tone="danger" size={13} onClick={() => actions.removeInbox(item.id)} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-mute">
          <Sparkles size={13} /> 提示：转成任务后可设置四象限与时间，驾驶舱会自动同步。
        </div>
      </Card>
    </div>
  )
}
