## Research Findings

- 当前 `packages/web/src/components/switch.tsx` 使用 `@base-ui/react/checkbox` 实现，DOM role 是 `checkbox`，测试也通过 `getByRole('checkbox')` 查询。
- 用户要求的法则是：Switch/Toggle 用于“开关”含义；Checkbox 用于“选中与否”含义。
- `Settings > Terminal > Cursor Blink` 当前是页面内手写按钮，不复用共享 `Switch`。
- 全局扫描未发现真实 `input type="checkbox"` 源码用法；主要布尔控件都通过现有 `Switch` 组件表达。
- 现有 `Switch` 调用点中，以下是明确开关语义：
  - `Settings > Terminal > Cursor Blink`
  - Verify strict mode
  - Global archive skip specs / skip validation flags
  - Config profile auto-update after apply
  - Terminal command form boolean option widgets
  - Spawn command builder field `advanced` / `required`
- 当前测试中一些开关控件仍以 checkbox role 断言，例如 terminal spawn dialog 的 `Skip permissions`，需要改为 switch role。
- `@base-ui/react@1.3.0` 当前依赖目录中没有 `switch` primitive；可用原生 button + `role="switch"` 实现项目标准 Switch。

## Decision & Plan (For Approval)

- 保持组件名 `Switch`，将其实现从 Base UI Checkbox 改为项目标准 switch primitive。
- `Switch` 使用 `<button type="button" role="switch" aria-checked={checked}>` 暴露可访问语义。
- 支持 `id/name/required` 时渲染隐藏 input，用于保留表单提交能力；开关本身仍是 button，不再是 checkbox role。
- 用横向 track + thumb 的视觉样式替代方形 checkbox 样式。
- 将 Cursor Blink 手写按钮迁移为 `Switch`。
- 更新所有明确开关语义测试，从 `checkbox` role 改为 `switch` role。
- 保留真正选择语义场景为 checkbox；本轮扫描未发现需要新建 Checkbox 组件的真实源码调用点。

## Capability Impact

### New or Expanded Behavior

- 项目拥有语义正确的标准 Switch/Toggle 组件。
- 开关型布尔设置可被屏幕阅读器识别为 switch。
- Cursor Blink 与其它开关型设置共享同一组件法则。

### Modified Behavior

- 现有 `Switch` 调用点的 ARIA role 从 `checkbox` 变为 `switch`。
- 相关单测和交互查询需要从 `getByRole('checkbox')` 更新为 `getByRole('switch')`。

## Risks and Mitigations

- 风险：某些 schema boolean 字段可能语义上是“选中与否”，不是开关。
  缓解：本轮只迁移明确 toggle/enable/required/advanced/strict/skip 类行为；若后续出现 checklist/多选列表，保留或新增 Checkbox 组件。
- 风险：从 Base UI Checkbox 改为 button 可能影响 form submit。
  缓解：当 `name` 存在时渲染 hidden input，并保留 required/disabled/readOnly 处理。
- 风险：测试仍按 checkbox role 查询。
  缓解：全局搜索 `getByRole('checkbox')` / `queryByRole('checkbox')` 并更新明确开关测试。

## Verification Strategy

- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/switch.test.tsx src/components/terminal/terminal-command-form.test.tsx src/components/terminal/terminal-spawn-command-dialog.test.tsx`
- `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/opsx-verify.test.tsx src/components/global-archive-modal.test.tsx` if those tests exist after inspection.
- `pnpm --filter @openspecui/web exec tsc --noEmit --pretty false`
- `pnpm --filter @openspecui/web exec prettier --check` on changed files and OpenSpec artifacts.
