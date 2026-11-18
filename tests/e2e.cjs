'use strict'
/**
 * 织日 DayWeave · 端到端回归测试
 * 用法：
 *   node tests/e2e.cjs --rounds=3            连跑 3 轮
 *   node tests/e2e.cjs --rounds=1 --only=nav 只跑指定套件
 *   TM_URL=http://localhost:1420/ node tests/e2e.cjs --rounds=1  对开发服务器跑
 */
const { spawn } = require('child_process')
const http = require('http')
const os = require('os')
const path = require('path')
const fs = require('fs')

const CHROME = process.env.TM_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.TM_URL || 'http://localhost:4173/'
// 手册与设置页显示的版本号跟着 package.json 走，避免每次发版都要改断言
const PKG_VERSION = require('../package.json').version
const KEY = 'time-master-state-v1'
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='))
  return hit ? hit.split('=').slice(1).join('=') : d
}
const ROUNDS = Number(arg('rounds', '3'))
const ONLY = arg('only', '')

const sleep = ms => new Promise(r => setTimeout(r, ms))

const httpGet = u => new Promise((res, rej) => {
  http.get(u, r => {
    let d = ''
    r.on('data', c => d += c)
    r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
  }).on('error', rej)
})

const httpPut = u => new Promise((res, rej) => {
  const r = http.request(u, { method: 'PUT' }, rs => {
    let d = ''
    rs.on('data', c => d += c)
    rs.on('end', () => { try { res(JSON.parse(d)) } catch { res(d) } })
  })
  r.on('error', rej)
  r.end()
})

const HELPERS = `(() => {
  const setVal = (el, v) => {
    if (!el) return false;
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  window.__tm = {
    setVal,
    nav(label) { const e = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes(label)); if (e) { e.click(); return true } return false },
    click(sel, text) { const l = [...document.querySelectorAll(sel)]; const e = text == null ? l[0] : l.find(x => (x.textContent || '').includes(text)); if (e) { e.click(); return true } return false },
    set(sel, v, i) { const el = [...document.querySelectorAll(sel)][i || 0]; return setVal(el, v) },
    tick(sel, i) { const el = [...document.querySelectorAll(sel)][i || 0]; if (!el) return false; el.click(); return true },
    text(sel) { return document.querySelector(sel) ? document.querySelector(sel).textContent.trim() : '' },
    title() { return document.querySelector('.topbar h1') ? document.querySelector('.topbar h1').textContent.trim() : '' },
    body() { return document.querySelector('.content-inner') ? document.querySelector('.content-inner').innerText.trim() : '' },
    state() { return JSON.parse(localStorage.getItem('time-master-state-v1') || '{}') },
    count(sel) { return document.querySelectorAll(sel).length },
    clock() { const els = [...document.querySelectorAll('.content-inner div')]; const e = els.find(x => x.children.length === 0 && /^\\d{2}:\\d{2}$/.test((x.textContent || '').trim())); return e ? e.textContent.trim() : '' },
    keyOn(el, key) { if (!el) return false; el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); return true },
    ctrlK() { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })); return true },
  };
  return true;
})()`

class Session {
  constructor(proc, ws, port, profile) {
    this.proc = proc; this.ws = ws; this.port = port; this.profile = profile
    this.id = 0; this.pending = new Map(); this.errors = []; this.dialogs = []
    this.autoAccept = true
    this.cmd = (method, params = {}) => new Promise((res, rej) => {
      const i = ++this.id
      const t = setTimeout(() => { this.pending.delete(i); rej(new Error('CDP 超时: ' + method)) }, 20000)
      this.pending.set(i, m => { clearTimeout(t); res(m) })
      this.ws.send(JSON.stringify({ id: i, method, params }))
    })
    this.ev = async (expression) => {
      const m = await this.cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
      if (m.error) throw new Error('eval: ' + JSON.stringify(m.error))
      const r = m.result
      if (r && r.exceptionDetails) throw new Error('eval: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text))
      return r && r.result ? r.result.value : undefined
    }
    this.waitReady = async (timeout = 12000) => {
      const end = Date.now() + timeout
      while (Date.now() < end) {
        try {
          const ok = await this.ev(`!!(document.querySelector('.topbar h1') && document.getElementById('root') && document.getElementById('root').children.length)`)
          if (ok) { await this.ev(HELPERS); return true }
        } catch { /* 导航中上下文失效 */ }
        await sleep(180)
      }
      throw new Error('页面未就绪')
    }
    this.reset = async () => {
      await this.ev(`localStorage.removeItem(${JSON.stringify(KEY)})`)
      await this.cmd('Page.reload')
      await this.waitReady()
      await sleep(150)
    }
    this.reload = async () => {
      await this.cmd('Page.reload')
      await this.waitReady()
      await sleep(150)
    }
    this.nav = async (label, wait = 340) => {
      await this.ev(`window.__tm.nav(${JSON.stringify(label)})`)
      await sleep(wait)
    }
    this.st = () => this.ev(`window.__tm.state()`)
  }

  async close() {
    try { this.ws.close() } catch {}
    try { this.proc.kill() } catch {}
    await sleep(300)
    try {
      if (this.profile && this.profile.includes('tm-e2e-') && this.profile.startsWith(os.tmpdir())) {
        fs.rmSync(this.profile, { recursive: true, force: true })
      }
    } catch {}
  }
}

async function openSession({ width = 1440, height = 900, url = BASE } = {}) {
  const port = 9500 + Math.floor(Math.random() * 400)
  const profile = path.join(os.tmpdir(), `tm-e2e-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5)}`)
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-features=Translate', '--mute-audio',
    `--window-size=${width},${height}`, `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, url,
  ], { stdio: 'ignore' })

  let page = null
  const end = Date.now() + 30000
  while (Date.now() < end) {
    try {
      const list = await httpGet(`http://127.0.0.1:${port}/json`)
      const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) { page = p; break }
    } catch {}
    await sleep(150)
  }
  if (!page) { try { proc.kill() } catch {}; throw new Error('Chrome 启动失败') }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const s = new Session(proc, ws, port, profile)
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.id && s.pending.has(m.id)) { s.pending.get(m.id)(m); s.pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      s.errors.push((d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown')
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      s.errors.push('console.error: ' + m.params.args.map(a => a.value || a.description || '').join(' '))
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      s.errors.push('log: ' + m.params.entry.text)
    } else if (m.method === 'Page.javascriptDialogOpening') {
      s.dialogs.push(m.params.message)
      s.cmd('Page.handleJavaScriptDialog', { accept: s.autoAccept }).catch(() => {})
    }
  }
  await s.cmd('Runtime.enable')
  await s.cmd('Page.enable')
  await s.cmd('Log.enable')
  await s.waitReady()
  return s
}

async function attachTab(port, url) {
  const t = await httpPut(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`)
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  }
  const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => {
    const m = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return m.result && m.result.result ? m.result.result.value : undefined
  }
  return { ev, cmd, close: () => { try { ws.close() } catch {} } }
}

/* ------------------------------- 套件 ------------------------------- */

const PAGES = [
  ['首页驾驶舱', '时间管理工作台'],
  ['收件箱', '收件箱'],
  ['任务管理', '任务管理'],
  ['日程 / 时间块', '日程 / 时间块'],
  ['优先级 / 四象限', '任务管理'],
  ['专注计时', '专注计时'],
  ['项目管理', '项目管理'],
  ['目标管理', '目标管理'],
  ['习惯打卡', '习惯打卡'],
  ['知识素材库', '知识素材库'],
  ['经验素材库', '经验素材库'],
  ['工作成果', '工作成果'],
  ['周报 / 月报', '周报 / 月报'],
  ['时间复盘', '时间复盘'],
  ['设置中心', '设置中心'],
  ['使用手册', '使用手册'],
]

const SUITES = []

function suite(name, fn) { SUITES.push({ name, fn }) }

suite('导航与渲染', async (s, c) => {
  const n = await s.ev(`window.__tm.count('.nav-item')`)
  c('侧边栏 16 个入口', n === 16, '实际 ' + n)
  for (const [label, want] of PAGES) {
    await s.nav(label, 300)
    const t = await s.ev(`window.__tm.title()`)
    const len = await s.ev(`window.__tm.body().length`)
    const need = label === '使用手册' ? 15 : 40
    c(`页面渲染：${label}`, t === want && len > need, `标题「${t}」正文 ${len} 字`)
  }
  await s.nav('优先级 / 四象限', 300)
  c('四象限视图 4 个格子', await s.ev(`window.__tm.count('.quad-grid .panel')`) === 4)
  await s.nav('首页驾驶舱', 300)
  c('驾驶舱 5 大区块齐全', await s.ev(`window.__tm.count('.content-inner .panel')`) >= 6,
    String(await s.ev(`window.__tm.count('.content-inner .panel')`)))
})

suite('任务增删改', async (s, c) => {
  await s.reset()
  await s.nav('任务管理')
  const base = (await s.st()).tasks.length
  c('初始任务 8 条', base === 8, String(base))

  await s.ev(`window.__tm.click('.btn-primary','新建任务')`)
  await sleep(220)
  await s.ev(`window.__tm.set('.modal input.input','自动化测试任务')`)
  await s.ev(`window.__tm.set('.modal select.select','Q1')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(360)
  let st = await s.st()
  const added = st.tasks.find(t => t.title === '自动化测试任务')
  c('新建任务入列', st.tasks.length === base + 1 && !!added && added.quadrant === 'Q1', `共 ${st.tasks.length} 条`)
  c('新任务默认未完成', added.status === 'todo' && added.progress === 0)
  const localToday = await s.ev(`(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')})()`)
  c('新任务默认计划今天', added.date === localToday)

  await s.ev(`(() => { const row = [...document.querySelectorAll('.task-row')].find(r => (r.textContent || '').includes('自动化测试任务')); if (!row) return false; row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true })()`)
  await sleep(280)
  c('双击任务行打开编辑弹窗', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.set('.modal input.input','编辑后的任务标题')`)
  await s.ev(`window.__tm.set('.modal textarea','备注：由自动化测试写入')`)
  await s.ev(`window.__tm.set('.modal input[data-schedule="date"]','2099-12-31')`)
  c('未来计划日期禁用今日要事', await s.ev(`document.querySelector('.modal input[type="checkbox"]').disabled && !document.querySelector('.modal input[type="checkbox"]').checked`))
  await s.ev(`window.__tm.set('.modal select','done',1)`)
  await sleep(200)
  const rng = await s.ev(`document.querySelector('.modal input[type=range]').value`)
  c('状态改为完成 → 进度自动 100', rng === '100', '进度 ' + rng)
  await s.ev(`window.__tm.set('.modal select','Q3',0)`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(380)
  st = await s.st()
  const edited = st.tasks.find(t => t.title === '编辑后的任务标题')
  c('编辑保存生效', !!edited && edited.status === 'done' && edited.quadrant === 'Q3' && edited.progress === 100)
  c('备注已保存', !!edited && String(edited.note).includes('自动化'))
  c('计划日期编辑保存', edited.date === '2099-12-31' && edited.todayTop === false)

  await s.ev(`(() => { const row = [...document.querySelectorAll('.task-row')].find(r => (r.textContent || '').includes('编辑后的任务标题')); if (!row) return false; row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true })()`)
  await sleep(260)
  await s.ev(`window.__tm.set('.modal input.input','不该被保存的标题')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(320)
  st = await s.st()
  c('取消编辑不落库', !st.tasks.some(t => t.title === '不该被保存的标题'))
  c('取消后弹窗关闭', !(await s.ev(`!!document.querySelector('.modal')`)))

  const before = st.tasks.length
  await s.ev(`(() => { const row = [...document.querySelectorAll('.task-row')].find(r => (r.textContent || '').includes('编辑后的任务标题')); if (!row) return false; row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true })()`)
  await sleep(260)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','删除')`)
  await sleep(320)
  const confirmShown = await s.ev(`[...document.querySelectorAll('.modal')].some(m => (m.textContent || '').includes('此操作不可恢复'))`)
  c('删除有二次确认（应用内弹窗）', confirmShown === true)
  // 用确认框自己的「取消」收起，编辑弹窗应保留
  await s.ev(`(()=>{const ms=[...document.querySelectorAll('.modal')];const last=ms[ms.length-1];const b=[...last.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='取消');if(b){b.click();return true}return false})()`)
  await sleep(280)
  c('确认框「取消」只收起确认层', (await s.ev(`document.querySelectorAll('.modal').length`)) === 1)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','删除')`)
  await sleep(260)
  await s.ev(`(()=>{const ms=[...document.querySelectorAll('.modal')];const last=ms[ms.length-1];const b=[...last.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='删除');if(b){b.click();return true}return false})()`)
  await sleep(300)
  c('删除后编辑弹窗同时收起', (await s.ev(`document.querySelectorAll('.modal').length`)) === 0)
  await sleep(420)
  st = await s.st()
  c('删除任务生效', st.tasks.length === before - 1, `${before} → ${st.tasks.length}`)

  await s.nav('优先级 / 四象限')
  c('四象限显示未完成任务', await s.ev(`window.__tm.count('.quad-grid .panel')`) === 4)
  const clicked = await s.ev(`(()=>{const e=document.querySelector('.quad-grid .panel .grow');if(e){e.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return true}return false})()`)
  await sleep(300)
  c('四象限双击标题可编辑', clicked === true && await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(200)
})

suite('收件箱流转', async (s, c) => {
  await s.reset()
  await s.nav('收件箱')
  const n0 = (await s.st()).inbox.length
  c('初始收件箱 3 条', n0 === 3, String(n0))
  await s.ev(`window.__tm.set('.content-inner input.input','自动化捕捉：给客户回电话')`)
  await s.ev(`window.__tm.click('.content-inner .btn-primary','捕捉')`)
  await sleep(360)
  let st = await s.st()
  c('捕捉进收件箱', st.inbox.length === n0 + 1 && st.inbox.some(i => i.title.includes('给客户回电话')))
  c('输入框已清空', (await s.ev(`document.querySelector('.content-inner input.input').value`)) === '')

  const tasks0 = (await s.st()).tasks.length
  // 定位到刚捕捉的那一行，点它自己的「转任务」，避免误点首条旧数据
  const conv = await s.ev(`(()=>{
    const row = [...document.querySelectorAll('.top3-item')].find(x => x.textContent.includes('给客户回电话'));
    if (!row) return false;
    const btn = row.querySelector('[title="转为任务"]');
    if (btn) { btn.click(); return true }
    return false
  })()`)
  await sleep(420)
  st = await s.st()
  c('找到目标行并转任务', conv === true)
  c('转任务后离开收件箱', st.inbox.length === n0, String(st.inbox.length))
  c('任务列表新增该条', st.tasks.length === tasks0 + 1 && st.tasks.some(t => t.title.includes('给客户回电话')),
    `任务 ${tasks0} → ${st.tasks.length}`)

  await s.ev(`window.__tm.click('[aria-label="删除条目"]')`)
  await sleep(320)
  st = await s.st()
  c('收件箱删除', st.inbox.length === n0 - 1, String(st.inbox.length))

  // 空状态
  while ((await s.ev(`window.__tm.count('[aria-label="删除条目"]')`)) > 0) {
    await s.ev(`window.__tm.click('[aria-label="删除条目"]')`)
    await sleep(200)
  }
  c('收件箱清空显示空状态', (await s.ev(`window.__tm.body()`)).includes('收件箱空了'))
})

suite('时间块', async (s, c) => {
  await s.reset()
  await s.nav('日程 / 时间块')
  const b0 = (await s.st()).blocks.length
  await s.ev(`window.__tm.click('.btn-primary','新增时间块')`)
  await sleep(240)
  await s.ev(`window.__tm.set('.modal input.input','自动化时间块')`)
  await s.ev(`window.__tm.set('.modal input[data-schedule=time]','21:00',0)`)
  await s.ev(`window.__tm.set('.modal input[data-schedule=time]','21:30',1)`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(400)
  let st = await s.st()
  c('新增时间块', st.blocks.length === b0 + 1 && st.blocks.some(b => b.title === '自动化时间块'))
  c('时间块按时序排序', st.blocks.every((b, i) => i === 0 || st.blocks[i - 1].start <= b.start))

  const first = st.blocks[0]
  await s.ev(`document.querySelectorAll('.content-inner .panel .pill')[0].click()`)
  await sleep(320)
  st = await s.st()
  c('点击状态标签切换进度', st.blocks[0].status !== first.status, `${first.status} → ${st.blocks[0].status}`)

  const b1 = st.blocks.length
  await s.ev(`document.querySelector('[aria-label="删除时间块"]').click()`)
  await sleep(340)
  st = await s.st()
  c('删除时间块', st.blocks.length === b1 - 1)

  const total = await s.ev(`window.__tm.text('.stat-strip .stat .stat-num')`)
  c('统计卡片随之更新', String(total) === String(st.blocks.length), `卡片 ${total} / 实际 ${st.blocks.length}`)
})

suite('专注计时', async (s, c) => {
  await s.reset()
  await s.nav('专注计时')
  await s.ev(`window.__tm.click('.tab-pill','45 分')`)
  await sleep(260)
  let st = await s.st()
  c('切换 45 分预设', st.timer.presetMin === 45 && st.timer.remaining === 2700, `${st.timer.presetMin}分/${st.timer.remaining}s`)

  await s.ev(`window.__tm.set('.content-inner input.input','自动化专注：写回归脚本')`)
  await s.ev(`window.__tm.click('.btn-primary','开始专注')`)
  await sleep(1500)
  st = await s.st()
  c('计时启动', st.timer.running === true)
  c('专注主题写入计时器', String(st.timer.task).includes('自动化专注'))

  const clock1 = await s.ev(`window.__tm.clock()`)
  await sleep(1400)
  const clock2 = await s.ev(`window.__tm.clock()`)
  c('倒计时在走', clock1 !== clock2, `${clock1} → ${clock2}`)

  await s.nav('首页驾驶舱')
  await s.nav('专注计时')
  st = await s.st()
  c('切页后计时不中断', st.timer.running === true)

  await s.ev(`window.__tm.click('.btn-primary','暂停')`)
  await sleep(340)
  st = await s.st()
  c('暂停保留剩余时间', st.timer.running === false && st.timer.remaining > 2400 && st.timer.remaining < 2700, String(st.timer.remaining))

  await s.ev(`window.__tm.click('.btn-ghost','重置')`)
  await sleep(300)
  st = await s.st()
  c('重置回满时长', st.timer.running === false && st.timer.remaining === 2700)

  const sessions0 = st.focus.sessions.length
  await s.ev(`window.__tm.click('.btn-primary','开始专注')`)
  await sleep(400)
  await s.ev(`window.__tm.click('.btn-ghost','完成')`)
  await sleep(400)
  st = await s.st()
  c('手动完成记一条专注', st.focus.sessions.length === sessions0 + 1, `${sessions0} → ${st.focus.sessions.length}`)
  c('专注记录含主题', st.focus.sessions[st.focus.sessions.length - 1].task.includes('自动化专注'))

  await s.ev(`window.__tm.click('.tab-pill','6h')`)
  await sleep(280)
  st = await s.st()
  c('调整每日专注目标', st.focus.goalHours === 6, String(st.focus.goalHours))
})

suite('计时到点自动记账', async (s, c) => {
  await s.reset()
  await s.nav('专注计时')
  await s.ev(`(() => { if (!window.__realNow) { window.__realNow = Date.now; window.__off = 0; Date.now = () => window.__realNow() + window.__off } return true })()`)
  await s.ev(`window.__tm.click('.tab-pill','25 分')`)
  await sleep(200)
  const sessions0 = (await s.st()).focus.sessions.length
  await s.ev(`window.__tm.click('.btn-primary','开始专注')`)
  await sleep(600)
  c('计时已启动', (await s.st()).timer.running === true)
  await s.ev(`window.__off += 26 * 60 * 1000`)
  await sleep(1600)
  const st = await s.st()
  c('到点自动结束', st.timer.running === false)
  c('自动新增专注记录', st.focus.sessions.length === sessions0 + 1, `${sessions0} → ${st.focus.sessions.length}`)
  c('到点显示 00:00', (await s.ev(`window.__tm.clock()`)) === '00:00')
  c('提示本轮完成', (await s.ev(`window.__tm.body()`)).includes('本轮完成'))
})

suite('习惯打卡', async (s, c) => {
  await s.reset()
  await s.nav('习惯打卡')
  const before = await s.st()
  c('初始 4 个习惯', before.habits.length === 4)
  c('初始已打卡 2 个', before.habits.filter(h => h.done).length === 2)

  const idx = before.habits.findIndex(h => !h.done)
  await s.ev(`document.querySelectorAll('.content-inner .habit-check')[${idx}].click()`)
  await sleep(340)
  const after = await s.st()
  c('打卡后状态翻转', after.habits[idx].done === true)
  c('打卡写入今日历史', (after.habits[idx].history || []).length >= 1)
  // streak 是派生值（不落库），从页面统计卡验证
  const streak = await s.ev(`window.__tm.text('.stat-strip .stat:nth-child(3) .stat-num')`)
  c('最长连续天数更新为 1', streak === '1', streak)

  await s.ev(`document.querySelectorAll('.content-inner .habit-check')[${idx}].click()`)
  await sleep(320)
  const off = await s.st()
  c('再次点击取消打卡', off.habits[idx].done === false && (off.habits[idx].history || []).length === 0)

  await s.ev(`window.__tm.click('.btn-primary','新增习惯')`)
  await sleep(240)
  await s.ev(`window.__tm.set('.modal input.input','自动化习惯')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(360)
  c('新增习惯', (await s.st()).habits.some(h => h.name === '自动化习惯'))
})

suite('目标与项目', async (s, c) => {
  await s.reset()
  await s.nav('目标管理')
  let st = await s.st()
  const g0 = st.goals[0]
  await s.ev(`document.querySelectorAll('.content-inner .panel .btn-ghost')[1].click()`)
  await sleep(320)
  st = await s.st()
  c('目标进度 +', st.goals[0].current > g0.current, `${g0.current} → ${st.goals[0].current}`)
  await s.ev(`document.querySelectorAll('.content-inner .panel .btn-ghost')[0].click()`)
  await sleep(320)
  st = await s.st()
  c('目标进度 −', st.goals[0].current === g0.current, String(st.goals[0].current))

  await s.ev(`window.__tm.click('.btn-primary','新建目标')`)
  await sleep(240)
  await s.ev(`window.__tm.set('.modal input.input','自动化目标')`)
  await s.ev(`window.__tm.set('.modal input[type=number]','10')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(360)
  c('新建目标', (await s.st()).goals.some(g => g.title === '自动化目标'))

  await s.nav('项目管理')
  const p0 = (await s.st()).projects[0]
  await s.ev(`window.__tm.set('.content-inner input[type=range]','55')`)
  await sleep(320)
  st = await s.st()
  c('拖动项目进度条', st.projects[0].progress === 55, `${p0.progress} → ${st.projects[0].progress}`)
  c('平均进度同步刷新', (await s.ev(`window.__tm.text('.stat-strip .stat:last-child .stat-num')`)) ===
    Math.round(st.projects.reduce((a, p) => a + p.progress, 0) / st.projects.length) + '%')

  await s.ev(`window.__tm.click('.btn-primary','新建项目')`)
  await sleep(240)
  await s.ev(`window.__tm.set('.modal input.input','自动化项目')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(380)
  c('新建项目', (await s.st()).projects.some(p => p.name === '自动化项目'))
})

suite('知识 / 经验 / 成果', async (s, c) => {
  await s.reset()
  await s.nav('知识素材库')
  const k0 = (await s.st()).knowledge.length
  await s.ev(`window.__tm.click('.btn-primary','收录素材')`)
  await sleep(260)
  // 注意：页面顶部还有搜索框，表单内输入需限定在 form 内
  await s.ev(`window.__tm.set('.modal input.input','自动化素材标题')`)
  await s.ev(`window.__tm.set('.modal textarea','自动化素材正文')`)
  await s.ev(`window.__tm.set('.modal input.input','测试标签, 自动化',1)`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(400)
  let st = await s.st()
  const kn = st.knowledge.find(k => k.title === '自动化素材标题')
  c('新增知识素材', st.knowledge.length === k0 + 1 && !!kn)
  c('标签按逗号拆分', !!kn && kn.tags.length === 2, JSON.stringify(kn ? kn.tags : []))

  await s.ev(`window.__tm.set('.content-inner input.input','自动化素材')`)
  await sleep(280)
  c('关键词搜索命中 1 条', await s.ev(`window.__tm.count('.grid-3 .panel')`) === 1,
    String(await s.ev(`window.__tm.count('.grid-3 .panel')`)))
  await s.ev(`window.__tm.set('.content-inner input.input','')`)
  await sleep(240)
  c('清空搜索恢复全量', await s.ev(`window.__tm.count('.grid-3 .panel')`) === k0 + 1)

  await s.nav('经验素材库')
  c('经验库可渲染', (await s.ev(`window.__tm.body()`)).length > 40)

  await s.nav('工作成果')
  const w0 = (await s.st()).workResults.length
  await s.ev(`window.__tm.click('.btn-primary','添加成果')`)
  await sleep(240)
  await s.ev(`window.__tm.set('.modal input.input','自动化成果')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(380)
  st = await s.st()
  c('新增工作成果', st.workResults.length === w0 + 1 && st.workResults.some(w => w.title === '自动化成果'))
})

suite('复盘与报告', async (s, c) => {
  await s.reset()
  await s.nav('时间复盘')
  const tas = await s.ev(`window.__tm.count('.content-inner textarea')`)
  c('复盘 4 个问题', tas === 4, String(tas))
  for (let i = 0; i < 4; i++) {
    await s.ev(`window.__tm.set('.content-inner textarea', ${JSON.stringify(['自动化：完成了回归','自动化：脚本跑通','自动化：时间花在测试上','自动化：明天继续'])}, ${i})`)
  }
  await s.ev(`window.__tm.click('.content-inner form .btn-primary','保存复盘')`)
  await sleep(400)
  const st = await s.st()
  const today = await s.ev(`(()=>{const d=new Date();const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())})()`)
  c('复盘保存到本地', !!st.reviews[today] && st.reviews[today].biggest.includes('脚本跑通'))
  c('提示已保存', (await s.ev(`window.__tm.body()`)).includes('已保存到本地'))

  await s.nav('首页驾驶舱')
  c('驾驶舱显示复盘已填写', (await s.ev(`window.__tm.body()`)).includes('已填写'))

  await s.nav('周报 / 月报')
  const body = await s.ev(`window.__tm.body()`)
  c('周报渲染统计与图表', body.includes('每日专注分布') && body.includes('周期小结'))
  await s.ev(`window.__tm.click('.tab-pill','本月')`)
  await sleep(320)
  c('切换统计周期', (await s.ev(`window.__tm.body()`)).includes('本月专注时长'))
  // 用稳定的 data-testid 锚点，不再依赖柱状图内部的 .flex 结构
  const bars = await s.ev(`window.__tm.count('[data-testid=focus-bars] > div')`)
  const daysInMonth = new Date().getDate()
  c('柱状图数据点覆盖本月每一天', bars === daysInMonth, `${bars} / 期望 ${daysInMonth}`)
})

suite('命令面板', async (s, c) => {
  await s.reset()
  await s.ev(`window.__tm.ctrlK()`)
  await sleep(320)
  c('Ctrl+K 唤起命令面板', await s.ev(`!!document.querySelector('.palette')`))
  const items = await s.ev(`window.__tm.count('.palette-item')`)
  c('默认列出全部模块', items === 16, String(items))

  await s.ev(`window.__tm.set('.palette-input','专注')`)
  await sleep(320)
  const first = await s.ev(`document.querySelector('.palette-item.active .palette-label')?.textContent||''`)
  c('搜索命中专注计时', first.includes('专注'), first)
  await s.ev(`document.querySelector('.palette-item.active').click()`)
  await sleep(400)
  c('回车/点击跳转生效', (await s.ev(`window.__tm.title()`)) === '专注计时')

  await s.ev(`window.__tm.ctrlK()`)
  await sleep(300)
  await s.ev(`window.__tm.set('.palette-input','压测捕捉条目')`)
  await sleep(300)
  c('出现「记入收件箱」选项', (await s.ev(`document.querySelector('.palette-item.active .palette-label')?.textContent||''`)).includes('记入收件箱'))
  await s.ev(`window.__tm.keyOn(document.querySelector('.palette-input'),'Enter')`)
  await sleep(420)
  const st = await s.st()
  c('回车快速捕捉到收件箱', st.inbox.some(i => i.title === '压测捕捉条目'))
  c('捕捉后跳到收件箱页', (await s.ev(`window.__tm.title()`)) === '收件箱')

  await s.ev(`window.__tm.ctrlK()`)
  await sleep(280)
  await s.ev(`window.__tm.keyOn(document.querySelector('.palette-input'),'Escape')`)
  await sleep(280)
  c('Esc 关闭面板', !(await s.ev(`!!document.querySelector('.palette')`)))
})

suite('浮窗卡片与贴边', async (s, c) => {
  await s.reset()
  await s.nav('首页驾驶舱')
  const doing0 = (await s.st()).tasks.filter(t => t.status === 'doing').length
  c('浮窗打开前无浮层', !(await s.ev(`!!document.querySelector('.mini-panel')`)))

  await s.ev(`window.__tm.click('.top-btn','浮窗')`)
  await sleep(420)
  c('点击顶栏浮窗按钮打开卡片', await s.ev(`!!document.querySelector('.mini-panel')`))
  const countBeforeCreate = (await s.st()).tasks.length
  await s.ev(`document.querySelector('.mini-add').click()`)
  await sleep(150)
  c('创建表单在浮窗内部弹出', await s.ev(`!!document.querySelector('.mini-panel .mini-create-modal')`))
  c('空标题不可保存', await s.ev(`document.querySelector('.mini-create-modal button[type="submit"]').disabled`))
  await s.ev(`window.__tm.set('.mini-create-modal input', '  浮窗快速新增任务  ')`)
  await s.ev(`window.__tm.set('.mini-create-modal select', 'Q1')`)
  c('日期时间已替换原生控件', await s.ev(`!document.querySelector('.mini-create-modal input[type="date"], .mini-create-modal input[type="time"]')`))
  await s.ev(`document.querySelector('.mini-create-modal input[data-schedule="time"]').parentElement.querySelector('button').click()`)
  await s.ev(`document.querySelector('.schedule-picker button[aria-label="14时"]').click()`)
  await s.ev(`document.querySelector('.schedule-picker button[aria-label="30分"]').click()`)
  await s.ev(`window.__tm.click('.schedule-picker button','确定')`)
  c('自定义时间面板选择小时分钟', await s.ev(`document.querySelector('.mini-create-modal input[data-schedule="time"]').value === '14:30' && !document.querySelector('.schedule-picker')`))
  await s.ev(`document.querySelector('.mini-create-modal input[data-schedule="date"]').parentElement.querySelector('button').click()`)
  await s.ev(`window.__tm.click('.schedule-picker button','明天')`)
  c('自定义日历快捷选择明天', await s.ev(`!!document.querySelector('.mini-create-modal input[data-schedule="date"]').value && !document.querySelector('.schedule-picker')`))
  await s.ev(`window.__tm.set('.mini-create-modal input[data-schedule="date"]', '2099-12-31')`)
  c('浮窗未来日期不能标今日要事', await s.ev(`document.querySelector('.mini-create-modal input[type="checkbox"]').disabled`))
  await s.ev(`document.querySelector('.mini-create-modal button[type="submit"]').click()`)
  await sleep(250)
  const createdTask = (await s.st()).tasks.find(t => t.title === '浮窗快速新增任务')
  c('浮窗保存任务及表单字段', !!createdTask && createdTask.quadrant === 'Q1' && createdTask.time === '14:30' && createdTask.date === '2099-12-31' && createdTask.status === 'todo')
  c('浮窗展示全部未完成任务且超过5条不截断', await s.ev(`window.__tm.count('.mini-row')`) === (await s.st()).tasks.filter(t => t.status !== 'done').length)
  c('普通新任务立即显示日期', await s.ev(`[...document.querySelectorAll('.mini-row')].some(r=>r.textContent.includes('浮窗快速新增任务') && r.textContent.includes('2099-12-31'))`))
  c('保存后浮窗保留并提示成功', await s.ev(`!!document.querySelector('.mini-panel .mini-created') && !document.querySelector('.mini-create-modal')`))
  c('创建任务未跳转主窗口页面', await s.ev(`window.__tm.title()`) === '时间管理工作台')
  await s.ev(`document.querySelector('.mini-add').click()`)
  await sleep(100)
  c('重新打开表单清空草稿', await s.ev(`document.querySelector('.mini-create-modal input').value === ''`))
  await s.ev(`window.__tm.set('.mini-create-modal input', '取消的任务')`)
  await s.ev(`window.__tm.click('.mini-create-modal button', '取消')`)
  c('取消不创建任务', (await s.st()).tasks.length === countBeforeCreate + 1)
  const clock = await s.ev(`window.__tm.text('.mini-clock')`)
  c('浮窗显示倒计时', /^\d{2}:\d{2}$/.test(clock), clock)
  c('浮窗列出进行中/要事任务', (await s.ev(`window.__tm.count('.mini-row')`)) > 0,
    String(await s.ev(`window.__tm.count('.mini-row')`)))

  await s.ev(`window.__tm.click('.mini-head .mini-ico')`)
  await sleep(340)
  c('贴边收起为窄条', await s.ev(`!!document.querySelector('.mini-tab')`))
  c('收起后仍显示时间与任务数', /^\d{2}:\d{2}$/.test(await s.ev(`window.__tm.text('.mini-tab-time')`)))
  await s.ev(`document.querySelector('.mini-tab').click()`)
  await sleep(340)
  c('窄条点击展开', await s.ev(`!!document.querySelector('.mini-panel')`))

  await s.ev(`document.querySelector('.mini-check').click()`)
  await sleep(400)
  const st = await s.st()
  c('浮窗一键完成任务', st.tasks.filter(t => t.status === 'doing').length === doing0 - 1,
    `${doing0} → ${st.tasks.filter(t => t.status === 'doing').length}`)

  await s.ev(`document.querySelector('.mini-row .mini-ico').click()`)
  await sleep(400)
  const st2 = await s.st()
  c('浮窗按任务秒开专注', st2.timer.running === true && !!st2.timer.task)
  c('运行时只显示倒计时和任务目标', await s.ev(`!!document.querySelector('.mini-focus-clock') && document.querySelector('.mini-focus-task').textContent === ${JSON.stringify(st2.timer.task)} && !document.querySelector('.mini-panel .mini-head, .mini-panel .mini-list, .mini-panel .mini-actions, .mini-panel .mini-foot, .mini-panel .mini-created')`))
  await s.ev(`document.querySelector('.mini-focus-clock').click()`)
  await sleep(150)
  c('点击倒计时暂停并恢复任务列表', !(await s.st()).timer.running && await s.ev(`!!document.querySelector('.mini-list')`))
  c('未运行时专注区保持紧凑', await s.ev(`document.querySelector('.mini-timer').getBoundingClientRect().height < 85 && parseFloat(getComputedStyle(document.querySelector('.mini-timer .mini-clock')).fontSize) <= 22`))

  await s.ev(`document.querySelectorAll('.mini-head .mini-ico')[1].click()`)
  await sleep(360)
  c('关闭浮窗', !(await s.ev(`!!document.querySelector('.mini-panel')`)))
})

suite('跨窗口同步', async (s, c) => {
  await s.reset()
  await s.nav('首页驾驶舱')
  const done0 = await s.ev(`window.__tm.text('.dash-ring-in b')`)
  const t2 = await attachTab(s.port, BASE)
  await sleep(2200)
  await t2.ev(`(()=>{const e=document.querySelector('.top3-check');if(e){e.click();return true}return false})()`)
  await sleep(1600)
  const done1 = await s.ev(`window.__tm.text('.dash-ring-in b')`)
  c('另一窗口改数据后主窗口刷新', done0 !== done1, `${done0} → ${done1}`)
  const t2state = await t2.ev(`JSON.parse(localStorage.getItem('time-master-state-v1')||'{}')`)
  const s1state = await s.st()
  c('两窗口状态一致', t2state.tasks.filter(t => t.status === 'done').length === s1state.tasks.filter(t => t.status === 'done').length)
  t2.close()
  await sleep(300)
})

suite('独立迷你窗口', async (s, c) => {
  const mini = await attachTab(s.port, BASE + '#mini')
  await sleep(2200)
  const info = await mini.ev(`(()=>({
    body: document.body.classList.contains('mini-route'),
    panel: !!document.querySelector('.mini-panel.in-window'),
    clock: !!document.querySelector('.mini-clock'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rows: document.querySelectorAll('.mini-row').length
  }))()`)
  c('hash 路由进入浮窗视图', info && info.body === true)
  c('浮窗组件独立渲染', info && info.panel === true && info.clock === true)
  c('无横向溢出', info && info.overflow <= 1, '溢出 ' + (info ? info.overflow : '?'))
  c('浮窗内列出任务', info && info.rows > 0, '行数 ' + (info ? info.rows : '?'))
  await mini.ev(HELPERS)
  await mini.ev(`document.querySelector('.mini-add').click()`)
  await sleep(150)
  for (const [width, height] of [[304, 430], [260, 320]]) {
    await mini.cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    const fits = await mini.ev(`(()=>{
      const d = document.querySelector('.mini-create-modal');
      const r = d.getBoundingClientRect();
      const f = d.querySelector('.modal-foot').getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && f.bottom <= innerHeight && d.scrollWidth <= d.clientWidth;
    })()`)
    c(`创建表单适配 ${width}×${height} 且保存按钮可见`, fits)
  }
  await mini.ev(`window.__tm.set('.mini-create-modal input', '独立浮窗创建任务')`)
  await mini.ev(`document.querySelector('.mini-create-modal button[type="submit"]').click()`)
  await sleep(500)
  c('独立浮窗直接保存并同步任务', (await s.st()).tasks.some(t => t.title === '独立浮窗创建任务'))
  c('保存后仍停留独立浮窗', await mini.ev(`!!document.querySelector('.mini-panel.in-window') && !document.querySelector('.topbar') && !document.querySelector('.mini-create-modal')`))
  mini.close()
  await sleep(200)
})

suite('帮助手册', async (s, c) => {
  await s.reset()
  await s.nav('使用手册', 900)
  const info = await s.ev(`(()=>{
    const f = document.querySelector('.help-frame');
    if (!f || !f.contentDocument) return null;
    const d = f.contentDocument;
    return { len: d.body.innerText.length, anchors: d.querySelectorAll('a[href^="#"]').length, h2: d.querySelectorAll('h2').length, kbd: d.querySelectorAll('kbd').length };
  })()`)
  c('手册 iframe 加载', !!info && info.len > 2000, info ? info.len + ' 字' : 'null')
  c('目录锚点齐全', !!info && info.anchors >= 10, info ? info.anchors + ' 个' : '?')
  c('章节结构完整', !!info && info.h2 >= 10, info ? info.h2 + ' 个 h2' : '?')
  c('快捷键说明存在', !!info && info.kbd >= 3, info ? info.kbd + ' 个 kbd' : '?')
  const txt = await s.ev(`document.querySelector('.help-frame').contentDocument.body.innerText`)
  c('覆盖任务编辑章节', txt.includes('编辑'))
  c('覆盖浮窗章节', txt.includes('浮窗'))
  c('版本号已更新', txt.includes(PKG_VERSION), PKG_VERSION)
  c('打印按钮可用', await s.ev(`window.__tm.count('.content-inner .btn-primary') >= 1`))
})

suite('设置与数据管理', async (s, c) => {
  await s.reset()
  await s.nav('设置中心')
  await s.ev(`window.__tm.set('.content-inner input.input','压测用户')`)
  await s.ev(`window.__tm.click('.content-inner form .btn-primary','保存')`)
  await sleep(360)
  let st = await s.st()
  c('修改昵称已保存', st.profile.name === '压测用户', st.profile.name)
  c('出现已保存提示', (await s.ev(`window.__tm.body()`)).includes('已保存'))
  c('顶栏头像同步', (await s.ev(`window.__tm.text('.top-avatar')`)) === '压')

  await s.ev(`window.__tm.click('.tab-pill','8 小时')`)
  await sleep(320)
  c('设置专注目标 8 小时', (await s.st()).focus.goalHours === 8)

  await s.ev(`window.__tm.click('.btn-primary','导出数据备份')`)
  await sleep(600)
  c('导出备份有反馈', (await s.ev(`window.__tm.body()`)).includes('已导出'))

  await s.ev(`window.__tm.click('.btn-ghost','重置全部数据')`)
  await sleep(320)
  c('重置弹出应用内确认框', await s.ev(`[...document.querySelectorAll('.modal')].some(m => (m.textContent || '').includes('此操作不可恢复'))`))
  await s.ev(`window.__tm.click('.modal-foot .btn-danger','重置')`)
  await sleep(420)
  st = await s.st()
  c('重置恢复演示数据', st.tasks.length === 8 && st.profile.name === 'Kevin', `${st.tasks.length} 任务 / ${st.profile.name}`)
  c('重置确认框自动关闭', !(await s.ev(`!!document.querySelector('.modal')`)))

  // 取消重置：数据不动、弹窗关闭
  await s.ev(`window.__tm.set('.content-inner input.input','临时昵称')`)
  await s.ev(`window.__tm.click('.content-inner form .btn-primary','保存')`)
  await sleep(320)
  await s.ev(`window.__tm.click('.btn-ghost','重置全部数据')`)
  await sleep(320)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(320)
  st = await s.st()
  c('取消重置不生效', st.profile.name === '临时昵称' && !(await s.ev(`!!document.querySelector('.modal')`)), st.profile.name)
})

suite('数据导入', async (s, c) => {
  await s.reset()
  await s.nav('设置中心')
  const file = path.join(os.tmpdir(), `tm-import-${Date.now()}.json`)
  fs.writeFileSync(file, JSON.stringify({
    profile: { name: '导入测试', goal: '导入的目标' },
    inbox: [],
    tasks: [
      { id: 'x1', title: '导入任务 A', status: 'todo', quadrant: 'Q2', progress: 0, note: '' },
      { id: 'x2', title: '导入任务 B', status: 'done', quadrant: 'Q1', progress: 100, note: '' },
    ],
    blocks: [], focus: { goalHours: 5, sessions: [] }, reviews: {}, projects: [], goals: [],
    habits: [], knowledge: [], experience: [], workResults: [],
  }))
  await s.cmd('DOM.enable')
  const doc = await s.cmd('DOM.getDocument', { depth: -1 })
  const q = await s.cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
  c('找到导入文件控件', !!q.result.nodeId, String(q.result.nodeId))
  await s.cmd('DOM.setFileInputFiles', { files: [file], nodeId: q.result.nodeId })
  await sleep(1000)
  const st = await s.st()
  c('导入覆盖数据', st.profile.name === '导入测试', st.profile.name)
  c('导入任务条数正确', st.tasks.length === 2, String(st.tasks.length))
  c('导入后目标小时生效', st.focus.goalHours === 5, String(st.focus.goalHours))
  c('导入有成功提示', (await s.ev(`window.__tm.body()`)).includes('导入成功'))
  try { fs.unlinkSync(file) } catch {}
})

suite('持久化', async (s, c) => {
  await s.reset()
  await s.nav('习惯打卡')
  const idx = (await s.st()).habits.findIndex(h => !h.done)
  await s.ev(`document.querySelectorAll('.content-inner .habit-check')[${idx}].click()`)
  await sleep(360)
  const before = await s.st()
  await s.reload()
  const after = await s.st()
  c('刷新后习惯打卡保留', after.habits[idx].done === true)
  c('刷新后任务数一致', after.tasks.length === before.tasks.length)
  await s.nav('首页驾驶舱')
  c('刷新后驾驶舱正常渲染', (await s.ev(`window.__tm.body()`)).length > 200)
})

suite('空数据边界', async (s, c) => {
  const empty = {
    profile: { name: '空数据', goal: '空状态测试' },
    settings: { weekStart: 1, autoStart: false, compact: false },
    inbox: [], tasks: [], blocks: [],
    focus: { goalHours: 4, sessions: [] },
    timer: { presetMin: 25, task: '深度专注', running: false, endsAt: null, remaining: 1500, completedAt: null },
    reviews: {}, projects: [], goals: [], habits: [], knowledge: [], experience: [], workResults: [],
    achievements: {}, reminders: [],
  }
  await s.ev(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(empty))})`)
  await s.reload()
  for (const [label, want] of PAGES) {
    await s.nav(label, 260)
    const t = await s.ev(`window.__tm.title()`)
    const len = await s.ev(`window.__tm.body().length`)
    c(`空数据仍可用：${label}`, t === want && len > 15, `「${t}」${len}`)
  }
  await s.nav('首页驾驶舱', 320)
  const body = await s.ev(`window.__tm.body()`)
  c('空数据驾驶舱显示 0', body.includes('已完成 0 / 0'))
  c('空数据提示引导文案', body.includes('还没有标记今日要事'))
  await s.nav('收件箱')
  await s.ev(`window.__tm.set('.content-inner input.input','空数据下捕捉')`)
  await s.ev(`window.__tm.click('.content-inner .btn-primary','捕捉')`)
  await sleep(360)
  c('空数据下仍可捕捉', (await s.st()).inbox.length === 1)
})

suite('异常与旧版数据', async (s, c) => {
  await s.ev(`localStorage.setItem(${JSON.stringify(KEY)}, '{这不是合法JSON')`)
  await s.reload()
  const st = await s.st()
  c('损坏数据自动回落演示数据', st.tasks && st.tasks.length === 8, st.tasks ? st.tasks.length + ' 条' : 'null')
  c('损坏数据不白屏', (await s.ev(`window.__tm.body()`)).length > 100)

  const legacy = {
    profile: { name: '旧版用户' },
    inbox: [{ id: 'i9', title: '旧收件', createdAt: Date.now() }],
    tasks: [{ id: 'lt1', title: '旧版任务', status: 'todo', quadrant: 'Q1' }],
    blocks: [{ id: 'lb1', start: '09:00', end: '10:00', title: '旧时间块', status: 'todo' }],
    focus: { goalHours: 3, sessions: [] },
    habits: [{ id: 'lh1', name: '旧习惯', done: false }],
    projects: [], goals: [], knowledge: [], experience: [], workResults: [], reviews: {},
  }
  await s.ev(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(legacy))})`)
  await s.reload()
  const l = await s.st()
  c('旧任务自动补 note 字段', l.tasks[0].note === '', JSON.stringify(l.tasks[0].note))
  c('旧习惯自动补 history', Array.isArray(l.habits[0].history), JSON.stringify(l.habits[0].history))
  c('旧习惯自动补 freq', l.habits[0].freq === '每日', l.habits[0].freq)
  c('缺失 timer 自动补默认值', !!l.timer && l.timer.presetMin === 25)
  c('旧版昵称保留', l.profile.name === '旧版用户')
  await s.nav('习惯打卡')
  c('旧数据习惯页可用', (await s.ev(`window.__tm.body()`)).includes('旧习惯'))
})

suite('窄窗口适配', async (s, c) => {
  await s.reset()
  for (const [w, h] of [[1080, 720], [1280, 800], [1366, 768], [1600, 900]]) {
    await s.cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
    await sleep(320)
    const m = await s.ev(`({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebar: !!document.querySelector('.sidebar'),
      mainW: document.querySelector('.main') ? document.querySelector('.main').getBoundingClientRect().width : 0
    })`)
    c(`${w}×${h} 无横向滚动`, m.over <= 1, '溢出 ' + m.over)
    c(`${w}×${h} 主区可见`, m.sidebar === true && m.mainW > 400, '主区 ' + Math.round(m.mainW))
  }
  await s.cmd('Emulation.clearDeviceMetricsOverride')
  await sleep(200)
})

suite('高频操作压力', async (s, c) => {
  await s.reset()
  const labels = PAGES.map(p => p[0])
  for (let i = 0; i < 64; i++) {
    await s.ev(`window.__tm.nav(${JSON.stringify(labels[i % labels.length])})`)
    await sleep(55)
  }
  await sleep(600)
  c('连续 64 次切页无崩溃', (await s.ev(`window.__tm.body().length`)) > 30)
  c('切页后标题有效', (await s.ev(`window.__tm.title()`)).length > 1)
  await s.nav('首页驾驶舱', 400)
  c('压力测试后驾驶舱正常', (await s.ev(`window.__tm.body()`)).includes('今日完成度'))
})

suite('严苛边界', async (s, c) => {
  await s.reset()

  // 1) 计时器跨刷新（等价于关掉应用再打开）
  await s.nav('专注计时')
  await s.ev(`window.__tm.click('.tab-pill','25 分')`)
  await sleep(200)
  await s.ev(`window.__tm.click('.btn-primary','开始专注')`)
  await sleep(900)
  const t0 = await s.st()
  await s.reload()
  const t1 = await s.st()
  c('刷新后计时器仍运行', t1.timer.running === true, String(t1.timer.running))
  c('刷新后结束时间未漂移', t1.timer.endsAt === t0.timer.endsAt)
  await s.nav('专注计时', 420)
  const ck1 = await s.ev(`window.__tm.clock()`)
  await sleep(1700)
  const ck2 = await s.ev(`window.__tm.clock()`)
  c('刷新后倒计时继续走', ck1 !== ck2, `${ck1} → ${ck2}`)
  await s.ev(`window.__tm.click('.btn-primary','暂停')`)
  await sleep(300)

  // 2) 编辑弹窗用「取消」按钮关闭（Esc 不再关闭）
  await s.nav('任务管理')
  await s.ev(`(() => { const row = [...document.querySelectorAll('.task-row')].find(r => (r.textContent || '').includes('完成最重要的核心项目任务')); if (!row) return false; row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true })()`)
  await sleep(280)
  c('双击行打开编辑弹窗', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  await sleep(300)
  c('拖拽弹窗不受 Esc 关闭', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(300)
  c('自定义「取消」关闭编辑弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))

  // 3) 任务清空 → 驾驶舱归零
  await s.ev(`(()=>{const s=JSON.parse(localStorage.getItem('time-master-state-v1'));s.tasks=[];localStorage.setItem('time-master-state-v1',JSON.stringify(s));return true})()`)
  await s.reload()
  await s.nav('首页驾驶舱', 340)
  const dz = await s.ev(`window.__tm.body()`)
  c('任务清空后完成度 0%', dz.includes('已完成 0 / 0'))
  c('进度环不出现 NaN', !dz.includes('NaN'))

  // 4) 特殊字符不会被当成 HTML 执行
  await s.nav('任务管理')
  await s.ev(`window.__tm.click('.btn-primary','新建任务')`)
  await sleep(260)
  const evil = '<img src=x onerror="window.__xss=1">注入测试'
  await s.ev(`window.__tm.set('.modal input.input', ${JSON.stringify(evil)})`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(520)
  c('恶意标题未被当作 HTML 执行', (await s.ev(`window.__xss === undefined`)) === true)
  c('特殊字符按纯文本渲染', (await s.ev(`document.querySelector('.content-inner .panel .top3-title')?.textContent||''`)).includes('onerror'))

  // 5) 超长标题不撑破布局
  await s.ev(`window.__tm.click('.btn-primary','新建任务')`)
  await sleep(240)
  const longTitle = '超长标题压测' + 'A'.repeat(180)
  await s.ev(`window.__tm.set('.modal input.input', ${JSON.stringify(longTitle)})`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(420)
  const over = await s.ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`)
  c('超长标题无横向溢出', over <= 1, '溢出 ' + over)

  // 6) 多日连续打卡 → streak
  await s.ev(`(()=>{
    const p = n => String(n).padStart(2,'0');
    const k = d => d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
    const st = JSON.parse(localStorage.getItem('time-master-state-v1'));
    const days = [0,1,2].map(i => { const d = new Date(); d.setDate(d.getDate()-i); return k(d) });
    st.habits[0].history = days; st.habits[0].done = true;
    localStorage.setItem('time-master-state-v1', JSON.stringify(st));
    return true
  })()`)
  await s.reload()
  await s.nav('习惯打卡')
  const rowTxt = await s.ev(`(()=>{
    const row = [...document.querySelectorAll('.content-inner .panel > div')].find(x => x.textContent.includes('阅读 30min'));
    return row ? row.textContent : ''
  })()`)
  c('连续三日打卡显示 3 天', /3\s*天/.test(rowTxt), rowTxt.slice(0, 50))

  // 7) 目标进度不超过目标值
  await s.ev(`(()=>{
    const st = JSON.parse(localStorage.getItem('time-master-state-v1'));
    st.goals = [{ id:'gg', title:'夹紧测试', cat:'事业', target:10, current:9, unit:'%', deadline:'' }];
    localStorage.setItem('time-master-state-v1', JSON.stringify(st));
    return true
  })()`)
  await s.reload()
  await s.nav('目标管理')
  await s.ev(`document.querySelectorAll('.content-inner .panel .btn-ghost')[1].click()`)
  await sleep(300)
  await s.ev(`document.querySelectorAll('.content-inner .panel .btn-ghost')[1].click()`)
  await sleep(300)
  const g = (await s.st()).goals[0]
  c('目标进度封顶不越界', g.current <= g.target, `${g.current}/${g.target}`)

  // 8) 项目到 100% 计入已完成
  await s.ev(`(()=>{
    const st = JSON.parse(localStorage.getItem('time-master-state-v1'));
    st.projects = [{ id:'pp', name:'收尾项目', desc:'', progress:100, color:'#7170FF', deadline:'', createdAt:1 }];
    localStorage.setItem('time-master-state-v1', JSON.stringify(st));
    return true
  })()`)
  await s.reload()
  await s.nav('项目管理')
  const doneNum = await s.ev(`window.__tm.text('.stat-strip .stat:nth-child(2) .stat-num')`)
  const doingNum = await s.ev(`window.__tm.text('.stat-strip .stat:nth-child(3) .stat-num')`)
  c('100% 项目计入已完成', doneNum === '1' && doingNum === '0', `已完成 ${doneNum} / 进行中 ${doingNum}`)

  // 9) 命令面板再次 Ctrl+K 关闭
  await s.ev(`window.__tm.ctrlK()`)
  await sleep(300)
  const open1 = await s.ev(`!!document.querySelector('.palette')`)
  await s.ev(`window.__tm.ctrlK()`)
  await sleep(300)
  const open2 = await s.ev(`!!document.querySelector('.palette')`)
  c('Ctrl+K 可开可关', open1 === true && open2 === false, `${open1} → ${open2}`)
})

suite('UI 组件与响应式', async (s, c) => {
  await s.cmd('Page.bringToFront')
  await s.reset()
  await s.nav('任务管理')
  const h0 = await s.ev(`document.querySelector('.content-inner').scrollHeight`)

  // 1) 新增记录走弹窗，不挤压页面
  await s.ev(`window.__tm.click('.btn-primary','新建任务')`)
  await sleep(320)
  c('新建任务以弹窗打开', await s.ev(`!!document.querySelector('.modal')`))
  c('打开弹窗不改变页面高度', (await s.ev(`document.querySelector('.content-inner').scrollHeight`)) === h0)
  c('弹窗标题正确', await s.ev(`(document.querySelector('.modal-head h3')?.textContent || '').includes('新建任务')`))
  c('弹窗内自动聚焦', await s.ev(`!!(document.activeElement && document.activeElement.closest('.modal'))`))
  c('弹窗内容区可滚动', await s.ev(`getComputedStyle(document.querySelector('.modal-body')).overflowY !== 'visible'`))

  // 2) 弹窗关闭方式：自定义「取消」按钮；Esc / 遮罩不再关闭
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  await sleep(260)
  c('Esc 不再关闭弹窗', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`document.querySelector('.modal-mask').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await sleep(260)
  c('点击遮罩不再关闭弹窗', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(280)
  c('自定义「取消」按钮关闭弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))

  await s.ev(`window.__tm.click('.btn-primary','新建任务')`)
  await sleep(280)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(260)
  c('再次验证取消可关', !(await s.ev(`!!document.querySelector('.modal')`)))

  // 3) 设计令牌落地
  const tokens = await s.ev(`(()=>{
    const probe = document.createElement('input');
    probe.className = 'input';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const btn = getComputedStyle(document.querySelector('.btn-primary'));
    const card = getComputedStyle(document.querySelector('.panel'));
    const input = getComputedStyle(probe);
    const tokenProbe = document.createElement('div');
    tokenProbe.style.boxShadow = 'var(--shadow)';
    document.body.appendChild(tokenProbe);
    const tokenShadow = getComputedStyle(tokenProbe).boxShadow;
    tokenProbe.remove();
    const out = { btnRadius: btn.borderRadius, cardRadius: card.borderRadius, inputRadius: input.borderRadius, shadow: card.boxShadow, tokenShadow, brand: getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim(), font: getComputedStyle(document.body).fontFamily };
    probe.remove();
    return out
  })()`)
  c('按钮圆角统一 9px', tokens.btnRadius === '9px', tokens.btnRadius)
  c('卡片圆角统一 14px', tokens.cardRadius === '14px', tokens.cardRadius)
  c('输入框圆角统一 9px', tokens.inputRadius === '9px', tokens.inputRadius)
  c('卡片阴影来自统一令牌', tokens.shadow !== 'none' && tokens.shadow === tokens.tokenShadow, tokens.shadow.slice(0, 48))
  c('主色来自主题变量', /^#[0-9A-F]{6}$/i.test(tokens.brand), tokens.brand)
  c('字体族统一', /PingFang|Segoe UI|Microsoft YaHei/.test(tokens.font), tokens.font.slice(0, 40))

  // 4) 七个模块的新增入口全部是弹窗
  const flows = [
    ['日程 / 时间块', '新增时间块'],
    ['项目管理', '新建项目'],
    ['目标管理', '新建目标'],
    ['习惯打卡', '新增习惯'],
    ['知识素材库', '收录素材'],
    ['经验素材库', '记录经验'],
    ['工作成果', '添加成果'],
  ]
  for (const [navLabel, btnText] of flows) {
    await s.nav(navLabel, 300)
    await s.ev(`window.__tm.click('.btn-primary', ${JSON.stringify(btnText)})`)
    await sleep(280)
    c(`${btnText}：以弹窗打开`, await s.ev(`!!document.querySelector('.modal')`))
    c(`${btnText}：页面无内联表单`, (await s.ev(`document.querySelectorAll('.content-inner form').length`)) === 0)
    await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
    await sleep(220)
  }

  // 5) 移动端 390px（测试内关闭动画，避免后台标签页暂停过渡导致误判）
  await s.cmd('Page.bringToFront')
  await s.ev(`(()=>{const st=document.createElement('style');st.id='tm-no-anim';st.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(st);return true})()`)
  await s.cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await s.nav('首页驾驶舱', 500)
  const over = await s.ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`)
  c('390px 无横向溢出', over <= 1, '溢出 ' + over)
  c('窄屏出现菜单按钮', await s.ev(`getComputedStyle(document.querySelector('.nav-toggle')).display !== 'none'`))
  c('窄屏隐藏顶部日期', await s.ev(`getComputedStyle(document.querySelector('.topbar .date')).display === 'none'`))

  await s.ev(`document.querySelector('.nav-toggle').click()`)
  await sleep(340)
  const drawer = await s.ev(`(()=>{const r=document.querySelector('.sidebar').getBoundingClientRect();return {left:Math.round(r.left), width:Math.round(r.width), scrim:!!document.querySelector('.nav-scrim')}})()`)
  c('侧栏变为抽屉滑出', drawer.left === 0 && drawer.width > 240 && drawer.scrim === true, JSON.stringify(drawer))
  await s.ev(`(()=>{const e=document.querySelector('.nav-scrim');if(e){e.click();return true}return false})()`)
  let drawerClosed = false
  let drawerState = null
  for (let i = 0; i < 25; i++) {
    await sleep(100)
    drawerState = await s.ev(`(()=>{const a=document.querySelector('.app');const r=document.querySelector('.sidebar').getBoundingClientRect();return {open:a.classList.contains('nav-open'),left:Math.round(r.left)}})()`)
    if (!drawerState.open && drawerState.left < 0) { drawerClosed = true; break }
  }
  c('点击遮罩收起抽屉', drawerClosed, JSON.stringify(drawerState))

  await s.nav('周报 / 月报', 400)
  const reportOver = await s.ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`)
  c('移动端周报图表不撑破页面', reportOver <= 1, '溢出 ' + reportOver)

  await s.nav('任务管理', 340)
  await s.ev(`window.__tm.click('.btn-primary','新建任务')`)
  await sleep(340)
  const sheet = await s.ev(`(()=>{const r=document.querySelector('.modal').getBoundingClientRect();return {w:Math.round(r.width), vw:innerWidth, bottom:Math.round(r.bottom), vh:innerHeight, radius:getComputedStyle(document.querySelector('.modal')).borderTopLeftRadius}})()`)
  c('移动端弹窗为全宽底部抽屉', sheet.w === sheet.vw && Math.abs(sheet.bottom - sheet.vh) <= 1, JSON.stringify(sheet))
  c('移动端弹窗顶部圆角 18px', sheet.radius === '18px', sheet.radius)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(220)
  await s.cmd('Emulation.clearDeviceMetricsOverride')
  await sleep(300)
})

/* ------------------------------- 配色方案 ------------------------------- */

const LUM = `(c) => {
  const m = (c || '').match(/[\\d.]+/g) || [0, 0, 0];
  const v = m.slice(0, 3).map(x => { const n = Number(x) / 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4) });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}`

suite('配色方案', async (s, c) => {
  await s.reset()
  c('默认主题为藏蓝暖阳', await s.ev(`document.documentElement.getAttribute('data-theme')`) === 'dusk')

  await s.nav('设置中心', 420)
  const cards = await s.ev(`window.__tm.count('.theme-card')`)
  c('设置页 5 套配色卡片', cards === 5, '实际 ' + cards)
  const names = await s.ev(`[...document.querySelectorAll('.theme-card .theme-name')].map(e => e.textContent.trim())`)
  c('5 套方案命名齐全', names.length === 5 && names[0] === '藏蓝暖阳' && names[4] === '石墨暗夜', names.join(' / '))
  c('每张卡片带预览缩略图', await s.ev(`window.__tm.count('.theme-preview')`) === 5)

  const WANT = [
    ['dusk', '#3B7DF6', 'light'],
    ['sakura', '#E45C8C', 'light'],
    ['mint', '#16A97F', 'light'],
    ['violet', '#7B61E8', 'light'],
    ['midnight', '#6C7BEF', 'dark'],
  ]
  for (const [id, color, mode] of WANT) {
    await s.ev(`(() => { const b = document.querySelector('.theme-card[data-theme-id="${id}"]'); if (!b) return false; b.click(); return true })()`)
    await sleep(260)
    const snap = await s.ev(`(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        attr: document.documentElement.getAttribute('data-theme'),
        mode: document.documentElement.getAttribute('data-mode'),
        brand: cs.getPropertyValue('--brand-500').trim().toUpperCase(),
        nav: getComputedStyle(document.querySelector('.sidebar')).backgroundColor,
        card: getComputedStyle(document.querySelector('.panel')).backgroundColor,
        active: !!document.querySelector('.theme-card.is-active[data-theme-id="${id}"]'),
        activeCount: document.querySelectorAll('.theme-card.is-active').length,
      };
    })()`)
    c(`切换「${id}」写入主题标识`, snap.attr === id && snap.mode === mode, `${snap.attr}/${snap.mode}`)
    c(`切换「${id}」主色变量正确`, snap.brand === color, snap.brand)
    c(`切换「${id}」卡片侧栏同步换色`, !!snap.nav && !!snap.card)
    c(`切换「${id}」选中态唯一`, snap.active && snap.activeCount === 1, String(snap.activeCount))
  }

  // 深色模式可读性
  const dark = await s.ev(`(() => {
    const lum = ${LUM};
    return {
      body: lum(getComputedStyle(document.body).backgroundColor),
      card: lum(getComputedStyle(document.querySelector('.panel')).backgroundColor),
      contrast: (() => {
        const a = lum(getComputedStyle(document.querySelector('.topbar')).backgroundColor);
        const b = lum(getComputedStyle(document.querySelector('.topbar h1')).color);
        const hi = Math.max(a, b), lo = Math.min(a, b);
        return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      })(),
      navContrast: (() => {
        const a = lum(getComputedStyle(document.querySelector('.sidebar')).backgroundColor);
        const b = lum(getComputedStyle(document.querySelector('.nav-item.active')).backgroundColor);
        const hi = Math.max(a, b), lo = Math.min(a, b);
        return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      })(),
    };
  })()`)
  c('深色模式页面与卡片确实变暗', dark.body < 0.1 && dark.card < 0.1, JSON.stringify(dark))
  c('深色模式标题对比度 ≥ 4.5', dark.contrast >= 4.5, '比值 ' + dark.contrast)
  c('深色模式侧栏选中项可分辨', dark.navContrast >= 1.2, '比值 ' + dark.navContrast)

  // 持久化 + 首帧
  c('主题写入本地设置', (await s.st()).settings.theme === 'midnight')
  await s.reload()
  c('刷新后沿用深色方案', await s.ev(`document.documentElement.getAttribute('data-theme')`) === 'midnight')
  c('首帧前已注入配色变量', await s.ev(`!!document.documentElement.style.getPropertyValue('--brand-500')`))

  // 浮窗窗口共用配置
  const mini = await attachTab(s.port, BASE + '?mini=1')
  await sleep(1000)
  const miniTheme = await mini.ev(`document.documentElement.getAttribute('data-theme')`)
  const miniPanel = await mini.ev(`!!document.querySelector('.mini-panel')`)
  c('浮窗窗口沿用同一套配色', miniTheme === 'midnight' && miniPanel, `${miniTheme} / panel=${miniPanel}`)
  mini.close()

  // 顶栏快捷切换
  await s.ev(`document.querySelector('[data-testid="theme-quick"]').click()`)
  await sleep(240)
  c('顶栏调色板弹出方案菜单', await s.ev(`!!document.querySelector('[data-testid="theme-pop"]')`))
  c('菜单列出 5 套方案', await s.ev(`window.__tm.count('.theme-pop-item')`) === 5)
  await s.ev(`(() => { const b = document.querySelector('.theme-pop-item[data-theme-id="sakura"]'); if (!b) return false; b.click(); return true })()`)
  await sleep(300)
  c('快捷菜单切换即时生效', await s.ev(`document.documentElement.getAttribute('data-theme')`) === 'sakura')
  c('选完自动收起菜单', !(await s.ev(`!!document.querySelector('[data-testid="theme-pop"]')`)))

  await s.ev(`document.querySelector('[data-testid="theme-quick"]').click()`)
  await sleep(200)
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await sleep(200)
  c('Esc 收起配色菜单', !(await s.ev(`!!document.querySelector('[data-testid="theme-pop"]')`)))

  // 手册跟随配色
  await s.nav('使用手册', 800)
  const help = await s.ev(`(() => {
    const f = document.querySelector('.help-frame');
    if (!f || !f.contentDocument) return null;
    const lum = ${LUM};
    const body = getComputedStyle(f.contentDocument.body);
    return { bg: body.backgroundColor, ink: body.color, l: lum(body.backgroundColor), ready: !!f.contentDocument.querySelector('#theme') };
  })()`)
  c('内置手册跟随配色（底色非纯白）', !!help && help.bg !== 'rgb(255, 255, 255)', JSON.stringify(help))
  c('手册已含「外观与配色」章节', !!help && help.ready === true)

  // 窄屏：主题卡片单列，且不撑出横向滚动
  await s.nav('设置中心', 400)
  await s.cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await sleep(450)
  const mob = await s.ev(`(() => {
    const cards = [...document.querySelectorAll('.theme-card')];
    const lefts = new Set(cards.map(c => Math.round(c.getBoundingClientRect().left)));
    return { cols: lefts.size, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: Math.round(cards[0].getBoundingClientRect().width) };
  })()`)
  c('窄屏主题卡片单列排布', mob.cols === 1, JSON.stringify(mob))
  c('窄屏不出现横向滚动', mob.overflow <= 1, '溢出 ' + mob.overflow)
  await s.cmd('Emulation.clearDeviceMetricsOverride')
  await sleep(300)

  // 收尾：回到默认主题，避免影响后续断言
  await s.ev(`(() => { const b = document.querySelector('.theme-card[data-theme-id="dusk"]'); if (b) { b.click(); return true } return false })()`)
  if (!(await s.ev(`document.documentElement.getAttribute('data-theme') === 'dusk'`))) {
    await s.ev(`document.querySelector('[data-testid="theme-quick"]').click()`)
    await sleep(200)
    await s.ev(`(() => { const b = document.querySelector('.theme-pop-item[data-theme-id="dusk"]'); if (b) { b.click(); return true } return false })()`)
  }
  await sleep(200)
  c('可切回默认主题', await s.ev(`document.documentElement.getAttribute('data-theme')`) === 'dusk')
})

/* ------------------------------- 交互优化（弹窗取消 + 任务编辑入口） ------------------------------- */

const ROW = `(title) => [...document.querySelectorAll('.task-row')].find(r => (r.textContent || '').includes(title))`
const DBL = `(title) => { const row = (${ROW})(title); if (!row) return false; row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true }`

suite('交互优化', async (s, c) => {
  await s.reset()
  await s.nav('任务管理', 420)

  // ---------- 一、任务编辑入口 ----------
  c('列表不再显示独立编辑按钮', !(await s.ev(`!!document.querySelector('[title="编辑任务"]')`)))
  c('列表保留删除按钮', (await s.ev(`window.__tm.count('[title="删除任务"]')`)) >= 8)

  // 1) 单击任务标记（圆点）→ 切换完成状态（与驾驶舱、计时浮窗同一语义）
  await s.ev(`(() => { const row = (${ROW})('完成最重要的核心项目任务'); const c = row && row.querySelector('.task-check'); if (!c) return false; c.click(); return true })()`)
  await sleep(300)
  c('单击圆点标记完成', (await s.st()).tasks.find(t => t.title === '完成最重要的核心项目任务')?.status === 'done')
  c('单击圆点不打开编辑弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))
  await s.ev(`(() => { const row = (${ROW})('完成最重要的核心项目任务'); const c = row && row.querySelector('.task-check'); if (!c) return false; c.click(); return true })()`)
  await sleep(300)
  const backSt = (await s.st()).tasks.find(t => t.title === '完成最重要的核心项目任务')
  c('再次单击圆点取消完成', backSt?.status === 'todo' && backSt?.progress === 0, `${backSt?.status}/${backSt?.progress}`)

  // 2) 单击任务行 → 编辑弹窗（主入口）
  await s.ev(`(() => { const row = (${ROW})('完成最重要的核心项目任务'); if (!row) return false; row.click(); return true })()`)
  await sleep(320)
  c('单击任务行打开编辑弹窗', await s.ev(`!!document.querySelector('.modal')`))
  c('编辑弹窗标题正确', await s.ev(`(document.querySelector('.modal-head h3')?.textContent || '').includes('编辑任务')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(280)
  c('取消关闭编辑弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))

  // 3) 点状态标签 → 循环切换状态（与时间块页一致）
  await s.ev(`(() => { const row = (${ROW})('完成最重要的核心项目任务'); const p = row && row.querySelector('.top3-meta button.pill'); if (!p) return false; p.click(); return true })()`)
  await sleep(340)
  c('点状态标签切到进行中', (await s.st()).tasks.find(t => t.title === '完成最重要的核心项目任务')?.status === 'doing')
  c('点状态标签不开编辑弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))

  // 2) 双击任务名称 → 编辑（备用入口）
  await s.ev(`(${DBL})('完成最重要的核心项目任务')`)
  await sleep(300)
  c('双击任务名称打开编辑', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.set('.modal input.input','双击改名')`)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(360)
  c('双击入口保存生效', (await s.st()).tasks.some(t => t.title === '双击改名'))

  // 4) 右键菜单：打开、编辑、复制、删除、Esc 关闭
  await s.ev(`(() => { const row = (${ROW})('处理并推进关键事项'); if (!row) return false; row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 420, clientY: 420 })); return true })()`)
  await sleep(240)
  c('右键弹出任务菜单', await s.ev(`!!document.querySelector('[data-testid="task-menu"]')`))
  c('菜单含编辑/标记/复制/删除四项', (await s.ev(`window.__tm.count('.task-menu-item')`)) === 4)
  c('菜单保留标题栏', await s.ev(`!!document.querySelector('.task-menu-title')`))

  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  await sleep(200)
  c('Esc 关闭右键菜单', !(await s.ev(`!!document.querySelector('[data-testid="task-menu"]')`)))

  // 菜单编辑
  await s.ev(`(() => { const row = (${ROW})('处理并推进关键事项'); if (!row) return false; row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 420, clientY: 420 })); return true })()`)
  await sleep(200)
  await s.ev(`(() => { const b = [...document.querySelectorAll('.task-menu-item')].find(x => (x.textContent || '').includes('编辑')); if (b) { b.click(); return true } return false })()`)
  await sleep(300)
  c('菜单「编辑」打开弹窗', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(260)

  // 菜单「标记为已完成」
  await s.ev(`(() => { const row = (${ROW})('处理并推进关键事项'); if (!row) return false; row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 420, clientY: 420 })); return true })()`)
  await sleep(200)
  await s.ev(`(() => { const b = [...document.querySelectorAll('.task-menu-item')].find(x => (x.textContent || '').includes('标记为已完成')); if (b) { b.click(); return true } return false })()`)
  await sleep(300)
  c('菜单可标记已完成', (await s.st()).tasks.find(t => t.title === '处理并推进关键事项')?.status === 'done')

  // 菜单复制
  const before = (await s.st()).tasks.length
  await s.ev(`(() => { const row = (${ROW})('今日复盘 / 明日规划'); if (!row) return false; row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 420, clientY: 420 })); return true })()`)
  await sleep(200)
  await s.ev(`(() => { const b = [...document.querySelectorAll('.task-menu-item')].find(x => (x.textContent || '').includes('复制')); if (b) { b.click(); return true } return false })()`)
  await sleep(300)
  c('菜单「复制」新增一条', (await s.st()).tasks.length === before + 1)

  // 菜单删除
  await s.ev(`(() => { const row = (${ROW})('会议 / 协作沟通'); if (!row) return false; row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 420, clientY: 420 })); return true })()`)
  await sleep(200)
  await s.ev(`(() => { const b = [...document.querySelectorAll('.task-menu-item')].find(x => (x.textContent || '').includes('删除')); if (b) { b.click(); return true } return false })()`)
  await sleep(300)
  c('菜单「删除」直接移除', !(await s.st()).tasks.some(t => t.title === '会议 / 协作沟通'))
  c('菜单删除后无残留弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))

  // 四象限视图同样不出现编辑按钮
  await s.nav('优先级 / 四象限', 360)
  c('矩阵视图无独立编辑按钮', !(await s.ev(`!!document.querySelector('[title="编辑任务"]')`)))
  await s.ev(`(() => { const row = [...document.querySelectorAll('.task-row')][0]; if (!row) return false; row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true })()`)
  await sleep(300)
  c('矩阵视图双击行打开编辑', await s.ev(`!!document.querySelector('.modal')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(240)

  // ---------- 二、今日要事名额上限 3 条 ----------
  await s.nav('任务管理', 360)
  await s.ev(`(${DBL})('今日复盘 / 明日规划')`)
  await sleep(340)
  c('未满时可勾选今日要事', (await s.ev(`document.querySelector('.modal input[type=checkbox]').disabled`)) === false)
  c('提示显示已选数量', await s.ev(`(document.querySelector('.modal input[type=checkbox]').closest('label').textContent || '').includes('/3')`))
  await s.ev(`document.querySelector('.modal input[type=checkbox]').click()`)
  await sleep(220)
  await s.ev(`window.__tm.click('.modal-foot .btn-primary','保存')`)
  await sleep(380)
  const topN = (await s.st()).tasks.filter(t => t.todayTop && t.status !== 'done').length
  c('标记后今日要事满 3 条', topN === 3, String(topN))

  await s.ev(`(${DBL})('更新知识素材库')`)
  await sleep(340)
  c('满额后勾选框被禁用', (await s.ev(`document.querySelector('.modal input[type=checkbox]').disabled`)) === true)
  c('满额提示可读', await s.ev(`(document.querySelector('.modal input[type=checkbox]').closest('label').textContent || '').includes('已满 3 条')`))
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(280)

  // ---------- 三、行内删除二次确认 ----------
  const beforeDel = (await s.st()).tasks.length
  await s.ev(`(() => { const row = (${ROW})('晨间规划 / 收件箱清理'); const b = row && row.querySelector('[title="删除任务"]'); if (!b) return false; b.click(); return true })()`)
  await sleep(340)
  c('行内删除先弹确认框', await s.ev(`[...document.querySelectorAll('.modal')].some(m => (m.textContent || '').includes('此操作不可恢复'))`))
  c('确认框不误开编辑弹窗', (await s.ev(`document.querySelectorAll('.modal').length`)) === 1)
  c('确认前任务未删除', (await s.st()).tasks.length === beforeDel)
  await s.ev(`(() => { const m = [...document.querySelectorAll('.modal')].pop(); const b = [...m.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '取消'); if (b) { b.click(); return true } return false })()`)
  await sleep(320)
  c('取消后任务保留', (await s.st()).tasks.length === beforeDel && !(await s.ev(`!!document.querySelector('.modal')`)))
  await s.ev(`(() => { const row = (${ROW})('晨间规划 / 收件箱清理'); const b = row && row.querySelector('[title="删除任务"]'); if (!b) return false; b.click(); return true })()`)
  await sleep(320)
  await s.ev(`(() => { const m = [...document.querySelectorAll('.modal')].pop(); const b = [...m.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '删除'); if (b) { b.click(); return true } return false })()`)
  await sleep(380)
  c('确认后任务被删除', (await s.st()).tasks.length === beforeDel - 1, `${beforeDel} → ${(await s.st()).tasks.length}`)
  c('删除后无残留弹窗', !(await s.ev(`!!document.querySelector('.modal')`)))

  // ---------- 四、原生弹窗取消方式 ----------
  // 2.1 任务删除确认框：无 Esc/遮罩/右上角关闭，只能点自定义「取消」「删除」
  await s.nav('任务管理', 360)
  await s.ev(`(${DBL})('完成今日计划内的输出/交付')`)
  await sleep(280)
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','删除')`)
  await sleep(320)
  c('删除确认弹出（应用内）', await s.ev(`[...document.querySelectorAll('.modal')].some(m => (m.textContent || '').includes('此操作不可恢复'))`))
  c('确认框无右上角 X', !(await s.ev(`(() => { const m = [...document.querySelectorAll('.modal')].find(x => (x.textContent || '').includes('此操作不可恢复')); return m && m.querySelector('.ui-icon-btn') })()`)))
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  await sleep(260)
  c('确认框不受 Esc 关闭', (await s.ev(`document.querySelectorAll('.modal').length`)) === 2)
  await s.ev(`document.querySelector('.modal-mask').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await sleep(260)
  c('确认框不受遮罩关闭', (await s.ev(`document.querySelectorAll('.modal').length`)) === 2)

  // 自定义「取消」按钮关掉确认框，编辑弹窗保留
  await s.ev(`(() => { const ms = [...document.querySelectorAll('.modal')]; const last = ms[ms.length - 1]; const b = [...last.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '取消'); if (b) { b.click(); return true } return false })()`)
  await sleep(280)
  c('确认框「取消」按钮仅收起确认框', (await s.ev(`document.querySelectorAll('.modal').length`)) === 1)

  // 2.2 重置数据确认：取消后数据保留
  await s.nav('设置中心', 380)
  await s.ev(`window.__tm.click('.btn-ghost','重置全部数据')`)
  await sleep(300)
  c('重置弹应用内确认框', await s.ev(`!!document.querySelector('.modal')`))
  const tasksBeforeCancel = (await s.st()).tasks.length
  await s.ev(`window.__tm.click('.modal-foot .btn-ghost','取消')`)
  await sleep(300)
  const stAfterCancel = await s.st()
  c('重置「取消」后数据不变', stAfterCancel.tasks.length === tasksBeforeCancel && !(await s.ev(`!!document.querySelector('.modal')`)))
  c('设置页仍有自定义「重置」按钮', await s.ev(`window.__tm.count('.btn-ghost') >= 1`))

  // 收尾：切回默认主题（配色套件后的兜底）
  if (!(await s.ev(`document.documentElement.getAttribute('data-theme') === 'dusk'`))) {
    await s.ev(`(() => { const b = document.querySelector('.theme-card[data-theme-id="dusk"]'); if (b) { b.click(); return true } return false })()`)
    await sleep(200)
  }
})

/* --------------------------- 搜索 / 筛选 / 排序 --------------------------- */

suite('搜索筛选排序', async (s, c) => {
  await s.cmd('Page.bringToFront')
  await s.reset()
  await s.nav('任务管理', 420)

  const rows = () => s.ev(`window.__tm.count('.task-row')`)
  const titles = () => s.ev(`[...document.querySelectorAll('.task-row')].map(r => ((r.querySelector('.top3-title') || r.querySelector('span.truncate') || {}).textContent || '').trim())`)
  const SET = (sel, v) => s.ev(`window.__tm.set(${JSON.stringify(sel)}, ${JSON.stringify(v)})`)
  const CLICK = (sel, t) => s.ev(`window.__tm.click(${JSON.stringify(sel)}, ${JSON.stringify(t)})`)
  const CNT = () => s.ev(`window.__tm.text('[data-testid=task-count]')`)

  // 0) 默认状态：多了一排筛选控件，但不能改变原有列表内容
  c('筛选工具条已渲染', await s.ev(`!!document.querySelector('[data-testid=task-filter]')`))
  c('默认显示全部 8 条', (await rows()) === 8, String(await rows()))
  c('默认计数为「共 8 项」', (await CNT()) === '共 8 项', await CNT())
  c('默认不出现清空入口', !(await s.ev(`!!document.querySelector('[data-testid=task-clear]')`)))

  // 1) 按标题搜索
  await SET('[data-testid=task-search]', '核心项目')
  await sleep(320)
  c('标题搜索命中 1 条', (await rows()) === 1, JSON.stringify(await titles()))
  c('标题搜索命中正确任务', (await titles())[0] === '完成最重要的核心项目任务')
  c('计数显示筛选比例', (await CNT()) === '筛选出 1 / 8 项', await CNT())

  // 2) × 清空搜索
  await CLICK('[aria-label="清空搜索"]')
  await sleep(300)
  c('点 × 清空搜索恢复全部', (await rows()) === 8, String(await rows()))

  // 3) 备注也参与搜索（种子任务无备注，先写一条）
  await s.ev(`(()=>{const st=JSON.parse(localStorage.getItem('time-master-state-v1'));st.tasks.find(t=>t.id==='t8').note='参考外部资料整理';localStorage.setItem('time-master-state-v1',JSON.stringify(st));return true})()`)
  await s.reload()
  await s.nav('任务管理', 420)
  await SET('[data-testid=task-search]', '外部资料')
  await sleep(320)
  c('备注也能被搜到', (await rows()) === 1 && (await titles())[0] === '更新知识素材库', JSON.stringify(await titles()))
  await CLICK('[aria-label="清空搜索"]')
  await sleep(300)

  // 4) 象限筛选
  await SET('[data-testid=task-quad]', 'Q1')
  await sleep(320)
  c('Q1 筛出 2 条', (await rows()) === 2, String(await rows()))
  await SET('[data-testid=task-quad]', 'Q4')
  await sleep(320)
  c('Q4 筛出 1 条且正确', (await rows()) === 1 && (await titles())[0] === '更新知识素材库', JSON.stringify(await titles()))
  await SET('[data-testid=task-quad]', 'all')
  await sleep(280)

  // 5) 状态筛选（文案与视图切换的 tab-pill 不冲突）
  await CLICK('.tab-pill', '待开始')
  await sleep(340)
  c('待开始筛出 4 条', (await rows()) === 4, String(await rows()))
  await CLICK('.tab-pill', '已完成')
  await sleep(340)
  c('已完成筛出 2 条', (await rows()) === 2, String(await rows()))

  // 6) 组合条件：已完成 ∩ Q1
  await SET('[data-testid=task-quad]', 'Q1')
  await sleep(320)
  c('已完成 ∩ Q1 仅 1 条', (await rows()) === 1, String(await rows()))
  c('组合筛选结果正确', (await titles())[0] === '深度专注：核心任务 B', JSON.stringify(await titles()))

  // 7) 一键清空
  await CLICK('[data-testid=task-clear]')
  await sleep(340)
  c('清空筛选恢复全部', (await rows()) === 8 && !(await s.ev(`!!document.querySelector('[data-testid=task-clear]')`)), String(await rows()))

  // 8) 排序：计划时间 + 方向切换
  await SET('[data-testid=task-sort]', 'time')
  await sleep(340)
  const byTime = await titles()
  c('按计划时间升序：08:00 在最前', byTime[0] === '晨间规划 / 收件箱清理', byTime[0])
  c('按计划时间升序：20:00 在最后', byTime[byTime.length - 1] === '更新知识素材库', byTime[byTime.length - 1])
  await s.ev(`document.querySelector('[data-testid=task-dir]').click()`)
  await sleep(340)
  const descOrder = await titles()
  c('方向按钮切为降序', descOrder[0] === '更新知识素材库', descOrder[0])
  c('降序后顺序整体反转', descOrder[descOrder.length - 1] === '晨间规划 / 收件箱清理', descOrder[descOrder.length - 1])
  await s.ev(`document.querySelector('[data-testid=task-dir]').click()`)
  await sleep(300)

  // 9) 排序：优先级（Q1 → Q4）
  await SET('[data-testid=task-sort]', 'priority')
  await sleep(340)
  const byQuad = await titles()
  c('按优先级：Q1 在最前', byQuad[0] === '完成最重要的核心项目任务', byQuad[0])
  c('按优先级：Q4 在最后', byQuad[byQuad.length - 1] === '更新知识素材库', byQuad[byQuad.length - 1])

  // 10) 排序：创建时间不丢数据
  await SET('[data-testid=task-sort]', 'created')
  await sleep(320)
  c('按创建时间排序不丢任务', (await rows()) === 8, String(await rows()))
  await SET('[data-testid=task-sort]', 'manual')
  await sleep(280)

  // 11) 无匹配时的空状态
  await SET('[data-testid=task-search]', '不存在的关键词zzz')
  await sleep(340)
  c('无匹配显示空状态', await s.ev(`!!document.querySelector('.empty') && document.querySelector('.empty').textContent.includes('没有符合条件')`))
  c('无匹配计数为 0', (await CNT()) === '筛选出 0 / 8 项', await CNT())
  c('无匹配不渲染任务行', (await rows()) === 0)

  // 12) 四象限视图共用同一套筛选
  await CLICK('.tab-pill', '四象限')
  await sleep(400)
  c('四象限也显示筛选工具条', await s.ev(`!!document.querySelector('[data-testid=task-filter]')`))
  c('四象限空态提示为「暂无匹配」', await s.ev(`!!document.querySelector('.quad-grid') && document.querySelector('.quad-grid').innerText.includes('暂无匹配')`))
  await CLICK('[aria-label="清空搜索"]')
  await sleep(400)
  c('四象限默认只看未完成 6 条', (await rows()) === 6, String(await rows()))
  await SET('[data-testid=task-quad]', 'Q1')
  await sleep(340)
  c('四象限按象限收窄', (await rows()) === 1, String(await rows()))
  await SET('[data-testid=task-quad]', 'all')
  await sleep(300)
  await CLICK('.tab-pill', '已完成')
  await sleep(400)
  c('四象限选「已完成」显示 2 条', (await rows()) === 2, String(await rows()))
  c('四象限已完成视图内容正确', (await titles()).every(t => ['深度专注：核心任务 B', '晨间规划 / 收件箱清理'].includes(t)), JSON.stringify(await titles()))

  // 13) 切回列表视图，筛选条件保持
  await CLICK('.tab-pill', '列表')
  await sleep(340)
  c('切换视图后筛选条件保持', (await rows()) === 2, String(await rows()))
  await CLICK('[data-testid=task-clear]')
  await sleep(320)
  c('收尾清空后回到 8 条', (await rows()) === 8, String(await rows()))
})

/* ------------------------------- 运行器 ------------------------------- */

const results = { pass: 0, fail: 0, fails: [], suites: [] }

async function runSuite(s, name, fn) {
  let pass = 0, fail = 0
  const check = (label, cond, info) => {
    if (cond) { pass++ } else {
      fail++
      results.fails.push(`[${name}] ${label}${info ? ' → ' + info : ''}`)
    }
  }
  const t0 = Date.now()
  try {
    await fn(s, check)
  } catch (e) {
    fail++
    results.fails.push(`[${name}] 套件异常：${e.message}`)
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  results.pass += pass
  results.fail += fail
  results.suites.push({ name, pass, fail, dt })
  const flag = fail === 0 ? 'PASS' : 'FAIL'
  console.log(`  ${flag}  ${name.padEnd(14, ' ')} ${String(pass).padStart(3)} 通过 / ${String(fail).padStart(2)} 失败  ${dt}s`)
}

async function main() {
  const suites = ONLY ? SUITES.filter(x => x.name.includes(ONLY)) : SUITES
  console.log(`\n织日 DayWeave · E2E 回归  目标: ${BASE}  轮次: ${ROUNDS}  套件: ${suites.length}`)

  // 服务器可达性
  try {
    await new Promise((res, rej) => {
      http.get(BASE, r => { res(r.statusCode) }).on('error', rej)
    })
  } catch {
    console.error('无法连接测试目标，请先启动 preview/dev 服务器')
    process.exit(2)
  }

  for (let r = 1; r <= ROUNDS; r++) {
    console.log(`\n===== 第 ${r} / ${ROUNDS} 轮 =====`)
    const s = await openSession()
    for (const sp of suites) {
      s.errors.length = 0
      s.dialogs.length = 0
      s.autoAccept = true
      await runSuite(s, sp.name, sp.fn)
      if (s.errors.length) {
        results.fail += 1
        results.fails.push(`[${sp.name}] 运行时异常：${s.errors.slice(0, 3).join(' | ')}`)
        console.log(`  WARN  ${sp.name} 捕获运行时异常 ${s.errors.length} 条`)
      }
    }
    await s.close()
  }

  console.log(`\n================ 汇总 ================`)
  console.log(`通过 ${results.pass} · 失败 ${results.fail} · 用例 ${results.pass + results.fail}`)
  if (results.fails.length) {
    console.log('\n失败明细：')
    results.fails.forEach(f => console.log('  ✗ ' + f))
  } else {
    console.log('全部通过 ✔')
  }
  fs.writeFileSync(path.join(__dirname, 'last-report.json'), JSON.stringify({
    base: BASE, rounds: ROUNDS, at: new Date().toISOString(),
    pass: results.pass, fail: results.fail, suites: results.suites, fails: results.fails,
  }, null, 2))
  process.exit(results.fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
