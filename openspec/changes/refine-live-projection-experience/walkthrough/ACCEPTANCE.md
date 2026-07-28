<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Give the owner a numbered, command-exact browser acceptance procedure.
2. Isolate authentication, Clipboard, retained loading, reconnect, Inspector, viewport, static, and host-presentation boundaries.
3. Define PASS/FAIL observations without treating automated fixtures as final acceptance.
4. Keep credentials and disposable mutation scope out of durable evidence.

Original request (2026-07-28): "我需要非常具体的验收工具和验收流程"
Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
Owner acceptance feedback (2026-07-28): "验收任务做完，基本全部通过；列表骨架分隔和 Static /context 仍需修复。"
-->

# Owner Acceptance Procedure

本流程只验收 `refine-live-projection-experience` 当前提交。浏览器与视觉结论由 Owner 作出；脚本只负责准备环境、触发事件和输出客观事实。

## 0. 固定工位

从仓库根目录执行：

```bash
export WALK=openspec/changes/refine-live-projection-experience/walkthrough
export LAB=/tmp/openspecui-live-projection-walkthrough

bun "$WALK/lab.sh.ts" prepare --reset --lab "$LAB"
bun "$WALK/lab.sh.ts" describe --lab "$LAB"
bun "$WALK/inspect.sh.ts" stores --lab "$LAB"
bun "$WALK/inspect.sh.ts" context a --lab "$LAB"
```

预期：命令退出码均为 `0`；Store 列表包含 `shared-reference` 和长 id 的响应式夹具；A 的 Doctor/Context 无 error 级诊断。

打开三个前台终端并始终保持可见：

```bash
# T1: App
bun "$WALK/run.sh.ts" app --lab "$LAB"

# T2: Project A backend
bun "$WALK/run.sh.ts" backend a --lab "$LAB"

# T3: Project B backend
bun "$WALK/run.sh.ts" backend b --lab "$LAB"
```

T2/T3 会各自生成一次 Access Gate credential 并打开带临时 fragment 的 App launch。不要把完整 credential 写入结果文件或截图。

在第四个终端执行：

```bash
bun "$WALK/run.sh.ts" status --lab "$LAB"
bun "$WALK/run.sh.ts" verify --lab "$LAB"
```

预期：App 返回 `200`；未带 credential 的 backend root/health 返回 `401`；focused Vitest 全绿。Vitest 只是准备证据，不是以下浏览器验收。

Chrome DevTools 固定设置：

- Network: 勾选 `Preserve log`，不要勾选 `Disable cache`。
- Console: 勾选 `Preserve log`。
- 响应式用例固定 `390 x 844`，缩放 `100%`。
- 每个用例单独记录 PASS/FAIL 到 `$LAB/acceptance-results.md`；失败只记录最短复现和无 credential 的截图/日志。

## AT-01 Authentication Rejection

先测试缺失凭据：

```bash
bun "$WALK/run.sh.ts" open a --credential missing --lab "$LAB"
```

再测试错误凭据：

```bash
bun "$WALK/run.sh.ts" open a --credential invalid --lab "$LAB"
```

两次都必须满足：

- 页面终态标题为 `Authentication Required`，不是 Loading/Skeleton。
- Network 只有 admission 所需的 `/api/health` 返回 `401`；不得继续出现 `/trpc/*`、WebSocket 或 PTY 请求。
- 等待 10 秒后 Network/Console 不新增循环的 `401`、`UNAUTHORIZED` 或 WebSocket reconnect。
- FAIL：仍在 Loading、出现任意普通 transport，或 10 秒内重复请求。

## AT-02 Hosted Terminal Clipboard

1. 回到带有效 A credential 的 App 窗口，进入 `Sessions`，选择 A。
2. 打开 Project Web 的 Terminal 面板；若没有 session，创建一个普通 Shell session。
3. 在 macOS 终端执行：

```bash
printf 'openspecui-clipboard-acceptance' | pbcopy
```

4. 聚焦 iframe 内终端，按 `Cmd+V`；再选中刚粘贴的文本并按 `Cmd+C`。
5. 在 macOS 终端执行：

```bash
pbpaste
```

PASS：粘贴内容进入终端，复制后 `pbpaste` 输出同一文本；Console 无 `NotAllowedError`、`Permissions Policy` 或 `[terminal] keybinding failed`。

FAIL：任一 read/write 被拒绝，或 iframe 获得 Clipboard 以外的新敏感 permission。Elements 中真实 Project Web iframe 的 `allow` 必须精确为：

```text
clipboard-read; clipboard-write
```

## AT-03 Same-Server Reload And Retained Content

1. 在 A iframe 的 Dashboard 等 Summary、Trends、Git 各自结算。
2. 清空 Network 记录，但保持 `Preserve log`。
3. 点击 App 工具栏的 `Reload current tab`，不要重启 T2。
4. 观察从旧 Document 到新 Document 的完整过程。

PASS：

- Page chrome 不消失；已结算 Summary 可以立即以 display-only 形式保留，再独立收敛为 current。
- Trends/Git 的慢或失败只能影响自己的区域，不得把 Summary 或整个路由替换成全页 Loading。
- 同一个 iframe 只发生一次 reload；不得在 Dashboard 刚结算或约 15 秒后再次自动 reload。
- 30 秒仍未结算，或任何已显示内容被无条件清空，判 FAIL。

可用下列命令区分 Server 冷启动与同 Server Document reload；它不代替浏览器观察：

```bash
bun "$WALK/run.sh.ts" benchmark a --scenario dashboard-page --lab "$LAB"
```

## AT-04 Disconnect And Reconnect

1. 保持 A 的 Sessions tab 可见。
2. 在 T2 按 `Ctrl+C`，不要切换页面、刷新或 blur/focus 来帮助状态更新。
3. 在 App 顶层 DevTools Console 执行：

```js
;[...document.querySelectorAll('[data-hosted-reachability]')].map((node) => ({
  label: node.textContent?.trim(),
  state: node.getAttribute('data-hosted-reachability'),
}))
```

PASS（断线）：A 的 SessionTab 与 iframe treatment 从同一次 accepted observation 收敛为 `offline`；不得出现 iframe 已 Offline 而 Tab 仍 Online 的稳定分叉。

4. 在 T2 重新执行：

```bash
bun "$WALK/run.sh.ts" backend a --lab "$LAB"
```

新 launch 会把新 credential 交回现有 App locator。PASS（重连）：现有 A tab 收敛为 `online`，Project Web 可读；不得靠新增轮询或刷新页面恢复。等待 30 秒仍不收敛判 FAIL。

## AT-05 Inspector Operation And Focus Continuity

1. App 进入 `Environment > Store Manager > Inspector`。
2. 选择 `responsive-containment-evidence-with-a-long-store-identity`。
3. Elements 选中 `Selected Store` 所在 `<article>`，Console 执行：

```js
window.__openspecuiInspectorArticle = $0
```

4. 切换到另一个 macOS 应用 2 秒，再回到 Chrome。
5. Console 执行：

```js
window.__openspecuiInspectorArticle === document.querySelector('main article')
```

PASS：返回 `true`；选中 Store、已显示事实和 article DOM identity 保持；更新光效可以出现，但不得退回空白 Skeleton 或重建 Inspector。

6. 点击 `Unregister` 并确认。PASS：accepted/running/terminal activity 立即可见，最终 Store 从列表移除；期间旧 inventory 不得被伪装成 current，也不得无反馈等待后突然跳变。
7. 用 CLI 恢复夹具：

```bash
bun "$WALK/inspect.sh.ts" restore-responsive-store --lab "$LAB"
```

PASS：Store 通过响应式链路重新出现，无需手动刷新页面。

## AT-06 Sessions Route And Mobile Block Size

1. 在 A iframe 的 DevTools execution context 执行并记住输出：

```js
window.__openspecuiDocumentMarker ??= crypto.randomUUID()
```

2. App 从 `Sessions` 切到 `Connections`，再回 `Sessions`。
3. 在同一 iframe execution context 再执行上一行。

PASS：marker 不变，Terminal/session 状态不丢失，说明 route round-trip 没有重建 iframe Document。

4. 切到 `390 x 844`，保持 `Sessions`，在 App 顶层 Console 执行：

```js
const frame = document.querySelector('iframe')
;({
  viewport: [innerWidth, innerHeight],
  document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  frame: frame ? [frame.getBoundingClientRect().top, frame.getBoundingClientRect().bottom] : null,
})
```

PASS：document 宽高不超过 viewport（1px 舍入误差可接受），iframe bottom 不超过 `844`，header、SessionTabs、iframe 都可见且 iframe 高度大于 0。

FAIL：页面整体纵向滚动、第二个 `100vh`、Tab/iframe 被 header 推出视口，或为修布局而 remount iframe。

## AT-07 Inspector Mobile Inline Containment

1. 保持 `390 x 844`，回到 Inspector 并选择长 id Store。
2. App 顶层 Console 执行：

```js
const main = document.querySelector('[data-testid="app-main"]')
const article = document.querySelector('main article')
;({
  viewportWidth: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  main: main ? [main.clientWidth, main.scrollWidth] : null,
  article: article
    ? [article.getBoundingClientRect().left, article.getBoundingClientRect().right]
    : null,
})
```

PASS：`documentWidth <= viewportWidth`，`main.scrollWidth <= main.clientWidth`，article 左右边界均在 viewport 内；长 id、root、metadata path 和 controls 通过换行/截断/重排保持可读可操作。

FAIL：页面可横向滚动、事实压住按钮、文本越界，或 Inspector 为适配宽度改变了产品布局结构。

## AT-08 Clean Static Export

先执行真实 clean-build/export 链路：

```bash
bun "$WALK/inspect.sh.ts" export-static a --open --lab "$LAB"
```

PASS：

- `build:ssg` 和 `openspecui export` 均退出 `0`，没有 `entry-server.js` module-not-found。
- 输出目录为 `$LAB/static-a`，可访问 owned Spec 和 `shared-reference` 的 Reference Spec。
- Static 页面不显示 `Live`、revalidating、reconnect 或当前 mutation authority；无 WebSocket/PTY 请求。
- 页面仍使用和 live 相同的内容映射，窄屏无新增横向溢出。

## AT-09 Existing App Surface Presentation

先关闭 T2/T3，只保留 T1 的 App dev Server。关闭此前遗留的 App 页面或 PWA 窗口，确保起点唯一。

1. 在 T2 执行：

```bash
bun "$WALK/run.sh.ts" backend a --lab "$LAB"
```

2. 等 A 出现在 App 的 Sessions tab 后，不关闭该 App 表面；在 T3 执行：

```bash
bun "$WALK/run.sh.ts" backend b --lab "$LAB"
```

3. 分别在两种宿主形态执行一次：

- 已安装同 scope PWA：由 manifest `focus-existing` 与 `launchQueue` 处理。
- 普通 Chrome 页面：允许 CLI 临时打开一个来源 Document，由 same-origin relay 转发给既有 leader。

PASS：

- 原有 App 表面获得前台焦点，且同一 App 中同时存在 A/B Sessions tab。
- 已安装 PWA 不创建第二个持久 PWA 窗口。
- 普通浏览器的临时来源 Document 在 leader acknowledgement 后自动退场；不得留下第二个空 App 页面。
- A/B credential 都可用，且 URL、Console、结果文件中不保留 credential fragment。

FAIL：

- B 出现在新建的持久 App 窗口而原窗口未收到 tab。
- 临时普通浏览器来源页稳定留在前台，或关闭了实际承载 A/B 的 leader。
- 为实现聚焦而引入轮询、持久化 credential，或把 Browser opener 重新写回 start coordinator。

说明：普通浏览器是否允许脚本 `focus()`/`close()` 属于浏览器策略，产品路径是 best-effort；若策略明确阻止退场，记录浏览器版本、Console 拒绝信息与 leader 是否正确收到 B，不要将自动化单测记为 PASS。

## 1. 收尾与判定

全部用例结束后：

```bash
bun "$WALK/mutate.sh.ts" status --lab "$LAB"
openspec validate refine-live-projection-experience --strict
git diff --check
```

判定规则：

- AT-01 至 AT-09 任一 FAIL，则 owner acceptance 不成立；只回报对应 ID、最短复现和去敏证据。
- 全部 PASS 后，`$LAB/acceptance-results.md` 才可作为 checkpoint `3.6` 的 Owner 证据输入。
- 不在验收阶段 merge、archive、release。

清理：

```bash
bun "$WALK/lab.sh.ts" clean --lab "$LAB"
```

脚本只会删除带正确 marker 的 disposable lab。

## 2. Owner Result: pre-P9 head

The owner completed the walkthrough against pre-P9 head `9ab565d` and reported the functional cases as broadly
passing. Two presentation observations remain open and prevent final closure:

1. Repeating `rt-skeleton rt-skeleton-row h-14` list rows need a visible shared gap or divider.
2. Static `/context` renders no snapshot facts; the retained route must support publication-safe Context export.

P9 automated evidence may prepare a replacement head, but the owner performs the final visual confirmation.

P9 now has focused unit/SSR and real non-browser export evidence. Recheck only these two observations on the
replacement head; the already accepted functional walkthrough does not need to be repeated unless either fix
changes adjacent behavior.

## 3. Owner Result: static document escape

The owner reported that `pnpm openspecui export -o ./tmp --open` rendered serialized snapshot/source-preview text
as page content. P10 corrected the shared static document embedding boundary. After the replacement head is
available, rerun only the same export command and confirm:

1. No JSON or source-preview text overlays the application.
2. Dashboard and `/context` render normally from the embedded snapshot.

This follow-up does not require repeating unrelated live/App cases. Final visual confirmation remains owner-owned.
