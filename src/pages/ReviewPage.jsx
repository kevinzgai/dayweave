import React, { useState, useEffect } from 'react'
import { Save, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { useStore, todayStr } from '../store'
import { Button, Card, FormField, PageHero, SectionHead, TextArea } from '../ui'

const QUESTIONS = [
  { key: 'done', label: '今天完成了什么？', placeholder: '列出今天完成的关键事项…' },
  { key: 'biggest', label: '最大的成果 / 收获是什么？', placeholder: '哪怕很小，也值得记下来…' },
  { key: 'timeWhere', label: '时间主要花在哪了？有什么可以优化？', placeholder: '回顾时间块，哪里投入值得，哪里被消耗…' },
  { key: 'tomorrow', label: '明天最重要的 3 件事？', placeholder: '1. …\n2. …\n3. …' },
]

export default function ReviewPage() {
  const { state, actions } = useStore()
  const saved = state.reviews[todayStr()]
  const [form, setForm] = useState({ done: '', biggest: '', timeWhere: '', tomorrow: '' })
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (saved) setForm({ done: saved.done || '', biggest: saved.biggest || '', timeWhere: saved.timeWhere || '', tomorrow: saved.tomorrow || '' })
  }, [saved])

  const submit = (e) => {
    e.preventDefault()
    actions.saveReview(form)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2200)
  }

  const past = Object.values(state.reviews).filter(r => r.date !== todayStr()).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <PageHero
        eyebrow="DAILY REVIEW · 复盘沉淀"
        title="每天几分钟，"
        highlight="把经验留下来。"
        desc="复盘不是总结过去，而是让明天更高效。今天这份，趁记忆还热乎。"
        metric={saved ? '已填写' : '待填写'}
        metricLabel="今日状态"
        metricWidth={120}
      />

      <div className="grid-2 review-layout">
        <Card as="form" onSubmit={submit}>
          <SectionHead title={`今日复盘 · ${todayStr()}`} flush />
          <div className="mt-3">
            {QUESTIONS.map((q, i) => (
              <FormField key={q.key} label={<><span className="mr-1.5 text-brand-600">0{i + 1}</span>{q.label}</>}>
                <TextArea
                  placeholder={q.placeholder}
                  value={form[q.key]}
                  onChange={e => setForm({ ...form, [q.key]: e.target.value })}
                />
              </FormField>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <Button type="submit" icon={Save}>{saved ? '更新复盘' : '保存复盘'}</Button>
            {justSaved && (
              <span className="flex items-center gap-1 text-[11px] text-success">
                <CheckCircle2 size={14} /> 已保存到本地
              </span>
            )}
          </div>
        </Card>

        <div>
          <Card className="mb-5">
            <SectionHead title="复盘提示" />
            <div className="review-q !text-[12.5px]">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <span>写「完成了什么」时，对照今早定的 3 件要事，看看命中率。</span>
            </div>
            <div className="review-q !text-[12.5px]">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <span>「时间花在哪」最好结合专注记录，诚实面对分心。</span>
            </div>
            <div className="review-q !text-[12.5px]">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <span>明天的 3 件事，现在就定，早上直接开干。</span>
            </div>
          </Card>

          <Card>
            <SectionHead title="历史复盘" sub={`${past.length} 篇`} />
            {past.length === 0 ? <div className="empty mini">还没有历史复盘记录</div> : past.map((r, idx) => (
              <div key={r.date} style={{ padding: '10px 0', borderBottom: idx === past.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div className="mb-1 flex items-center gap-1 text-[11px] font-700">
                  <RefreshCw size={12} className="text-brand-600" /> {r.date}
                </div>
                <div className="ui-help truncate">{r.biggest || r.done || '（无摘要）'}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
