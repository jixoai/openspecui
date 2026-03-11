## Research Findings

- 当前根级 `pnpm dev` 由 `scripts/dev-tui.tsx` 驱动，内部已经有 `DevTask` / `autoStart` 模型，且已有 `web-tsc-watch` 作为 `autoStart: false` 的可选任务，因此 `website` 可直接接入现有任务表而不需要新交互模型。
- 当前 `scripts/dev-tui.tsx` 已自动启动 `core-dev`、`search-dev`、`server-dev`、`web-dev`、`app-dev`，`website` 尚未接入任务列表。
- 当前根级 `pnpm release` 仍是 `pnpm build && changeset publish`，没有 OpenTUI、多 step 编排、Cloudflare deploy、也没有按需部署判断。
- 当前 `pnpm changeversion` 已由 `scripts/changeversion-auto.ts` 自动完成 branch、PR、等待 CI、合并、同步 main；因此 `pnpm release` 不应重复做版本 bump，而应建立在 changeversion 完成之后。
- `@openspecui/app` 的构建插件 `packages/app/src/vite-plugin-hosted-app.ts` 会调用 `materializeHostedChannels()`；而 `packages/app/src/lib/npm-registry.ts` 会从 npm registry 拉取 `openspecui` tarball，并提取 `package/web/` 到 `versions/<channel>/`。这意味着 app build 必须发生在 npm publish 之后，并且需要等待目标版本在 registry 中可见。
- `packages/app` 和 `packages/website` 都已经具备 `cf:deploy` / `cf:dev` / `cf:project:create` 脚本；Cloudflare deploy 基础能力已存在，缺的是发布编排与是否部署的决策逻辑。
- `packages/website` 与 `packages/app` 都直接复用 `packages/web/src` 的样式和部分组件/主题工具，因此对 `packages/web/src/**` 的改动会同时影响 website 与 app 的部署产物。

## Decision & Plan (For Approval)

- 在 `scripts/` 下新增一个独立的 OpenTUI release 编排器，而不是把复杂逻辑继续堆进现有 `package.json` 命令链。
- 保持根 `pnpm dev` 仍由当前 `scripts/dev-tui.tsx` 驱动，只扩充一个 `website-dev` 可选任务，默认不自动启动。
- 将根 `pnpm release` 重定向到新的 OpenTUI release 编排器；同时保留一个内部 publish 命令，供编排器复用当前的 `pnpm build && changeset publish` 逻辑。
- 在 release 编排器中实现固定步骤：preflight -> publish packages -> wait npm registry -> build app -> deploy website/app -> summary。
- 在 release 编排器中先计算发布计划，再执行步骤：
  - website deploy: diff 命中 `packages/website/**` 或 `packages/web/src/**` 时需要。
  - app deploy: diff 命中 `packages/app/**` 或 `packages/web/src/**`，或本次 release 发布了新的 `openspecui` 版本时需要。
- 失败策略采用停止并保留状态：任何步骤失败后，停止后续步骤，保留日志与可重试信息，不回滚已发布 npm 包。

## Capability Impact

### New or Expanded Behavior

- `pnpm dev` 可以直接从 OpenTUI 首页手动启动 `website`。
- `pnpm release` 将提供可视化的多 step 发布体验，并统一承载 npm publish、app build 与 Cloudflare deploy。
- release 可以按变更范围自动跳过不需要的 website/app deploy。

### Modified Behavior

- 根级 `pnpm release` 不再是单条 shell 命令，而是 OpenTUI orchestrator。
- app 的发布不再由操作者自己记忆顺序，而是被发布编排器强制安排在 npm publish 完成且 registry 可见之后。
- Cloudflare deploy 从手动可选动作提升为 release 流程中的受控步骤。

## Risks and Mitigations

- 风险：发布编排器逻辑过大，和现有 `dev-tui` 代码耦合太深。
  缓解：将 release 编排器拆到独立脚本/模块，复用必要的 TUI 原语，但不直接复制整个 dev 逻辑。
- 风险：按 diff 判断 deploy 目标可能漏判。
  缓解：对 `packages/web/src/**` 采用保守策略，同时影响 website 与 app；宁可多 deploy，不漏 deploy。
- 风险：npm registry 同步延迟导致 app build 偶发失败。
  缓解：在 orchestrator 中加入显式轮询和超时提示，只有 registry 可见后才开始 app build。
- 风险：Cloudflare deploy 鉴权问题在发布中途才暴露。
  缓解：在 preflight 阶段前置检查 wrangler/cloudflare 身份，仅在确实需要 deploy 时才要求通过。

## Verification Strategy

- 局部单元测试：release 计划计算、npm readiness 轮询、失败停止逻辑、`website` 任务默认不自动启动。
- 局部集成验证：`pnpm dev` 首页能看到并手动启动 `website`；`pnpm release` 能在 dry-ish 条件下正确渲染步骤和日志。
- 全仓校验：`pnpm format:check`、`pnpm lint:ci`、`pnpm typecheck`、`pnpm test:ci`、`pnpm test:browser:ci`。
- 管理者验收重点：release 界面中的 step 顺序、skip 原因、失败停止行为，以及 app 构建确实发生在 npm publish 之后。
