## User Input

<user>下一步的计划是什么？</user>

<assistant>下一步我建议不要马上碰 Vite builder，而是开一个实现型 change：`add-dev-conditional-export-runtime-law`。目标是先把“开发期源码解析、发布期 dist 解析”变成平台法则。

计划分三步：

1. 先补 BDD 红灯
   - 证明 `tsx` 默认仍解析到 `dist`。
   - 证明显式 `NODE_OPTIONS=--conditions=development` 后，workspace self-reference 解析到 `src/*.ts`。
   - 证明 packaged/default mode 仍解析到 `dist/*.mjs`。
   - 证明 worktree handoff 的 child runtime 继承同一套 dev condition。

2. 再改最小平台配置
   - 给 `openspecui`、`@openspecui/server`、`@openspecui/core` 的 exports 增加 `development` 分支。
   - 统一 dev script，确保源码运行入口显式带 `NODE_OPTIONS=--conditions=development`。
   - 消掉当前 `runtimeDir/src/dist` 手写判断能覆盖的那部分职责，但保留 packaged fallback。
   - 不替换 tsdown。

3. 验收
   - 跑 resolver BDD tests。
   - 跑 CLI/worktree handoff focused tests。
   - 跑相关 package typecheck。
   - 做一次真实进程验收：main 源码服务切 worktree 时，child health 带 capability，并且没有走 stale dist。
   - OpenSpec validate。

我建议先把当前 `harden-worktree-handoff-protocol-tests` 的修复和翻译脏改隔离清楚，再开始这个新实现 change。否则三个主题混在同一个 main checkout，风险会很高。</assistant>

<user>continue</user>

## Objective Scope

- Implement a platform law where workspace development runtime resolution explicitly selects TypeScript source via Node conditional exports, while default/published runtime resolution selects built `dist` artifacts.
- Add BDD tests before implementation for package self-reference resolution, dev condition behavior, default dist fallback, and worktree child runtime inheritance.
- Apply the law to the Node-facing packages that currently participate in the source/dist drift: `openspecui`, `@openspecui/server`, and `@openspecui/core`.
- Keep `tsdown` as the package builder.
- Ensure worktree handoff uses the same runtime condition law instead of relying on stale local `dist` when the parent is running from workspace source.
- Preserve packaged/npm behavior for users who do not opt into the `development` condition.
- Keep changes isolated from active document translation work and the existing worktree handoff compatibility change.

## Non-Goals

- Do not replace `tsdown` with Vite, Rolldown, or Vite SSR library mode in this change.
- Do not migrate worktree sibling servers from `child_process` to `worker_threads`.
- Do not change Web/App/Website Vite build configuration.
- Do not archive or release existing changes in this loop.
- Do not rely on Bun or Deno supporting the same `development` condition behavior unless separately verified and encoded.
- Do not introduce package-specific hacks that bypass package exports as the new platform law.

## Acceptance Boundary

- A BDD resolver test demonstrates that default package resolution selects `dist` for package self-reference/subpath imports.
- A BDD resolver test demonstrates that explicit `development` conditions select source `.ts` entries in a workspace-symlink style package.
- `openspecui`, `@openspecui/server`, and `@openspecui/core` package exports expose `development` branches for the required public entries without breaking default exports.
- Development scripts that run source TypeScript explicitly enable `development` conditions.
- Worktree handoff command creation or runtime propagation has BDD coverage showing child development runtime inherits the development condition.
- Focused CLI/worktree tests pass.
- A process-level smoke test confirms a source-mode handoff child advertises the expected runtime capabilities and is not started from stale `packages/cli/dist/cli.mjs`.
- Relevant package typechecks pass.
- `openspec validate --all --strict --no-interactive` passes.
