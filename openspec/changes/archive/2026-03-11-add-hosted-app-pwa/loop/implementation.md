## Implementation State

- Wrangler / Cloudflare Pages 前置能力已在本分支完成：`packages/app` 和 `packages/website` 已支持 `wrangler pages` 的 build/dev/deploy 命令。
- `packages/app` 的 Pages 深链接回退已改为 `public/_worker.js`，本地 `wrangler pages dev` 下已验证 `/versions/latest/dashboard` 返回 200。
- `packages/app` 已接入 installable PWA 基线：构建阶段会生成 `manifest.webmanifest`，入口 HTML 已声明 manifest、主题色、Apple touch icon，产物中包含 `pwa-192x192.png` 和 `pwa-512x512.png`。
- `packages/app` 的 service worker 已纳入 manifest、PWA icons 和 app 图标的缓存策略。
- hosted shell 已接入 PWA runtime：支持 `beforeinstallprompt` / `appinstalled` / display-mode 检测，支持基于 `windowControlsOverlay` 几何信息写入 titlebar CSS 变量，并在顶部 tabs header 上预留 overlay 空间。
- hosted shell 已接入 launch relay：`?api=` 首次启动和 `launchQueue` 启动统一进入 `HostedShellLaunchRequest`，再通过 leader window + `BroadcastChannel` 做 best-effort 单窗口接管。
- 当前 package 级校验已通过：`pnpm --filter @openspecui/app typecheck`、`pnpm --filter @openspecui/app test`、`pnpm --filter @openspecui/app build`。

## Decisions Taken

- PWA 目标限定为 `packages/app`，复用 `packages/web` 的组件与样式 token，但不改 `packages/web` 主应用路由架构。
- 多实例接管采用 Chromium 优先的 best-effort 路径：`launch_handler` + `window.launchQueue` + app 内 `BroadcastChannel` / leader 协调。
- 对于不支持 PWA 相关能力的环境，继续保留当前 hosted shell 的普通网页模式。
- Cloudflare Pages 深链接回退使用 `_worker.js`，不使用会产生循环问题的 `_redirects` 规则。
- `launch-relay` 的默认 runtime 已去除对 `window` 存在性的硬依赖，保证 node/jsdom 测试环境也能稳定运行。

## Divergence Notes

- 本 loop 在正式进入 PWA 代码实现前，先完成了用户要求的 Wrangler 推送支持；这属于启动前置工作，不改变 PWA 主体范围。
- `packages/app` 的单元测试目前仍会因 `packages/web` Tabs 内部使用的实验性 CSS 产生 jsdom stylesheet parse 噪音，但不影响断言通过；若后续要进一步收敛测试输出，需要在 shared Tabs 层单独处理测试环境兼容。

## Loopback Triggers

- 如果浏览器实际能力与当前官方文档假设不一致，需要回到 research-plan 更新能力边界。
- 如果 launch relay 导致内部 tab 去重或窗口 leader 竞争出现不稳定，需要回到 research-plan 重新确认单窗口策略。
- 如果 titlebar overlay 需要显著调整顶部 Tabs 结构，需要先回到 research-plan 重新确认 UI 约束。
