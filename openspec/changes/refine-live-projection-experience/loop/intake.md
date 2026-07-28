<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Capture the owner's full-surface Web and App waiting-experience request without changing the pending Kanban layout work.
2. Define the real-time push-to-pull lifecycle and authority boundary that the visual experience must project.
3. Bound reusable, composable frontend state atoms and their migration across existing pages and overlays.
4. Preserve objective source evidence, accessible equivalents, and owner-only final browser acceptance.

Original request (2026-07-23): "布局方面暂时不需要改动，后续社区有一个PR我会合并进来，那是关于kanban 的一个pr。所以本次change的主要优化点，在于更友好的UIUX，优化用户等待信息的时间感知。"
Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。"
Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
Original request (2026-07-27): "我已经全面走查了，结果是指的肯定的，绝大部分功能基本都通过了，更多的问题是在一些 UI/UX 的问题上，这属于后续需要打磨的问题，我个人觉得可以收尾 change，然后另外开 change 来专门打磨。"
Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口；从底层封装，后续可能对接 OpenTray 原生窗口。"
-->

## User Input

> 布局方面暂时不需要改动，后续社区有一个 PR 我会合并进来，那是关于 kanban 的一个 PR。所以本次 change 的主要优化点，在于更友好的 UIUX，优化用户等待信息的时间感知。
>
> 一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。
>
> 这个只能说初步可用吧，但不够完善。记得全局系统提示词中跟你说到的 UI 相关的最佳实践吗？你这套设计没有考虑到在已有 content 的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。也就是说你只考虑了有、无两种大方向的状态，没有考虑到“实时变更”相关衍生的状态。
>
> 不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。
>
> 是，但不用刻意去做，毕竟从 web 的技术要做到这样的效果其实很困难，使用原生的能力去做就好，比如 `overflow-anchor: auto;`。
>
> 统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是 app 那边新增的页面）。

## Manager Walkthrough Transfer

`close-openspec-cli16-delivery-gaps` completed its manager walkthrough on 2026-07-27. The CLI 1.6 correctness
baseline was accepted; this Change owns the explicitly transferred runtime-experience work:

```text
functional blockers
├─ Project Web: 401/403 rejection never reaches authentication-required
└─ Static export: clean Vite 8 SSR build emits a hashed entry that the exporter cannot resolve

accepted follow-up polish
├─ Hosted iframe: Clipboard capability is not delegated
├─ SessionTabs: Offline presentation occasionally lags the iframe's disconnect state
├─ Sessions: mobile App header plus a viewport-sized hosted surface overflows vertically
├─ Store Inspector: delayed/abrupt operation feedback, focus refresh discontinuity, mobile inline overflow
└─ Hosted launch: browser fallback opens a transient App document instead of presenting the existing surface
```

These are seven separate implementation packages with distinct owners and tests. They do not reopen Store, Root,
Reference, `envUri`, or mutation-ledger correctness. Authentication and Static export are P0 because they prevent a
correct terminal state or output; the remaining packages are accepted functionality with follow-up UX debt.

The hosted-launch follow-up is optional release polish, but its architecture is durable. The CLI owns one semantic
presentation request after Server readiness; a host adapter decides how to present it. The browser adapter may use
PWA `focus-existing` or a same-origin relay plus best-effort source retirement. A future OpenTray adapter may show
or focus a native window without changing Server startup or reconstructing a browser-only URL contract.

## Objective Scope

本 Change 统一整改当前 Web 与 App 的路由页面、详情区、Dialog、Popover、Drawer、设置分区和操作控件的等待体验；不改变既有页面的信息架构、导航或布局。它沉淀一个可组合的实时状态组件族，并迁移全部现有异步表面。

```text
source mutation / filesystem change
              |
              v
      server push invalidation
              |
              v
  identity-bound client pull + generation check
              |
              v
   current snapshot commit or retained failure
              |
              v
headless realtime state law -> composable visual atoms -> route/overlay surface
```

状态本体必须覆盖八种渲染拓扑，而不是只导出 `isLoading`：

```text
无可展示结果: idle | initial-loading | empty | initial-error
已有可展示内容: partial | current | revalidating | refresh-error

orthogonal facts:
authority = current | display-only
cause = initial | server-push | user-action | reconnect | root-rebind
```

实施必须遵守以下边界：

- 服务端推送只通知某个投影身份失效；客户端按该身份重新拉取并通过当前 generation 校验后，才可提交内容或触发更新效果。不得把推送载荷直接写成 UI 事实，也不得乐观篡改业务投影。
- 新浏览器 Document 的模块内缓存为空时，服务端保留的 `stale-display-only` snapshot 必须能通过 typed read 立即交付；客户端后台等待 matching current snapshot，写权限不能由 retained data 恢复。
- 实时适配层拥有订阅、拉取、同身份合并、generation 退休、authority 与原因事实；shadcn 风格的复合组件只消费归一化状态。状态法则与视觉原子物理分离，页面按需组合，组件不强制 Card、边框或布局。
- 普通生命周期使用稳定骨架、明暗、局部掠光、收束动效和实际变化项的轻量强调，不使用常驻 `Loading...`、`Updating...`、伪百分比或 ETA。空、失败、阻断、冲突和需要用户决定的状态保留极简文字与可执行操作。
- 当前内容在后台重验时继续显示；`display-only` 内容仍可读、可选、可复制，但所有依赖当前快照的写操作保持锁定。用户编辑草稿或操作叠层时，远端更新不得覆盖本地交互，而应保留“有更新可用”的局部收敛路径。
- 同身份的推送突发合并进有界重验窗口；用户主动操作和终态变化绕过该窗口。连接真值仍在既有全局 Status Bar 表达，局部区域只表达对其内容的影响。
- 状态视觉使用现有主题 token、原生 CSS 与 View Transitions，并提供 `prefers-reduced-motion` 和隐藏无障碍等价物。列表优先使用稳定 identity、正常 DOM 流和 `overflow-anchor: auto`，不引入手写滚动/焦点账本。
- 静态模式复用同一组件族，但只投影真实静态快照，不伪造 Live、推送或更新效果。Terminal、原始 CLI 证据、编辑器和日志保留原始文本，只迁移其外围控制和等待反馈。
- App 的 Store、Root Context 与 Environment 页面在 WebSocket notice 之前先执行一次 typed Pull，避免等待并不保证及时到达的 lifecycle notice；App 路由切换不得销毁已建立的 Sessions iframe Document。

## Non-Goals

- 不修改 Dashboard、Changes 或其它页面的布局、信息架构、导航集合，且不抢占后续社区 Kanban PR 的设计或文件范围。
- 不创建第二个前端事实源，不放松 Root/Store/Git binding provenance、当前 generation、`display-only` authority 或 root-action lock，也不把 UI 视觉状态写回服务器本体。
- 不以全局 Toast、全屏遮罩、居中 Spinner、持续文案、伪进度、伪 ETA、硬编码状态色或无限动画取代真实生命周期。
- 不手写脆弱的滚动锚定、焦点迁移、JS 动画循环或跨页面预热；普通隐藏数据路由不为视觉新鲜度持续订阅或拉取。Sessions iframe 是有状态项目运行时，持久挂载不属于预热。
- 不引入 `sessionStorage`、`localStorage` 或 IndexedDB 业务快照缓存；服务端 Projection Work 仍是跨新 Document retained content 的唯一来源。
- 不用视觉语言替换 Terminal/CLI/日志/编辑器的原始内容，也不让失败、空、权限阻断或冲突失去文字与可执行恢复路径。
- 不把 Agent 运行的 Vitest、Storybook/组件夹具或基础 Playwright 结果称为最终端到端浏览器验收；该验收仍由 owner 执行。

## Acceptance Boundary

本 Change 达到可实施状态，当且仅当：

- `realtime-state` 组件族的产品故事、八态状态机、authority/cause 维度、push-to-pull 归属、视觉 token、无障碍回退和静态模式边界都有类型安全的设计与明确 owner。
- 所有当前 Web/App 路由与叠层异步表面都有迁移清单；每项明确现有事实源、初始/部分/重验/失败/空态、可写性、草稿冲突策略与不改布局的边界。
- 组件 API 为 headless 状态法则加可组合视觉原子；其 `data-state`、`data-authority`、`data-cause` 是共享 CSS 的唯一状态入口，页面不再散落等价的 loading 条件分支。
- 验证矩阵覆盖八种拓扑、`current -> revalidating -> current`、`current -> revalidating -> refresh-error`、批次到达、同身份推送合并、display-only 写锁、草稿中的远端更新、静态模式、减弱动态和移动端稳定骨架。
- 验证矩阵覆盖 fresh Document 读取 Server retained snapshot、App notice 前首次 Pull、Environment 未完成时不显示假空态，以及 App route 往返时 iframe DOM identity 保持不变。
- 实施计划按共享状态法则、视觉原子、适配层、全表面迁移、状态矩阵测试和 owner-only 浏览器验收拆分；每个包都有生产 owner、精准红例、绿例、mutation-resistance 目标与停止条件。
- `openspec status --change refine-live-projection-experience` 显示 `intake` 完成并解锁下一工件；严格 Change 校验在后续工件完成时通过。
