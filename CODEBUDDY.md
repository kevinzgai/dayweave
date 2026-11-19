# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Commands

- `pnpm install` — 安装依赖；`packageManager` 固定为 `pnpm@12.14.0`，`pnpm-workspace.yaml` 关闭了严格依赖构建。
- `pnpm dev` — 启动 Vite 开发服务器，固定端口 1420；`vite.config.js` 在 `TAURI_DEV_HOST` 存在时切到 HMR 1421。
- `pnpm build` — 生产构建到 `dist/`，Tauri 打包前也会执行它。
- `pnpm preview --port 4173 --strictPort` — 以 E2E 默认目标地址预览构建产物。
- `pnpm tauri:dev` / `pnpm tauri:build` — Tauri v2 桌面开发/打包；打包目标目前仅 Windows `msi`。Rust 侧改动可用 `cargo check --manifest-path src-tauri/Cargo.toml` 快速校验。
- `pnpm test:e2e` — 先启动预览或开发服务后运行；通过本机 Chrome CDP 跑完整套件、连续 2 轮，结果写入 `tests/last-report.json`。
- `node tests/e2e.cjs --only=浮窗 --rounds=1` — 只跑单个套件；`--only` 按套件名子串过滤。
- `TM_URL=http://localhost:1420/ node tests/e2e.cjs --rounds=1` — 改测开发服务器；Chrome 不在默认路径时用 `TM_CHROME` 指定。

仓库未配置 lint 或单元测试脚本，不要假设存在 `pnpm lint` / `pnpm test`；E2E 是目前唯一的自动化测试。

## Architecture

前端是 React 18 + Vite 6 + UnoCSS 的单页应用，Tauri v2 是很薄的外壳。Rust 侧只有 `main.rs` 调用 `lib.rs::run()` 启动 `tauri::Builder`，没有自定义 command、事件、托盘或插件；桌面能力由 JS 直接调用 Tauri API。版本号在 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 与内置手册中保持一致，发布时需一并更新。

`index.html` 只挂载 `#root`；`src/main.jsx` 在首帧前应用主题，然后判断 `?mini=1` / `#mini`：主窗口渲染 `App`，浮窗渲染 `MiniPanel mode="window"`。项目没有路由库：`App.jsx` 用 `NAV` / `TITLES` 表和本地 `nav` state 管理 16 个入口，`renderPage()` 以手写 switch 映射到 `src/pages/*.jsx`。四象限入口会把 tab 提示传给 `TasksPage`；命令面板 Ctrl/Cmd+K 也复用同一套导航状态。

`src/store.jsx` 是唯一全局状态源，`StoreProvider` 通过 Context 暴露 `{ state, actions, derived, uid }`，组件统一用 `useStore()` 取值。闪念、任务、时间块、计时、复盘、目标/项目/习惯、素材、设置、导入导出等 action 都集中在这里构造。状态写入 localStorage key `time-master-state-v1`（历史内部标识，应用已改名织日 DayWeave，key 保持不变以兼容老数据），并通过 `time-master-sync-v1` BroadcastChannel 加 `storage` 事件做跨窗口同步，`lastRawRef/remoteRef` 用于防回环。`loadState()` 对损坏 JSON、旧版缺字段做浅合并式兜底并回退 seed，没有独立 schema version；新增字段时通常要同时改 seed 和 `loadState`。计时到点结算由 Provider 内 500ms interval 统一处理，UI 层另有更快的本地 tick 只负责显示。

浮窗有两条路径：浏览器里 `App.jsx` 切换应用内浮层 `MiniPanel mode="float"`；Tauri 下 `src/miniWindow.js` 创建 label 为 `mini` 的无边框、置顶窗口。新增窗口 label 或新的 Tauri API 调用必须同步 `src-tauri/capabilities/default.json` 的权限，否则运行时会被拒绝。主题是运行时变量注入：`theme.js` 定义 5 套主题并把 CSS 变量写到 `<html>`，`styles.css` 的 `:root` 保留默认回退，`uno.config.js` 把 UnoCSS 颜色/圆角/阴影令牌映射到同一批 `var(--...)`。新增或改名颜色令牌需要三处同步；手册 `src/help/guide.html` 作为 iframe 也复用 `themeVars()` 注入配色。
主窗口也是无边框（`tauri.conf.json` 里 `decorations: false`）：`.topbar` 与侧栏 `.brand` 用 `data-tauri-drag-region="deep"` 当标题栏（拖拽移动、双击最大化/还原，可点击元素会自动拦截），最小化/最大化/关闭由 `src/components/WindowControls.jsx` 渲染在顶栏右侧，只在 Tauri 下出现（浏览器与 E2E 里返回 null）。这些调用依赖 `core:window:allow-{minimize,is-maximized,toggle-maximize}`。想确认窗口是否真的无标题栏，可比对 `ClientToScreen(0,0)` 与窗口 rect 的顶边偏移（无标题栏时只有约 1px 的阴影内缩）。

`src/ui/index.jsx` 是内部组件层，弹窗用 portal 并维护 `modalStack`；当前约定是 Esc / 遮罩不关闭编辑与确认弹窗，只能点显式“取消 / 删除”，改动交互前先核对 `tests/e2e.cjs` 中的相关断言。E2E 是零依赖 Node 脚本，用 CDP 驱动本机 Chrome；每个套件开始清空 localStorage 以从 seed 出发，页面运行时异常（`console.error`、`Runtime.exceptionThrown`）也会计为失败。`tests/README.md` 记录套件清单与过滤参数。
