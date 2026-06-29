## Research Findings

- `packages/web/src/routes/stores-list.tsx` 当前有一个 Refresh 按钮，onClick 递增 `refreshKey`，通过 `key={refreshKey}` 重建 `StoresSubscriptionBodyInner` 子树来重建订阅。
- 订阅（`useStoresSubscription` → `stores.subscribe`）在挂载时立即拿首推，之后由 server 每 5s 推送。手动刷新仅是"提前几秒"拿到下一次推送，价值低。
- spec `opsx-ui-views › Stores Discovery Panel (Beta) › Refresh store list reactively` 当前要求 `SHALL offer a manual refresh control`，删除按钮需同步改 spec。

## Decision & Plan (For Approval)

- 删除 Refresh 按钮及其 `useState`/`refreshKey`/`StoresSubscriptionBody`/`StoresSubscriptionBodyInner` 中间层，`StoresList` 直接订阅渲染（恢复最简形式）。
- spec delta：MODIFY `opsx-ui-views` 的 Stores Discovery Panel，把 reactive 刷新场景改为"不暴露轮询细节、不提供手动刷新控件"。
- 测试不变（已 mock `useStoresSubscription`，不依赖按钮）；清理 import（`RefreshCw`、`useState`）。

## Capability Impact

### Modified Behavior

- Stores 面板移除 Refresh 按钮，纯靠订阅自动更新。

## Risks and Mitigations

| 风险             | 缓解                                                                |
| ---------------- | ------------------------------------------------------------------- |
| 用户想要立即刷新 | server 每 5s 推送，等待极短；如未来确需可再加 server 端触发式刷新。 |

## Verification Strategy

- `pnpm --filter @openspecui/web typecheck`、`test`、`format:check`、`lint:ci`。
- `openspec validate drop-stores-refresh-button --type change --strict`。
