## User Input

- 部署到 Cloudflare Pages 的 hosted app 页面可以打开，但通过 `?api=` 启动时，新的 tab 往往不会立刻出现，刷新后才会出现。
- 已安装 PWA 后，通过浏览器的“在应用中打开”将链接转交给 PWA，重新聚焦后也不能立刻看到新的 tab，刷新后才出现。
- 可以考虑引入 BroadcastChannel，并在写入数据后广播让其它同域实例立刻刷新；必要时再用轮询做兜底。
- PWA 图标构图有问题，图形没有铺满并居中。
- 应用头部默认没有嵌入到标题栏；手动嵌入后标题栏背景是白色，没有和黑色 terminal 顶栏融合。
- `/versions/v2/index.html` 的问题不需要改变产品语义，重点是根壳内 iframe 没有正确显示内容。
- Cloudflare Pages 预览域名联调继续使用显式 `--app=<preview-url>`，不要放开通配 CORS。

## Objective Scope

- 修复 hosted app 在普通网页与已安装 PWA 多实例之间的 tab 状态同步，让由其它实例处理的 launch 也能在当前实例中立即可见。
- 保留现有 launch relay 语义，并增加事件驱动同步与短时兜底同步。
- 修复 hosted app 的 PWA 图标资源。
- 修复 hosted app 标题栏 / overlay 激活后的视觉融合和主题色元数据。
- 补充必要测试与 README 说明。

## Non-Goals

- 不改变 `/versions/<channel>/index.html` 的 hosted 入口语义。
- 不放开 `*.pages.dev` 通配 CORS。
- 不引入新的原生壳或复杂图标生成流水线。

## Acceptance Boundary

- `?api=` 启动请求即使被转发给其它同域实例处理，当前实例也能无刷新同步出新的 tab。
- 已安装 PWA 接收新的 launch 请求后，现有窗口能立即显示新的 tab。
- PWA 图标在系统 / 应用切换器中居中且比例正确。
- overlay 启用时标题栏背景与 terminal 顶栏融合，不再出现白色断层。
- 相关单测覆盖跨实例同步与 PWA 元数据更新。
