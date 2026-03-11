## Research Findings

- 当前 `packages/app` 已有 hosted shell、多 tab 持久化、版本清单下载和 service worker，但还没有 `manifest.webmanifest`、安装图标声明、`beforeinstallprompt` 处理或 `appinstalled` 状态同步。
- 当前 `packages/app` 的启动入口仍然是 `?api=` URL 参数和 `localStorage` tab 持久化；没有 `window.launchQueue`、`BroadcastChannel`、窗口 leader 选择或跨窗口启动请求转发能力。
- 当前 `packages/app` 顶部已经有多 Tabs + actions 结构，适合作为桌面 PWA titlebar-aware 顶栏承载区，但还没有 `window-controls-overlay` 相关运行时和 CSS safe area 变量。
- 已完成前置部署能力：`packages/app` 和 `packages/website` 现在都具备 `wrangler pages` 的 `cf:dev` / `cf:deploy` / `cf:project:create` 命令；`packages/app` 使用 `public/_worker.js` 处理 `/versions/<channel>/...` 的 Pages 深链接回退。
- MDN 的 installability 文档说明：manifest 可以提升安装提示与安装行为控制，但 `beforeinstallprompt` 不是跨浏览器统一能力，需要渐进增强。
- MDN 的 `display_override` / `Navigator.windowControlsOverlay` 文档说明：`window-controls-overlay` 是桌面 PWA 的实验性增强能力，需通过 manifest 的 `display_override` 显式声明，并在不支持时回退到 `standalone`。
- Chrome 的 Launch Handler 文档说明：manifest 的 `launch_handler.client_mode: "focus-existing"` 可以将新的启动请求路由给现有 app client，并通过 `window.launchQueue` 交付 `LaunchParams`；这是 Chromium 优先能力，不应作为跨浏览器硬承诺。

## Decision & Plan (For Approval)

- 在 `packages/app` 新增 PWA manifest 生成链路，产出固定入口 manifest、安装图标和 HTML 接入，不改变当前 hosted bundle 分发结构。
- 增加 install runtime：监听 `beforeinstallprompt`、`appinstalled` 和 display-mode，向顶部 action 区提供最小安装入口；不支持安装时完全隐藏。
- 增加 titlebar runtime：侦测 `navigator.windowControlsOverlay`，读取 titlebar 几何信息并写入 CSS variables；顶部 Tabs/Actions 依据这些变量预留窗口控制区空间。
- 增加 launch runtime：将 URL `?api=` 启动和 `window.launchQueue` 启动统一归一化为 `HostedShellLaunchRequest`，再通过 leader window + `BroadcastChannel` 做 best-effort 单窗口接管。
- 保持普通网页路径和不支持浏览器的回退：继续允许直接打开普通网页 hosted shell，不引入 native helper，不承诺绝对单实例。
- 在 `packages/app` 内为 manifest/runtime/launch 协调逻辑补单元测试，并对安装与跨窗口协调增加可控的 runtime stub 测试。

## Capability Impact

### New or Expanded Behavior

- Hosted app 可以作为 installable PWA 被安装。
- 已安装桌面 PWA 可以根据 titlebar overlay 能力调整顶部布局。
- Chromium 优先环境下，新的启动请求可以优先进入现有 app 窗口并聚焦或新增内部 tab。
- 顶部区域可以反映安装状态和 display mode，而不是仅作为普通网页头部。

### Modified Behavior

- `packages/app/index.html` 不再只是普通网页入口，还将显式声明 manifest、安装图标和 PWA 元数据。
- hosted shell 启动流程将从“只解析 URL 参数”扩展为“URL 参数 + launchQueue + 跨窗口 relay”。
- 本地 / Cloudflare Pages 运行时需要同时支持根入口与 `versions/<channel>` 深链接。

## Risks and Mitigations

- 风险：`beforeinstallprompt`、`launchQueue`、`window-controls-overlay` 浏览器支持不一致。
  缓解：全部按 feature detection 渐进增强；普通网页模式保持不变。
- 风险：跨窗口接管逻辑引入重复 tab 或状态竞争。
  缓解：统一通过 `normalizeHostedApiBaseUrl` 去重，并增加 leader + relay 测试。
- 风险：PWA titlebar 适配影响普通网页 header 布局。
  缓解：把 overlay 几何信息隔离为 runtime variables，未安装或不支持时回退为现有布局。
- 风险：Pages 深链接回退和 service worker/manifest 入口互相干扰。
  缓解：保持 `_worker.js` 只处理 `versions/<channel>/...` 的 404 回退，根入口仍由静态资产直接服务。

## Verification Strategy

- 本地校验：`pnpm --filter @openspecui/app test`、`pnpm --filter @openspecui/app typecheck`、`pnpm --filter @openspecui/app build`。
- Workspace 校验：`pnpm format:check`、`pnpm lint:ci`、`pnpm typecheck`、`pnpm test:ci`、`pnpm test:browser:ci`。
- PWA 运行时验证：
  - manifest/build 产物存在且路径正确；
  - 支持环境下安装入口出现并可触发 prompt；
  - `window-controls-overlay` 环境下顶部布局不遮挡系统按钮；
  - `wrangler pages dev dist` 下 `/versions/latest/dashboard` 返回 200 并回退到对应 channel shell；
  - 模拟新启动请求时，现有 app 窗口能够处理并新增/聚焦内部 tab。
