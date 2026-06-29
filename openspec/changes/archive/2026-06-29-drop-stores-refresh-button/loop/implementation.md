## Implementation State

Status: **Implemented** — local checks pass.

Completed:

- [x] 删除 `stores-list.tsx` 的 Refresh 按钮、`useState`/`refreshKey`、`StoresSubscriptionBody`/`StoresSubscriptionBodyInner` 中间层；`StoresList` 直接订阅。清理 import（`RefreshCw`、`useState`）。
- [x] `.changeset/drop-stores-refresh-button.md`（web patch）。
- [x] 本地 CI 检查通过（typecheck/test 534/format/lint）+ `openspec validate --strict`。

## Decisions Taken

- 订阅已自动推送，手动刷新是冗余 + hacky 实现，直接移除。
- spec 同步：reactive 刷新场景去掉 manual refresh 要求，并显式声明不暴露轮询细节。

## Divergence Notes

- （none）

## Loopback Triggers

- （none）
