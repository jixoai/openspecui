## Research Findings

- 版本律历史惯例（提交 `b8d85f9 feat: target OpenSpec CLI 1.4.x line with OpenSpecUI 4.x`）确认是严格 1:1：每个 OpenSpecUI major 对应一个 CLI minor。
- 之前的实现（PR #197）错误地把 1.5.x 塞进 4.x accepted range，导致 4.1.0 发布（含 Stores）。
- `openspec-compat.ts` 用 `isCurrentRecommended`（区间）+ `isSeries(LEGACY_SERIES)` 双分支判定。5.x 下：current=1.5.x，legacy=1.4.x，其余 unsupported。
- 用户可见文案：`settings.tsx` 硬编码了"OpenSpecUI 4.x uses OpenSpec CLI 1.4.x"——改为动态常量，避免未来再漏改。
- `cli-health-gate.tsx` 用常量渲染，自动跟随。

## Decision & Plan (For Approval)

- 常量：`TARGET_MAJOR=5`、`LEGACY_SERIES='1.4'`、`MIN_VERSION='1.4.0'`、`RECOMMENDED_MIN_VERSION='1.5.0'`、`ACCEPTED_RANGE='>=1.4.0 <1.6.0'`、`RECOMMENDED_RANGE='>=1.5.0 <1.6.0'`、`LEGACY_RANGE='>=1.4.0 <1.5.0'`。
- 测试：openspec-compat（1.5 current、1.4 legacy、1.3 unsupported）、cli-health-gate（默认 1.5 current、1.4 legacy、1.3 unsupported、范围 `>=1.4.0 <1.6.0`）。
- settings.tsx：动态化工具线文案。
- spec delta：openspec-cli-integration 版本律场景改 5.x 严格 1:1。
- changeset：major（5.0.0）。

## Capability Impact

### Modified Behavior

- 主版本线从 4.x → 5.x；1.3.x 不再被支持（5.x 只后向支持 1.4.x）。

## Risks and Mitigations

| 风险                      | 缓解                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| 1.3.x 用户被阻塞          | 这是版本律的有意行为（每条线只后向支持上一条）；门禁会给出升级指引。 |
| 4.1.0 与 5.0.0 并存于 npm | 接受（将错就错）；5.0.0 为正确线，后续维护走 5.x。                   |

## Verification Strategy

- `pnpm --filter @openspecui/core test`、`--filter @openspecui/web typecheck/test`、`format:check`、`lint:ci`。
- `openspec validate target-openspec-cli-15-line --type change --strict`。
- changeversion → release workflow 发布 5.0.0 成功。
