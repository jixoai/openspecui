## Research Findings

- hosted app 当前只把 launch 转发给 leader window，但 follower/其它实例不会在 leader 写入 `openspecui-app:shell` 后立即重载本地 shell state。
- `HostedShell` 目前只在初始化时从 `localStorage` 读取 shell state，并在本实例 state 变化时写回；没有监听 `storage` 事件，也没有单独的 shell state BroadcastChannel。
- 现有 `launch-relay` 已使用 `BroadcastChannel` 做 leader/ack 协调，可以复用同域通信思路。
- `HostedShell` 当前在 `forwarded` 时只显示一条提示文案，不会主动等待其它实例写入后的状态同步，因此刷新后才看到 tab。
- `packages/app/index.html` 的 light 模式 `theme-color` 仍是白色，而 hosted shell 顶栏始终使用 terminal 黑色背景，因此 overlay/标题栏融合会出现白色断层。
- `packages/app/public/icon.rounded.svg` 的图形组偏左上且缩放偏小；对应 PNG 资源中的非白色图形包围盒也明显偏向左上。
- 本地构建产物中已存在 `dist/versions/v2/index.html`，Cloudflare Pages 线上请求该文件本身可返回 200；当前问题核心不是文件缺失，而是根壳 tab/iframe 同步。

## Decision & Plan (For Approval)

- 新增 hosted shell state 同步模块，统一封装 `localStorage` 持久化、`storage` 事件监听、shell-state BroadcastChannel 广播与短时兜底同步。
- `HostedShell` 继续使用 launch relay 处理 leader 选择，但所有实例都订阅 shell state 同步；`forwarded` 后启动短时 rehydrate 兜底，直到新 tab 出现或超时。
- 新增 hosted app 主题色同步模块，把根文档 `theme-color` 固定更新为 terminal 顶栏色，并在 overlay / 主题变化时刷新。
- 调整 hosted shell overlay 样式，使 titlebar 区域使用 terminal 顶栏背景完整铺满。
- 直接修正 app 的 SVG/PNG 图标资源，不引入额外生成流水线。
- 文档中明确 Cloudflare Pages 预览联调仍需显式 `--app=<preview-url>`。

## Capability Impact

### New or Expanded Behavior

- hosted app 的 shell state 可以跨同域实例即时同步。
- `forwarded` launch 会触发当前实例的短时同步等待，而不是仅停留在提示文案。
- 根文档 `theme-color` 会与 terminal 顶栏一致，并在 overlay/主题变化时同步。

### Modified Behavior

- PWA 图标资源将被替换为居中且构图更合理的版本。
- overlay 激活时的顶部背景与间距样式会调整。

## Risks and Mitigations

- 风险：多源同步引起重复 state 刷新。
  缓解：只在序列化值变化时广播，并在组件侧用解析后的 state 直接替换，避免自激增量合并。
- 风险：BroadcastChannel 不可用时仍存在延迟。
  缓解：保留 `storage` 事件和短时轮询兜底。
- 风险：手工替换图标资源后未来难以复现。
  缓解：保持素材极简并在实现说明中记录尺寸与构图原则。

## Verification Strategy

- `pnpm --filter @openspecui/app test`
- `pnpm --filter @openspecui/app typecheck`
- `pnpm --filter @openspecui/app build`
- 必要时补跑 workspace 级 `pnpm format:check`、`pnpm lint:ci`、`pnpm typecheck`。
- 手动验证：Pages 预览链接 + 已安装 PWA + overlay 模式。
