## Implementation State

- 已创建 feature branch `feat/release-orchestrator-and-dev-website`。
- 已完成 `pnpm dev` 任务定义抽离：新增 `scripts/lib/dev-task-definitions.ts`，并将 `website-dev` 作为默认不自动启动的可选任务接入现有 OpenTUI。
- 已完成 `pnpm release` 的首版 OpenTUI 编排器：新增 release plan/runtime 模块、`scripts/release-tui.tsx`，并将根脚本切换到该编排器。
- 已完成根级脚本测试接线：新增 `scripts/test-root.mjs`、`vitest.root.config.ts`，将 root tests 纳入 `pnpm test:ci`。
- 已完成本地 CI 等价校验：`pnpm format:check`、`pnpm lint:ci`、`pnpm typecheck`、`pnpm test:ci`、`pnpm test:browser:ci` 全部通过。

## Decisions Taken

- `pnpm dev` 继续复用现有 `scripts/dev-tui.tsx` 的 `DevTask`/`autoStart` 模型，不引入新的任务面板抽象。
- `pnpm release` 由新的 OpenTUI 编排器接管，固定执行顺序为 preflight -> publish packages -> wait npm -> build app -> deploy website/app。
- release deploy 计划继续使用保守 diff 规则：`packages/web/src/**` 同时触发 website 与 app deploy 判断。
- `pnpm changeversion` 保持独立；release 编排器只在 changeversion 完成后的 `main` 分支上运行。
- root Vitest 配置改名为 `vitest.root.config.ts`，避免 workspace 包测试误拾取 root include 规则。
- 本 loop 不新增 changeset：当前改动仅涉及 root/tooling 与 private app/website 开发发布体验，没有修改 publishable package 的运行时行为。

## Divergence Notes

- `pnpm test:ci` 首次运行时发现 root `vitest.config.ts` 会污染 workspace 包测试发现，导致包测试误用 root include 规则。
- 该问题未改变范围边界，因此在实现阶段内修复：改用 `scripts/test-root.mjs` + `vitest.root.config.ts`，不回退到 intake/research-plan。
- 当前没有其它偏离已批准方向的实现分叉。

## Loopback Triggers

- 如果 release 编排器需要修改 `changeversion-auto.ts` 的既有职责边界，则回到 intake/research-plan 重新确认。
- 如果 app deploy 的输入不止 npm registry 与本地源码 diff，还需要额外外部状态，回到 research-plan 补充规则。
- 如果 `dev-tui` 现有结构不适合扩展 `website` 或 release TUI 复用，需要回到 research-plan 调整拆分策略。
