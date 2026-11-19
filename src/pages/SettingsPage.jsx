import React, { useRef, useState } from 'react'
import { Save, Download, Upload, RotateCcw, User, Target, Timer, Database, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, Card, ConfirmDialog, FormField, SectionHead, TextInput } from '../ui'
import { ThemeGrid } from '../components/ThemePicker'

export default function SettingsPage() {
  const { state, actions } = useStore()
  const [name, setName] = useState(state.profile.name)
  const [goal, setGoal] = useState(state.profile.goal)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  const saveProfile = (e) => {
    e.preventDefault()
    actions.updateProfile({ name: name.trim() || 'K', goal: goal.trim() })
    setSaved(true); setTimeout(() => setSaved(false), 1800)
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dayweave-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('已导出数据备份')
    setTimeout(() => setMsg(''), 2000)
  }

  const importData = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        actions.importData(reader.result)
        setMsg('导入成功，数据已更新')
      } catch {
        setMsg('导入失败：文件格式不正确')
      }
      setTimeout(() => setMsg(''), 2500)
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const reset = () => {
    actions.resetAll()
    setResetOpen(false)
    setMsg('已重置为初始演示数据')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="max-w-[820px]">
      <SectionHead title="个人资料" />
      <Card as="form" onSubmit={saveProfile} className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={<><User size={12} className="mr-1 align-[-2px]" /> 昵称</>} className="!mb-0 grow basis-[220px]">
            <TextInput value={name} onChange={e => setName(e.target.value)} />
          </FormField>
          <Button type="submit" icon={Save} className="mb-0.5">保存</Button>
          {saved && (
            <span className="mb-2 flex items-center gap-1 text-[11px] text-success">
              <CheckCircle2 size={14} /> 已保存
            </span>
          )}
        </div>
        <FormField label={<><Target size={12} className="mr-1 align-[-2px]" /> 个人宣言 / 目标</>} className="mt-4 !mb-0">
          <TextInput value={goal} onChange={e => setGoal(e.target.value)} placeholder="例如：把时间花在真正重要的事情上" />
        </FormField>
      </Card>

      <SectionHead title="外观主题" sub="5 套配色 · 即时生效" />
      <Card className="mb-6">
        <ThemeGrid />
        <div className="ui-help mt-3.5">
          切换后整个应用（包含浮窗卡片）立即生效，可在顶栏调色板按钮快速换色；选择会保存在本机。
        </div>
      </Card>

      <SectionHead title="专注目标" />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Timer size={15} className="text-brand" />
          <span className="ui-help">每日专注目标：</span>
          {[2, 3, 4, 6, 8].map(h => (
            <button
              key={h}
              className={`tab-pill ${state.focus.goalHours === h ? 'active' : ''}`}
              style={{ padding: '5px 12px', background: state.focus.goalHours === h ? 'var(--surface)' : 'var(--bg)' }}
              onClick={() => actions.setFocusGoal(h)}
            >
              {h} 小时
            </button>
          ))}
        </div>
      </Card>

      <SectionHead title="数据管理" />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button icon={Download} onClick={exportData}>导出数据备份</Button>
          <Button variant="ghost" icon={Upload} onClick={() => fileRef.current?.click()}>导入数据</Button>
          <Button variant="ghost" icon={RotateCcw} onClick={() => setResetOpen(true)} className="!text-danger">重置全部数据</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importData} />
        </div>
        {msg && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-brand-600">
            <CheckCircle2 size={14} /> {msg}
          </div>
        )}
        <div className="ui-help mt-3.5">
          所有数据仅保存在本机浏览器存储（localStorage），不上传云端。换机或清理数据前请先导出备份。
        </div>
      </Card>

      <SectionHead title="关于" />
      <Card>
        <div className="flex items-center gap-3">
          <span className="stat-ico bg-brand-100 text-brand-600"><Database size={19} /></span>
          <div>
            <div className="text-[13px] font-700">织日 · DayWeave</div>
            <div className="ui-help mt-0.5">版本 1.3.8 · Tauri 2 + React + UnoCSS · 5 套配色方案 · 本地离线运行</div>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        title="重置全部数据"
        message="确定要清空当前数据并恢复为初始演示数据吗？此操作不可恢复，建议先导出备份。"
        confirmText="重置"
        danger
        onConfirm={reset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  )
}
