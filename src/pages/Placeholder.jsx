import React from 'react'
import { Construction, ArrowLeft } from 'lucide-react'

export default function Placeholder({ title, label }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div className="stat-ico" style={{ width: 64, height: 64, margin: '0 auto 20px', background: 'var(--brand-100)', color: 'var(--brand-500)' }}>
        <Construction size={30} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{label || title}</h2>
      <p className="muted" style={{ maxWidth: 420, margin: '0 auto', fontSize: 13, lineHeight: 1.7 }}>
        这个模块规划中。当前版本聚焦核心闭环：收件箱 → 任务管理 → 时间块 → 专注计时 → 时间复盘。<br/>
        完成这些后，会逐个补齐剩余模块。
      </p>
    </div>
  )
}
