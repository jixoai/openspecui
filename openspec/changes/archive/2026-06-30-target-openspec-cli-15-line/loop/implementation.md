## Implementation State

Status: **Not started** — plan approved, implementation pending kickoff.

Pending:

- [ ] `openspec-compat.ts` 常量改 5.x；测试更新。
- [ ] `cli-health-gate.test.tsx` 更新（1.5 current、1.4 legacy、1.3 unsupported、范围 `>=1.4.0 <1.6.0`）。
- [ ] `settings.tsx` 工具线文案动态化。
- [ ] spec delta + changeset (major)。
- [ ] 本地 CI + validate。

## Decisions Taken

- 严格 1:1 版本律（回归历史惯例），5.x ↔ 1.5.x，后向仅支持 1.4.x。
- settings 文案动态引用常量，杜绝未来漏改。
- 4.1.0 不 unpublish，将错就错。

## Divergence Notes

- PR #197 曾把 1.5 塞进 4.x（错误），导致 4.1.0 发布。本 change 修正为 5.x 并补发 5.0.0。

## Loopback Triggers

- （none）
