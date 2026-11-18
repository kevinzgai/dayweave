/**
 * 主题系统 · 5 套配色方案
 * ---------------------------------------------------------------------------
 * 设计思路
 * 1. 每套主题 = 一组 CSS 变量，切换时写到 <html> 上（行内变量 + data-theme）
 * 2. uno.config.js 的颜色令牌全部指向 var(--x)，组件不感知主题，切主题零改代码
 * 3. styles.css 的 :root 保留「藏蓝暖阳」等价副本，作为脚本执行前的回退
 * 4. 第一套「藏蓝暖阳」按参考图复刻：深藏蓝侧栏 + 暖黄选中条 + 亮蓝进度
 */

const STORAGE_KEY = 'time-master-state-v1'

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700]

function alpha(hex, a) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function inkRgb(hex) {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`
}

/**
 * 主题定义
 * brand      主色色阶（50 最浅 → 700 最深；暗色主题里 50/100 是「深底」，600/700 是「亮字」）
 * nav        侧栏（参考图是深色侧栏，选中项为浅色高亮条）
 * accent     强调色（参考图里的暖黄）
 */
export const THEMES = [
  {
    id: 'dusk',
    name: '藏蓝暖阳',
    desc: '复刻参考图 · 深藏蓝侧栏 + 暖黄高亮',
    mode: 'light',
    swatch: ['#2E3A57', '#3B7DF6', '#F2C14E', '#F4F6FA'],
    brand: {
      50: '#F2F7FF', 100: '#E4EEFE', 200: '#C6DAFD', 300: '#93B9FB',
      400: '#5D95F9', 500: '#3B7DF6', 600: '#2C66D8', 700: '#2354B8',
    },
    bg: '#F4F6FA',
    surface: '#FFFFFF',
    sunk: '#F8FAFD',
    ink: '#1C2433',
    ink2: '#5A6478',
    ink3: '#8D97A9',
    ink4: '#B7C0CE',
    line: '#E8ECF3',
    lineStrong: '#D5DCE7',
    nav: '#2E3A57',
    navActive: '#F5CB65',
    navActiveInk: '#2A3350',
    navText: '#AEB9CD',
    navInk: '#FFFFFF',
    navLabel: '#6E7C97',
    navAccent: '#F5CB65',
    navHover: 'rgba(255, 255, 255, .06)',
    navLine: 'rgba(255, 255, 255, .09)',
    accent: '#F2C14E',
    accentInk: '#82600F',
    success: '#1FA97A',
    warning: '#E39A2B',
    danger: '#E2566F',
    info: '#3B7DF6',
    violet: '#7C6BE8',
    heroGrad: 'linear-gradient(120deg, #E7F0FF 0%, #F5F8FF 48%, #FDF3DA 100%)',
  },
  {
    id: 'sakura',
    name: '樱粉晨光',
    desc: '海报同源 · 玫瑰粉 + 奶油金',
    mode: 'light',
    swatch: ['#3B2B35', '#E45C8C', '#F3B24C', '#FBF6F9'],
    brand: {
      50: '#FFF5F9', 100: '#FFE4EF', 200: '#FFC9DE', 300: '#FBA8C8',
      400: '#F07FA9', 500: '#E45C8C', 600: '#C9437A', 700: '#A62F63',
    },
    bg: '#FBF6F9',
    surface: '#FFFFFF',
    sunk: '#FDF8FB',
    ink: '#2B2029',
    ink2: '#6B5A66',
    ink3: '#9C8B97',
    ink4: '#C4B4BE',
    line: '#F2E7EC',
    lineStrong: '#E4D3DC',
    nav: '#3B2B35',
    navActive: '#F8CFE0',
    navActiveInk: '#6E2544',
    navText: '#C0A9B4',
    navInk: '#FFFFFF',
    navLabel: '#806874',
    navAccent: '#F8CFE0',
    navHover: 'rgba(255, 255, 255, .07)',
    navLine: 'rgba(255, 255, 255, .1)',
    accent: '#F3B24C',
    accentInk: '#82550F',
    success: '#2FA57C',
    warning: '#E0992F',
    danger: '#DE4F6C',
    info: '#5C8FF0',
    violet: '#A878E0',
    heroGrad: 'linear-gradient(120deg, #FFE8F1 0%, #FFF7FA 48%, #FDF1DC 100%)',
  },
  {
    id: 'mint',
    name: '薄荷青竹',
    desc: '清爽克制 · 竹青绿 + 暖沙金',
    mode: 'light',
    swatch: ['#22362F', '#16A97F', '#E4B44C', '#F4F9F7'],
    brand: {
      50: '#F0FBF7', 100: '#DEF5ED', 200: '#C0EBDD', 300: '#86D8BE',
      400: '#43BF99', 500: '#16A97F', 600: '#0E8E6A', 700: '#0A7356',
    },
    bg: '#F4F9F7',
    surface: '#FFFFFF',
    sunk: '#F8FCFA',
    ink: '#16241F',
    ink2: '#52655E',
    ink3: '#879993',
    ink4: '#B4C3BD',
    line: '#E4EDE9',
    lineStrong: '#D2E0DA',
    nav: '#22362F',
    navActive: '#B7EBD6',
    navActiveInk: '#0E5240',
    navText: '#A6BCB3',
    navInk: '#FFFFFF',
    navLabel: '#6C847A',
    navAccent: '#B7EBD6',
    navHover: 'rgba(255, 255, 255, .06)',
    navLine: 'rgba(255, 255, 255, .09)',
    accent: '#E4B44C',
    accentInk: '#77540F',
    success: '#16A97F',
    warning: '#E29A2C',
    danger: '#DC5A70',
    info: '#3F8FDB',
    violet: '#8B79E0',
    heroGrad: 'linear-gradient(120deg, #E2F7EF 0%, #F4FBF8 48%, #FBF2DA 100%)',
  },
  {
    id: 'violet',
    name: '紫罗兰暮光',
    desc: '专注氛围 · 暮紫 + 落日金',
    mode: 'light',
    swatch: ['#2C2545', '#7B61E8', '#E8A13A', '#F6F5FC'],
    brand: {
      50: '#F7F4FF', 100: '#EFEBFE', 200: '#DED8FB', 300: '#C7BCF7',
      400: '#A08FF0', 500: '#7B61E8', 600: '#6550CC', 700: '#503FA8',
    },
    bg: '#F6F5FC',
    surface: '#FFFFFF',
    sunk: '#FAF9FE',
    ink: '#211B33',
    ink2: '#5D5473',
    ink3: '#8E85A4',
    ink4: '#BAB2C9',
    line: '#E9E5F4',
    lineStrong: '#D8D2E8',
    nav: '#2C2545',
    navActive: '#D9CDF8',
    navActiveInk: '#4A3A86',
    navText: '#B4AACE',
    navInk: '#FFFFFF',
    navLabel: '#7A6E97',
    navAccent: '#D9CDF8',
    navHover: 'rgba(255, 255, 255, .07)',
    navLine: 'rgba(255, 255, 255, .1)',
    accent: '#E8A13A',
    accentInk: '#7C560F',
    success: '#2FA97A',
    warning: '#E29A2C',
    danger: '#DE5573',
    info: '#5B84F0',
    violet: '#7B61E8',
    heroGrad: 'linear-gradient(120deg, #EDE7FF 0%, #F7F4FF 48%, #FDF2E1 100%)',
  },
  {
    id: 'midnight',
    name: '石墨暗夜',
    desc: '深色模式 · 夜间护眼 + 星蓝高光',
    mode: 'dark',
    swatch: ['#0E1017', '#6C7BEF', '#F0C464', '#1A1D26'],
    brand: {
      50: '#191F33', 100: '#232A4D', 200: '#2F3A63', 300: '#45538F',
      400: '#5F6FD8', 500: '#6C7BEF', 600: '#9BAAFF', 700: '#C0CAFF',
    },
    bg: '#12141B',
    surface: '#1A1D26',
    sunk: '#151821',
    ink: '#E9ECF3',
    ink2: '#B4BBCB',
    ink3: '#7F8798',
    ink4: '#5A6273',
    line: '#272B37',
    lineStrong: '#363D4D',
    nav: '#0E1017',
    navActive: '#232A4D',
    navActiveInk: '#C6D0FF',
    navText: '#8D96AB',
    navInk: '#FFFFFF',
    navLabel: '#5F6880',
    navAccent: '#9BAAFF',
    navHover: 'rgba(255, 255, 255, .05)',
    navLine: 'rgba(255, 255, 255, .07)',
    accent: '#F0C464',
    accentInk: '#F5D58E',
    success: '#3FCE9C',
    warning: '#E9B04A',
    danger: '#F0708C',
    info: '#6FA0FF',
    violet: '#A98BFF',
    heroGrad: 'linear-gradient(120deg, #1C2444 0%, #1A1D26 52%, #2B2340 100%)',
  },
]

export const DEFAULT_THEME = 'dusk'

export function getTheme(id) {
  return THEMES.find(t => t.id === id) || THEMES[0]
}

/** 主题 → CSS 变量表 */
export function themeVars(id) {
  const t = getTheme(id)
  const dark = t.mode === 'dark'
  const rgb = inkRgb(t.ink)
  const v = {
    '--brand-grad': `linear-gradient(135deg, ${t.brand[400]}, ${t.brand[700]})`,
    '--brand-ring': alpha(t.brand[500], dark ? 0.4 : 0.2),
    '--brand-shadow': `0 1px 2px ${alpha(t.brand[600], dark ? 0.45 : 0.24)}`,
    '--on-brand': '#FFFFFF',

    '--bg': t.bg,
    '--surface': t.surface,
    '--surface-sunk': t.sunk,
    '--surface-grad': `linear-gradient(180deg, ${t.surface}, ${t.sunk})`,
    '--line': t.line,
    '--line-strong': t.lineStrong,

    '--ink': t.ink,
    '--ink-2': t.ink2,
    '--ink-3': t.ink3,
    '--ink-4': t.ink4,

    '--nav': t.nav,
    '--nav-active': t.navActive,
    '--nav-active-ink': t.navActiveInk,
    '--nav-text': t.navText,
    '--nav-ink': t.navInk,
    '--nav-label': t.navLabel,
    '--nav-accent': t.navAccent,
    '--nav-hover': t.navHover,
    '--nav-line': t.navLine,

    '--accent': t.accent,
    '--accent-soft': alpha(t.accent, dark ? 0.16 : 0.2),
    '--accent-ink': t.accentInk,

    '--success': t.success,
    '--success-soft': alpha(t.success, dark ? 0.16 : 0.12),
    '--warning': t.warning,
    '--warning-soft': alpha(t.warning, dark ? 0.16 : 0.13),
    '--danger': t.danger,
    '--danger-soft': alpha(t.danger, dark ? 0.16 : 0.11),
    '--info': t.info,
    '--info-soft': alpha(t.info, dark ? 0.16 : 0.11),
    '--violet': t.violet,
    '--violet-soft': alpha(t.violet, dark ? 0.16 : 0.12),

    '--hero-grad': t.heroGrad,
    '--hero-blob': alpha(t.brand[500], dark ? 0.12 : 0.07),
    '--hero-card': dark ? 'rgba(255, 255, 255, .05)' : 'rgba(255, 255, 255, .62)',

    '--scrim': dark ? 'rgba(5, 7, 12, .64)' : 'rgba(24, 28, 42, .34)',
    '--shadow': dark
      ? '0 1px 2px rgba(0, 0, 0, .45), 0 12px 32px rgba(0, 0, 0, .38)'
      : `0 1px 2px rgba(${rgb}, .04), 0 10px 30px rgba(${rgb}, .05)`,
    '--shadow-lift': dark
      ? '0 14px 34px rgba(0, 0, 0, .55)'
      : `0 12px 30px rgba(${rgb}, .11)`,
    '--shadow-pop': dark
      ? '0 26px 70px rgba(0, 0, 0, .7)'
      : '0 26px 70px rgba(20, 24, 40, .26)',
    '--shadow-tab': dark
      ? '0 1px 5px rgba(0, 0, 0, .5)'
      : `0 1px 4px rgba(${rgb}, .08)`,
  }
  STEPS.forEach(k => { v[`--brand-${k}`] = t.brand[k] })
  return v
}

/** 桌面端：让系统标题栏 / 窗口边框跟随主题（浏览器环境静默跳过） */
export async function syncNativeTheme(mode) {
  try {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setTheme(mode === 'dark' ? 'dark' : 'light')
  } catch { /* 老版本运行时没有该能力时忽略 */ }
}

/** 把主题写到 <html>：行内变量覆盖 + data-theme 便于 CSS 精确命中 */
export function applyTheme(id) {
  const t = getTheme(id)
  if (typeof document === 'undefined') return t
  const root = document.documentElement
  const vars = themeVars(t.id)
  Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]))
  root.setAttribute('data-theme', t.id)
  root.setAttribute('data-mode', t.mode)
  root.style.colorScheme = t.mode === 'dark' ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t.nav)
  syncNativeTheme(t.mode)
  return t
}

/** 首帧前读取上次选择的主题，避免启动闪一下默认配色 */
export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME
    const theme = JSON.parse(raw)?.settings?.theme
    return THEMES.some(t => t.id === theme) ? theme : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}
