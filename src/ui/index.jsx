import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// 弹窗栈：Esc 只关闭最上层，避免「二次确认」把编辑器一起关掉
const modalStack = []
let modalSeq = 0

/**
 * 轻量 UI 组件库
 * - 统一取自 uno.config.js 的设计令牌（配色 / 圆角 / 阴影 / 字号 / 间距）
 * - 保留 btn / panel / input 等语义类，便于渐进替换与自动化测试定位
 */

export const cx = (...parts) => parts.filter(Boolean).join(' ')

/* ------------------------------- 按钮 ------------------------------- */

const VARIANTS = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  soft: 'btn-soft',
  danger: 'btn-danger',
  plain: 'btn-plain',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  block = false,
  className,
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx('btn', VARIANTS[variant] || VARIANTS.primary, size === 'sm' && 'btn-sm', 'ui-btn', block && 'w-full', className)}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.1} />}
      {children != null && children !== '' && <span className="truncate">{children}</span>}
    </button>
  )
}

export function IconButton({ icon: Icon, label, tone = 'default', size = 15, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('ui-icon-btn', tone === 'danger' && 'hover:bg-danger-soft hover:text-danger', className)}
      {...rest}
    >
      <Icon size={size} strokeWidth={2} />
    </button>
  )
}

/* ------------------------------- 容器 ------------------------------- */

export function Card({ as: Tag = 'div', className, children, interactive = false, ...rest }) {
  return (
    <Tag
      className={cx('panel', interactive && 'transition-shadow duration-200 hover:shadow-lift', className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function SectionHead({ title, sub, icon: Icon, right, className, flush = false }) {
  return (
    <div className={cx('section-head', flush && 'flush', className)}>
      <span className="bar" />
      {Icon && <Icon size={15} className="text-brand-600" strokeWidth={2.2} />}
      <h2>{title}</h2>
      {sub && <span className="sub">{sub}</span>}
      {right && <div className="right flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function PageToolbar({ title, sub, actions, className }) {
  return (
    <div className={cx('ui-toolbar', className)}>
      <SectionHead title={title} sub={sub} flush />
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, action, className }) {
  return (
    <div className={cx('panel empty', className)}>
      {Icon && (
        <div className="big flex justify-center">
          <Icon size={40} strokeWidth={1.6} />
        </div>
      )}
      <div>{title}</div>
      {hint && <div className="ui-help mt-1.5">{hint}</div>}
      {action && <div className="mt-3.5 flex justify-center">{action}</div>}
    </div>
  )
}

/* ------------------------------- 弹窗 ------------------------------- */

const SIZES = { sm: 'modal-sm', md: 'modal-md', lg: 'modal-lg', xl: 'modal-xl' }

export function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = 'md',
  as: Tag = 'div',
  onSubmit,
  children,
  footer,
  className,
  bodyClassName,
  // 默认不允许 Esc / 点遮罩关闭：所有弹窗统一走自定义「取消 / 保存」按钮，
  // 避免误触丢数据。个别需要快速关闭的面板可显式传 dismissible。
  dismissible = false,
}) {
  const idRef = useRef(null)
  if (idRef.current == null) idRef.current = ++modalSeq

  useEffect(() => {
    if (!open) return undefined
    const id = idRef.current
    modalStack.push(id)
    const onKey = (e) => {
      if (e.key !== 'Escape' || !dismissible) return
      if (modalStack[modalStack.length - 1] !== id) return
      e.stopPropagation()
      onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      const idx = modalStack.lastIndexOf(id)
      if (idx >= 0) modalStack.splice(idx, 1)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, dismissible])

  if (!open) return null

  return createPortal(
    <div
      className="modal-mask"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.()
      }}
    >
      <Tag
        className={cx('modal', SIZES[size] || SIZES.md, className)}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={title || '对话框'}
      >
        {(title || onClose) && (
          <div className="modal-head">
            <div className="flex min-w-0 items-center gap-2.5">
              {Icon && (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-brand-100 text-brand-600">
                  <Icon size={15} strokeWidth={2.2} />
                </span>
              )}
              <div className="min-w-0">
                <h3 className="truncate">{title}</h3>
                {subtitle && <div className="ui-help mt-0.5 truncate">{subtitle}</div>}
              </div>
            </div>
            {dismissible && <IconButton icon={X} label="关闭" onClick={onClose} />}
          </div>
        )}
        <div className={cx('modal-body', bodyClassName)}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </Tag>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title = '请确认',
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={false}
      footer={
        <>
          <div className="grow" />
          <Button variant="ghost" onClick={onCancel}>{cancelText}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      <div className="text-[13px] leading-relaxed text-ink-soft">{message}</div>
    </Modal>
  )
}

/* ------------------------------- 表单 ------------------------------- */

export function FormField({ label, hint, error, required, className, children }) {
  return (
    <div className={cx('field', className)}>
      {label && (
        <label>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? <div className="ui-help text-danger">{error}</div> : hint ? <div className="ui-help">{hint}</div> : null}
    </div>
  )
}

export function FormGrid({ cols = 2, className, children }) {
  const base = cols === 3 ? 'ui-field-row-3' : cols === 1 ? 'grid grid-cols-1' : 'ui-field-row'
  return <div className={cx(base, className)}>{children}</div>
}

export const TextInput = ({ className, ...rest }) => <input className={cx('input', className)} {...rest} />
export const TextArea = ({ className, ...rest }) => <textarea className={cx('textarea', className)} {...rest} />
export const Select = ({ className, children, ...rest }) => (
  <select className={cx('select', className)} {...rest}>{children}</select>
)

export function Checkbox({ label, icon: Icon, className, ...rest }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft', className)}>
      <input type="checkbox" className="ui-checkbox" {...rest} />
      {Icon && <Icon size={12} className="text-warning" />}
      {label}
    </label>
  )
}

export function ModalActions({ children, className }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div className="grow" />
      {children}
    </div>
  )
}

/* ------------------------------- 数据展示 ------------------------------- */

export const TONES = {
  brand: 'bg-brand-100 text-brand-600',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  violet: 'bg-violet-soft text-violet',
  neutral: 'bg-surface-sunk text-ink-mute',
}

export function Stat({ icon: Icon, value, label, tone = 'brand' }) {
  return (
    <div className="stat">
      <div className={cx('stat-ico', TONES[tone])}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="stat-num truncate">{value}</div>
        <div className="stat-label truncate">{label}</div>
      </div>
    </div>
  )
}

export function StatGrid({ children, className }) {
  return <section className={cx('stat-strip', className)}>{children}</section>
}

export function Pill({ tone = 'brand', className, children, ...rest }) {
  return <span className={cx('pill', TONES[tone], className)} {...rest}>{children}</span>
}

export function Segmented({ value, onChange, items, className }) {
  return (
    <div className={cx('tab-pills', className)} role="tablist">
      {items.map((it) => {
        const Icon = it.icon
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={value === it.value}
            className={cx('tab-pill', value === it.value && 'active')}
            onClick={() => onChange(it.value)}
          >
            {Icon && <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

export function PageHero({ eyebrow, title, highlight, desc, metric, metricLabel, metricWidth = 122 }) {
  return (
    <section className="hero">
      <div className="hero-main">
        {eyebrow && <div className="hero-eyebrow">{eyebrow}</div>}
        <div className="hero-title">
          {title}
          {highlight && <> <em>{highlight}</em></>}
        </div>
        {desc && <div className="hero-desc">{desc}</div>}
      </div>
      {metric != null && (
        <div className="focus-stat hero-metric" style={{ width: metricWidth }}>
          <div className="n">{metric}</div>
          <div className="l">{metricLabel}</div>
        </div>
      )}
    </section>
  )
}
