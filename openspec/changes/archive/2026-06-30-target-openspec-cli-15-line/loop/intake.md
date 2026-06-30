## User Input

> 按规范应该是要发布 5.\* 的版本吧？

（4.1.0 已被错误地发布到 npm——它把 Stores / CLI 1.5 特性作为 4.x minor 发布，违反了版本律。决策：将错就错，补发 5.0.0 作为 CLI 1.5.x 对应的正确大版本。）

## Objective Scope

- 修正版本律为 OpenSpecUI 5.x ↔ OpenSpec CLI 1.5.x（严格 1:1，回归历史惯例：2.x→1.2、3.x→1.3、4.x→1.4、5.x→1.5）。
- `OPENSPECUI_TARGET_MAJOR = 5`；accepted `>=1.4.0 <1.6.0`（1.5 current，1.4 legacy，1.3 及更老 unsupported）；recommended `>=1.5.0 <1.6.0`。
- 更新所有相关测试与用户可见文案（settings 的工具线说明）。
- 以 **major** changeset 发布 5.0.0。

## Non-Goals

- 不 npm unpublish 4.1.0（已发布，将错就错；不撤销）。
- 不改 beta 容错范式、Stores 功能、导航图标/badge。
- 不改 CLI 调用逻辑。

## Acceptance Boundary

- 版本律实现为 5.x（1.5 current、1.4 legacy-compatible、1.3 unsupported）。
- `openspec-compat` / `cli-health-gate` / `settings` 测试与文案同步并通过。
- spec `openspec-cli-integration` 的版本律场景更新为 5.x 严格 1:1，并通过 `openspec validate --strict`。
- major changeset 生成 5.0.0；release workflow 发布成功。
