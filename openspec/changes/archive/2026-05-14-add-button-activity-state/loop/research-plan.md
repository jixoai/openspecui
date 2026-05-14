## Research Findings

- `packages/web/src/components/button-group.tsx` 已经承担一类共享按钮原子，但它是 segmented single-select control，不适合作为普通 action button 的基础。
- 当前 `packages/web` 没有统一的普通 `Button` primitive；primary action className 分散在 Settings、Config、Notifications、Terminal invocation dialogs 等调用点。
- `Settings > Terminal > Shells` 当前默认 shell 渲染为 `span`，其它 shell 的 `Default` 渲染为 `button`。这造成同一语义在 DOM 层级上分裂。
- `components/notifications/notification-settings.tsx` 的 `Enabled` 与 `Request permission` 共用同一个 button。`Enabled` 语义是“系统通知已经启用”，不应借用 disabled 表达。
- Settings 中多处 Save 按钮使用 dirty-state 决定 disabled，例如 terminal config、dashboard config、git config、CLI command、app base URL。dirty=false 时更接近“已同步”，而不是“操作不可执行”。
- Config 页面也存在相同模式，例如 schema file save、global config save、profile apply 等，但该页面规模大且状态复杂，应优先迁移明确的 dirty/apply-current 场景，避免一次性重构全部按钮。
- 用户已确认 API 方向：不要使用 `variant="activity"`；`activity` 应独立于 `variant`，表达正交状态。

## Decision & Plan (For Approval)

- 新增 `packages/web/src/components/button.tsx`，提供共享 `Button` primitive。
- Button API 采用：
  - `variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'`
  - `size?: 'sm' | 'md' | 'icon-sm' | 'icon-md'`
  - `activity?: boolean`
- `variant` 表达动作意图；`activity` 表达当前状态已经达成。
- `activity` 状态不设置原生 `disabled`，但会设置 `aria-disabled="true"` 并阻止 `onClick`，避免重复触发无意义 action。
- 将明确符合 activity 语义的调用点迁移到 Button：
  - Terminal shell default action。
  - Notification settings enabled action。
  - Settings dirty-state Save/Apply 按钮。
  - Config 中清晰的 dirty-state Save/Apply 按钮。
- 补充 Button unit tests，覆盖 active 状态语义与点击阻断。
- 更新 checkpoints，保持 OpenSpec apply 状态与实际实现同步。

## Capability Impact

### New or Expanded Behavior

- `packages/web` 获得普通 action button 的共享原子。
- Primary button 支持 activity 状态，用于表达“已经启用/已经默认/已经保存/已经应用”。
- 页面可用统一 API 区分 action intent、disabled blocking state、activity fulfilled state。

### Modified Behavior

- 部分 Settings/Config 按钮在“当前已同步”时不再使用原生 disabled。
- 已达成状态的按钮仍以 button 语义呈现，但不会触发 click action。
- 相关按钮文案可从 `Save` / `Apply` 切换为 `Saved` / `Applied` / `Default` / `Enabled`，使状态更明确。

## Risks and Mitigations

- 风险：activity 与 disabled 混用导致行为不清。
  缓解：Button 内部将 `disabled` 作为真实阻塞态优先处理；调用点只在非 pending/非 invalid/非 permission blocked 的已达成状态使用 activity。
- 风险：一次性迁移全部按钮引入视觉回归。
  缓解：只迁移已明确符合语义且样式接近现有 primary/secondary 的按钮；其它按钮保留原样。
- 风险：aria-disabled button 仍可聚焦，可能被误认为可执行。
  缓解：Button 在 activity 下阻止 click，并通过视觉 active state 与状态文案表达当前状态。
- 风险：Config 页面状态复杂，错误迁移可能隐藏真实不可执行状态。
  缓解：只迁移 dirty=false / selected already active 等“已同步”状态；输入非法、mutation pending、运行中仍使用 disabled。

## Verification Strategy

- 单元测试：
  - `pnpm --filter @openspecui/web test -- src/components/button.test.tsx`
  - `pnpm --filter @openspecui/web test -- src/components/terminal/terminal-invocation-settings.test.tsx src/components/notifications/notification-settings.test.tsx`
- 静态检查：
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm format:check`
- 若 scoped checks 暴露跨文件影响，再扩大到 `pnpm --filter @openspecui/web test`。
