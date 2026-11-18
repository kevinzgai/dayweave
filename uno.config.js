import { defineConfig, presetWind3, transformerVariantGroup } from 'unocss'

/**
 * UnoCSS 设计令牌
 * ---------------------------------------------------------------------------
 * 所有颜色都指向 CSS 变量（由 src/theme.js 在 <html> 上注入），
 * 于是「换主题」只是换一组变量，组件与类名完全不用改。
 * 变量清单见 styles.css 的 :root —— 两处保持同步。
 */
export default defineConfig({
  presets: [
    presetWind3({
      // 保留项目自己的 reset（styles.css），避免 Uno 的 preflight 覆盖既有排版
      preflight: false,
    }),
  ],
  transformers: [transformerVariantGroup()],
  theme: {
    colors: {
      brand: {
        DEFAULT: 'var(--brand-500)',
        50: 'var(--brand-50)',
        100: 'var(--brand-100)',
        200: 'var(--brand-200)',
        300: 'var(--brand-300)',
        400: 'var(--brand-400)',
        500: 'var(--brand-500)',
        600: 'var(--brand-600)',
        700: 'var(--brand-700)',
      },
      ink: {
        DEFAULT: 'var(--ink)',
        soft: 'var(--ink-2)',
        mute: 'var(--ink-3)',
        faint: 'var(--ink-4)',
      },
      line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
      canvas: 'var(--bg)',
      surface: { DEFAULT: 'var(--surface)', sunk: 'var(--surface-sunk)' },
      nav: {
        DEFAULT: 'var(--nav)',
        active: 'var(--nav-active)',
        ink: 'var(--nav-active-ink)',
        text: 'var(--nav-text)',
      },
      accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)', ink: 'var(--accent-ink)' },
      success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
      warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
      danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
      violet: { DEFAULT: 'var(--violet)', soft: 'var(--violet-soft)' },
    },
    borderRadius: {
      xs: '6px',
      sm: '8px',
      field: '9px',
      md: '10px',
      lg: '12px',
      card: '14px',
      xl: '16px',
      hero: '18px',
      pill: '999px',
    },
    boxShadow: {
      card: 'var(--shadow)',
      lift: 'var(--shadow-lift)',
      pop: 'var(--shadow-pop)',
      tab: 'var(--shadow-tab)',
    },
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
  },
  shortcuts: {
    // 卡片与容器
    'ui-card': 'bg-surface rounded-card shadow-card',
    'ui-row': 'flex items-center',
    'ui-between': 'flex items-center justify-between',
    'ui-stack': 'flex flex-col',
    'ui-divider': 'h-px w-full bg-line',
    'ui-scroll': 'overflow-y-auto overscroll-contain',

    // 文本
    'ui-label': 'text-[11.5px] font-600 text-ink-soft',
    'ui-help': 'text-[11px] leading-relaxed text-ink-mute',
    'ui-title': 'text-[13px] font-600 text-ink',
    'ui-section-title': 'text-[15px] font-700 tracking-[-0.2px]',

    // 按钮与交互
    'ui-btn': 'inline-flex items-center justify-center gap-1.5 select-none transition-all duration-150 active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    'ui-icon-btn': 'inline-grid place-items-center w-7 h-7 rounded-sm text-ink-mute transition-colors duration-150 hover:bg-line hover:text-ink',
    'ui-chip': 'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-600 leading-none',

    // 表单
    'ui-field-row': 'grid grid-cols-1 gap-x-3 gap-y-0 sm:grid-cols-2',
    'ui-field-row-3': 'grid grid-cols-1 gap-x-3 gap-y-0 sm:grid-cols-3',
    'ui-form-foot': 'flex items-center justify-end gap-2',

    // 弹窗
    'ui-modal-panel': 'bg-surface rounded-xl shadow-pop flex flex-col overflow-hidden',
    'ui-modal-head': 'flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line',
    'ui-modal-body': 'px-5 pt-4 pb-2 overflow-y-auto overscroll-contain',
    'ui-modal-foot': 'flex items-center gap-2 px-5 py-3 border-t border-line bg-surface-sunk',

    // 数据展示
    'ui-stat': 'flex items-center gap-3',
    'ui-stat-ico': 'w-10 h-10 rounded-lg grid place-items-center shrink-0',
    'ui-stat-num': 'text-[20px] font-800 tracking-[-0.5px] leading-[1.1]',
    'ui-stat-label': 'text-[11px] text-ink-mute mt-0.5',

    // 响应式工具
    'ui-toolbar': 'flex flex-wrap items-center justify-between gap-3 mb-4.5',
    'ui-grid-2': 'grid grid-cols-1 gap-5 md:grid-cols-2',
    'ui-grid-3': 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3',
  },
})
