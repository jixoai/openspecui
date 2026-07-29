<!--
Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
1. Preserve the owner's original OpenTray and CLI requirements.
2. Bound daemon, serve, presenter, and App-shell ownership.
3. Exclude superseded hosted-shell deployment and backend-proxy scope.
4. Define the automated-versus-owner acceptance boundary.
-->

## User Input

> 下一步，立项 6.1.x: 我们要继续打磨 app 模式，我们需要将它适配对接 opentray。请参考 ../skill-creator-v2 适配 opentray的方式：
>
> 1. 支持 `--web`
> 2. 对opentray 的窗口overlay-window-controls的样式适配
> 3. 使用appMode

## Objective Scope

- 将 OpenTray 接入 OpenSpecUI 6.1.x 的实验性 App 模式，作为现有多项目 App 的原生宿主呈现器，而不是创建第二套 App、Server、标签页或持久化模型。
- 建立用户级单实例 App daemon。它只拥有本地 App shell、tray、OpenTray window 和 launch IPC；每个前台 `serve` 进程继续拥有自己的项目 backend。
- 为 CLI 建立明确的命令与宿主合同：裸 `openspecui [project]` 是 `serve` 的缩写，`start|stop|restart` 只管理 daemon；`--web` 在 daemon 启动时选择 Browser/tray 宿主，在 `serve` 上选择 Direct Web 投递行为。
- OpenTray 原生窗口使用 retained `@opentray/ext-webview` session 和 `style.appMode: true`；后续启动只显示或聚焦既有窗口，不重复应用 bootstrap 尺寸、样式、native capability 或私有 credential URL。
- 统一 App shell 的标题栏宿主状态：浏览器/PWA `windowControlsOverlay` 与 OpenTray `navigator.opentrayWindow.overlay` 是互斥的几何来源；OpenTray overlay 下的 inset、拖拽区域与交互控件适配系统窗口控制区。
- 多个 `serve` backend 通过 daemon IPC 汇入同一个 retained App 窗口；App 中 `Workspaces` 替代 `Sessions`，每个 Workspace 可在系统浏览器打开其 Direct Project Web。
- daemon 提供随 CLI 发布的本地 App shell；不再选择、配置或依赖外部 App shell 部署位置。
- 保持现有 Server 启动、Access Gate、tab persistence、backend lifecycle、Direct Project Web 与 hosted App 语义不因宿主选择而改变。
- 以 `../skill-creator-v2` 的 OpenTray 适配为参考证据，同时以 OpenSpecUI 当前 host-neutral presentation 边界和实际 OpenTray API 为最终实现依据。

## Non-Goals

- 不把 OpenTray 建成独立的项目管理产品、第二套前端路由、第二个 backend 或新的数据事实来源。
- 不因 OpenTray 接入改写 OPSX、OpenSpec CLI、Store/Reference、项目 Root 或响应式投影语义。
- 不让 `--web` 路径 import、初始化或隐式依赖 `@opentray/ext-webview`。
- 不同时叠加 PWA 与 OpenTray 的标题栏 inset，不使用 wildcard native capability，也不向日志、持久化状态或可分享 URL 暴露 credential。
- 不保留公开的 `appBaseUrl`、Settings Hosted App URL 或 `--app=<url>`；官方或自托管 App shell 不再是本地 daemon 的运行依赖。
- 不由 daemon 监督、重启或停止项目 backend，也不在本 Change 中把 backend HTTP、RPC、PTY 或 WebSocket 反向代理到 daemon origin。
- 不在本 Change 中重新设计 App 标签页、Project Web 页面或发布 6.1.x；发布在实现验收完成后单独决策。
- Agent 不代替 Owner 完成最终浏览器或 OpenTray 原生窗口端到端走查。

## Acceptance Boundary

- CLI 命令和宿主选择矩阵有类型化实现和直接 parser/dispatch 单元测试；裸命令等价于 `serve`，`--app`/`--web` 等价于对应的 `serve` flag，`start|stop|restart` 只拥有 daemon 生命周期。
- 交互式 `serve` 在 daemon 缺失且未显式选择宿主时显示 `[Y/n]`；非交互环境保持 Direct Web。`--no-open` 不询问、不启动 daemon、不投递 Workspace。
- daemon startup config 在一次生命周期内不可变；显式启动参数与运行态冲突时拒绝静默修改并给出精确 `restart` 命令。
- daemon 使用用户隔离 IPC 和本地 App shell。重复 `start` 或多个 `serve` 只激活同一个 App daemon/window；active `serve` 在 daemon restart 后重新注册其 backend，但 daemon 不取得 backend 进程所有权。
- 支持的平台上，原生 `--app` 使用一个 retained OpenTray WebView session，创建参数包含 `style.appMode: true`；重复启动通过 show/focus 复用窗口，不重放 bootstrap-only 配置。
- 多个 backend 启动请求可以进入同一个 App 窗口的 Workspaces 模型；每个 Workspace 的 Open in browser action 只打开该 backend 的 Direct Project Web。
- App shell 从一个类型化宿主状态读取标题栏 geometry；PWA overlay 和 OpenTray overlay 永远只激活一个来源。OpenTray overlay 的拖拽面、窗口控件避让和交互 hit region 正确，bridge 缺失时 Browser/PWA 布局不变。
- macOS、Windows、Linux/headless 的 native capability、frame/overlay 差异和 fallback 行为被明确记录；本地 App shell 仅获得完成该 App 工作流所需的最小 native capability。
- 现有 Server、认证、标签页持久化、backend 生命周期及 Direct Web 行为的回归单元测试保持通过。
- Agent 完成 focused Vitest 与基础组件级 Playwright 证据；Owner 负责最终 Browser/PWA 与 OpenTray 原生窗口走查，并据此决定是否完成 Change。
- 影响可发布包的实现包含 Changeset；CI 等价检查、OpenSpec artifact 验证和 PR 检查通过后才允许合并，且本 Change 不自动触发 6.1.x 发布。
