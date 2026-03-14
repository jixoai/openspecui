## User Input

- 双击 `app-shell-tabs` 要能实现等效“添加新 Tab”的功能。
- 点击 `app-shell-header` 的“刷新”按钮，应该等效于 iframe-reload；实现后需要用浏览器自动化重点验证，因为 service-worker 仍然可能有问题。
- iframe 还没触发 loaded 之前，请显示一个 loading 的动画。
- iframe 内部的 theme 设置不可以影响 app-shell 的 theme。
- 如果发现 PWA 应用已经打开，那么浏览器打开的窗口应该自动聚焦到 PWA 应用；如果聚焦成功，原本在浏览器中打开的页面应该一起自动关闭。这属于用户体验增强。
- 刷新按钮只作用当前激活 Tab。
- app-shell theme 使用独立存储，默认 `system`；dark 模式下不能继续使用当前白色背景的聚焦样式，需要改成 primary 风格并匹配前景色。

## Objective Scope

- 改进 hosted app shell 的 tabs、refresh、iframe loading、theme 隔离和 PWA 聚焦体验。
- 修复当前 refresh 与 iframe reload 语义不一致的问题。
- 收口 versioned iframe route 与 service-worker 的 reload/fallback 行为，避免刷新后落到错误壳页。
- 补充相应的单测与浏览器自动化验证。

## Non-Goals

- 不新增 app-shell 的完整主题设置界面。
- 不实现“刷新所有 tabs”的行为。
- 不修改 iframe 内部 web app 的主题机制本身，只隔离 app-shell 与 iframe 的主题影响。
- 不引入新的 hosted app 域名或新的 launch URL 语义。

## Acceptance Boundary

- 双击 tabs 空白区域能够打开现有的 Add Backend API 流程。
- 顶部刷新按钮会对当前激活 iframe 执行真实 reload，而不是只重新探测 metadata。
- iframe 从可加载到收到 `load` 事件期间会显示 loading 动画；完成后消失。
- iframe 内切换 theme 后，app-shell 外壳主题不跟随变化。
- dark 模式下 app-shell 选中 tab 使用 primary 激活态，而不是白底。
- 当已打开的 PWA app window 接管 launch 时，当前浏览器页面会尝试 `window.close()`；若浏览器拒绝关闭则静默忽略。
- 浏览器自动化能覆盖 tabs 双击、新建 tab、refresh、loading 和 versioned route refresh 的关键路径。
