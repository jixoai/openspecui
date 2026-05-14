## User Input

- 做好commit和archive。继续做下一个UI修复：
- 我发现 Cursor Blink 这个设置这里，你做了一个Switch组件，请将它提升成本项目的标准的Switch组件。
- Switch（或者也叫Toggle）组件用于“开关”的含义
- checkbox 组件用于“选中与否”的含义
- 升级完成后，检查全局的 input-Checkbox，然后进行升级：哪些应该要用Swtich，哪些应该用checkbox

## Objective Scope

- 将现有 `Switch` 提升为项目标准开关组件，用于功能开/关、模式启用/禁用等 toggle 语义。
- 确保 `Switch` 暴露 switch 语义，而不是 checkbox 语义。
- 将 Settings > Terminal > Cursor Blink 从页面内自制按钮迁移到标准 `Switch`。
- 扫描 `packages/web` 中的 checkbox/switch 用法，按语义迁移：
  - 开关语义使用 `Switch`。
  - 选中/多选语义保留 checkbox 或后续 Checkbox 组件。
- 更新相关测试断言，使开关测试查询 `role="switch"`，选择语义测试查询 `role="checkbox"`。

## Non-Goals

- 不重构所有表单控件。
- 不改变业务配置字段、命令参数 schema 或持久化格式。
- 不引入新的 UI 依赖。
- 不把“多选列表/选中项”错误迁移为 Switch。

## Acceptance Boundary

- `Switch` 组件使用开关语义，可通过 `getByRole('switch')` 查询。
- Cursor Blink 使用标准 `Switch`。
- 全局 checkbox/switch 用法被审计，并迁移明确的开关语义调用点。
- 真实“选中与否”的场景仍保持 checkbox 语义。
- 相关 tests/typecheck/format checks 通过。
