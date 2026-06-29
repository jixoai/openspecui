## User Input

> Store 页面的 Refresh 按钮是不是可以删掉了

## Objective Scope

- 删除 Stores 面板的 Refresh 按钮。订阅已是 server 端每 5 秒自动推送，手动刷新价值很低，且当前实现用 refreshKey 重建整个订阅子树（hacky）。
- 同步更新 `opsx-ui-views` spec 的 "Refresh store list reactively" 场景，去掉 manual refresh 要求。

## Non-Goals

- 不改 server 端 `stores.subscribe` 的轮询行为（仍每 5s 推送）。
- 不改其它面板的刷新机制。
- 不改 beta 容错范式（异常一/异常二处理不变）。

## Acceptance Boundary

- Stores 面板无 Refresh 按钮，无 refreshKey 重建逻辑；订阅挂载即拿首推，之后自动更新。
- `openspec validate drop-stores-refresh-button --type change --strict` 通过。
- 本地 CI 等价检查通过；含 `.changeset/*.md`（web patch）。
