## User Input

- app 模式现在支持 PWA 了吗？
- PWA 模式下，是独立窗口，我记得有一个特性是可以充分利用顶部的 titlebar 来渲染内容，这部分你有做适配吗？
- 我们 app 目的是进行多开，请问现在如果在多个项目中启用多个实例，能否自动跳转到 PWA 应用内打开一个新 Tab?这个能否做到？还是有什么间接方法？
- 我们的 PWA 相关的还没完成，基于我之前给你的需求，给我一份计划。
- 同意，开始之前，请先在 website 和 app 两个项目中做好 wrangler 的推送支持，以及相关的配置。

## Objective Scope

- 为 `packages/app` 增加可安装 PWA 基线，包括 manifest、安装图标、HTML 接入和安装状态感知。
- 为已安装桌面 PWA 增加 titlebar / window-controls-overlay 适配，让顶部多 Tabs 区可以作为 titlebar-aware 顶栏使用。
- 为 hosted app 增加 Chromium 优先的多实例启动接管能力，使新的 `?api=` 启动请求优先进入现有 app 窗口并映射到内部 tab。
- 保持普通网页模式可用，在不支持 PWA 相关能力的浏览器中优雅回退到当前 hosted shell。
- 在开始 PWA 实现前，完成 `packages/app` 和 `packages/website` 的 Wrangler / Cloudflare Pages 推送支持。

## Non-Goals

- 不承诺所有浏览器、所有系统都能自动复用同一个已安装 PWA 窗口。
- 不引入原生桌面壳、系统守护进程或自定义协议处理器。
- 不重构 `packages/web` 主应用架构，只在 `packages/app` 范围内复用已有组件和逻辑。
- 不在本 loop 内实现完整的网站发布流水线自动化或 Cloudflare 域名管理。

## Acceptance Boundary

- `packages/app` 具备 installable PWA 所需的 manifest 和安装图标接入，且在支持环境下可触发安装入口。
- 已安装桌面 PWA 在支持 `window-controls-overlay` 的环境下，顶部 Tabs/Actions 不遮挡系统窗口控制区；不支持时自动回退。
- 新的 hosted 启动请求在 Chromium 优先路径中，能够通过 `launch_handler` / `launchQueue` / app 内协调逻辑进入现有 app 窗口或在失败时至少不丢失请求。
- 普通浏览器页面仍可通过 `?api=` 正常打开 hosted shell，不因 PWA 增强而失效。
- `packages/app` 与 `packages/website` 已具备 `wrangler pages` 的本地预览与部署命令，且 `packages/app` 的深链接在 Pages 运行时下可回退到对应 channel 的 `index.html`。
