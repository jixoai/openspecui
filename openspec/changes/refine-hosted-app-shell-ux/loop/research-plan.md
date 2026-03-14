## Research Findings

- `packages/app/src/components/hosted-shell.tsx` 已经复用共享 `Tabs` 组件，但尚未启用 `onTabBarDoubleClick`，因此 tabs 空白区域双击目前没有行为。
- 顶部刷新按钮当前调用的是 `probeTabs({ visualFeedback: true, refetchManifest: true })`，只会重探 backend health 与 hosted manifest，不会触发 iframe 本身 reload。
- 当前 iframe content 只有“有 `iframeSrc` / 没有 `iframeSrc`”两种渲染分支，没有单独的 frame loading state，因此拿到 `src` 后到 `load` 之前没有 loading 覆盖层。
- app-shell 的 `HostedShellThemeBootstrap` 当前直接复用了 `@openspecui/web-src/lib/theme` 的 `theme` storage key 与 `applyTheme()`，这会让 iframe 内部 web app 写入同一 key 时影响 app-shell。
- 共享 `Tabs` 组件的 terminal 变体目前统一使用 `bg-background text-foreground` 作为选中态；app-shell 需要在 dark 下做局部覆盖，而不应改坏其他页面的 terminal tabs。
- hosted app 目前已通过 `launch_handler: focus-existing`、`launchQueue` 和 `createHostedLaunchRelay()` 实现多实例接管；但 relay 当前并不知道“PWA window 比普通浏览器 tab 更优先”，也没有在成功 forwarded 后对当前浏览器页执行 `window.close()`。
- app service-worker 当前的 versioned navigation 已经会把 `/versions/<channel>/<route>` 导航回落到对应 channel shell，但缓存写入仍然把 route 请求与 canonical shell 写入逻辑混在一起，存在 iframe refresh 落到错误 shell 的风险。
- `window.close()` 对普通浏览器 tab 不是强保证，只能在 launch 被已打开的 PWA 成功接管后做 best-effort 调用，失败时不能阻塞主流程。

## Decision & Plan (For Approval)

- 在 hosted shell 中启用 tabs 空白区域双击，直接复用现有 Add Backend API dialog 打开逻辑；空状态 header strip 也提供同样入口。
- 将顶部刷新按钮改为“只 reload 当前激活 iframe”，并同时只重探当前 tab 的 backend/manifest 状态；不再刷新全部 tabs。
- 为每个 tab 增加独立的 frame load state 和 iframe ref，首次加载与手动刷新都会显示 loading 覆盖层，直到 `onLoad`。
- 为 app-shell 引入独立 theme helper 和独立 storage key，默认 `system`；HostedShell 只响应该 key。dark 下仅对 app-shell 自己的 terminal 选中态做 primary 化覆盖。
- 扩展 launch relay 的 leader 选择，使已打开的 PWA / overlay / standalone window 优先接管 launch；普通浏览器页收到 forwarded ack 后尝试 `window.close()`，失败则静默忽略。
- 收紧 service-worker 的 versioned navigation 缓存写入规则：只有 canonical shell request 能更新 shell cache；route reload 仍按原路径请求，网络失败时才回退到对应 channel shell，不再落回 root shell。

## Capability Impact

### New or Expanded Behavior

- tabs 空白区域双击能够直接发起新 tab 添加。
- 当前激活 iframe 支持真正的 reload，并显示 loading 覆盖层。
- 已打开的 PWA app 能更稳定地接管浏览器 launch，并在成功接管后触发来源页自关尝试。

### Modified Behavior

- 顶部刷新从“metadata probe”升级为“当前 iframe reload + 当前 tab probe”。
- app-shell 的主题存储与 iframe 内 web app 脱钩。
- service-worker 的 versioned route refresh/fallback 语义会更严格地区分 canonical shell 与 route 请求。

## Risks and Mitigations

- 风险：iframe reload 的实现如果直接改 `src`，可能打断现有 session 参数与 Activity 复用。
  缓解：优先使用 `contentWindow.location.reload()`；只有 iframe 尚未可控时才回退到重设 `src`。
- 风险：PWA leader 优先级调整可能影响现有普通多 tab 接管逻辑。
  缓解：只在 leader 冲突判断中加入 display-mode 优先级，不改 launch payload、ack 协议和 storage key。
- 风险：`window.close()` 在浏览器中失败。
  缓解：只在 forwarded success 后 best-effort 调用，失败静默忽略，不增加额外中间页。
- 风险：service-worker route/shell 缓存逻辑收口后引入新的 fallback 回归。
  缓解：补 routing helper 单测，并用浏览器自动化覆盖 versioned route refresh。

## Verification Strategy

- `pnpm --filter @openspecui/app test`
- `pnpm --filter @openspecui/app typecheck`
- 根据改动范围补跑 `pnpm --filter @openspecui/app build`
- 如修改共享 tabs 行为，再补跑 `pnpm --filter @openspecui/web test -- src/components/tabs.test.tsx`
- 使用 browser automation 验证：tabs 双击、新增 tab、iframe loading、当前 tab refresh、versioned route refresh 与 theme 隔离。
