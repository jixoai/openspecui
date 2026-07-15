<!--
Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
1. Bootstrap repository agents through CLAUDE.md.
2. Enforce protected-branch, PR, CI, and release delivery policy.
3. Protect static/SSG behavior and shared live/static projections.
4. Preserve the verified OpenSpec adaptation baseline while implementing the 1.6.0 line.
5. Fix App, project workspace, and OpenSpec runtime-environment ownership for the 1.6 adaptation.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。你先了解项目，然后更新 references/openspec，然后使用 $wayfinder 和我讨论具体的适配计划。我们最终使用openspec来管理 wayfinder 产出的文档。"
Original request (2026-07-15): "我个人的想法，是把 --app 模式提上日程。因为 app 模式提供了多标签管理。它天生适合多项目管理的这种场景。"
Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。这样后端接口就必须带上这个 http header。"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
Original request (2026-07-15): "我们刻意开发了一个响应式内核，这是 openspecui 对 openspec 最大的增强。操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
Original request (2026-07-15): "统计信息仍然有一定的间接价值。"
Original request (2026-07-15): "理论上是要的，你觉得呢，工作难度大不大？这是额外的工作还是可以和 live 版本保持尽可能的一致？"
Original request (2026-07-15): "你先负责后端（内核）的开发，我让ClaudeCode先帮你吧前端相关的代码先初步做一下，等一下你在它的基础上继续接手开发。"
-->

MUST READ: CLAUDE.md

## Branch Protection Policy

- `main` is protected. Do not push commits directly to `main`.
- All code changes must be submitted via Pull Request from a feature branch.
- Merge to `main` only after required CI checks pass.
- For PRs that change publishable packages, include a `.changeset/*.md` file.  
  Exception: docs-only or CI-only changes that do not affect package behavior.

## Delivery Workflow

- Always run CI-equivalent local checks before opening/updating a PR.
- Required local checks (match CI gates): `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci` (or a clearly scoped subset when changes are package-local and justified in PR notes).

## Static/SSG Guardrails

- Never trust old `dist-ssg` outputs when validating static UI changes.
- For any static/export/config/dashboard change, always rebuild SSG before judging results:
  - `pnpm --filter @openspecui/web build:ssg`
- If behavior looks unchanged, clean stale artifacts first, then rebuild:
  - `rm -rf packages/web/dist-ssg packages/web/.vite`
  - `pnpm --filter @openspecui/web build:ssg`
- Browser-target code in `packages/web` must not runtime-import `@openspecui/core` root entry.
  - Allowed pattern: `import type { ... } from '@openspecui/core'`
  - Runtime helpers must use safe subpath entries (example: `@openspecui/core/opsx-display-path`).
- If static snapshot structure changes, update these together in one PR:
  - `packages/core/src/export-types.ts`
  - `packages/cli/src/export.ts`
  - `packages/web/src/lib/static-data-provider.ts`
  - related tests in `packages/web/src/lib/static-data-provider*.test.ts`
- Static and live modes must share the same display/mapping logic; do not introduce parallel implementations unless explicitly required.
- Static-related completion check (minimum):
  - `pnpm --filter @openspecui/web test -- src/entry-client-static.test.tsx src/lib/static-data-provider.opsx.test.ts`
  - `pnpm --filter @openspecui/web build:ssg`

### Community Contributor Mode

- Do not open/update a PR until local CI-relevant checks pass.
- After PR is open, wait for maintainer review and merge decision.

### Manager Mode (Gaubee)

- Do not open/update a PR until local CI-relevant checks pass.
- After required PR checks pass, auto-merge to `main`.
- After merge to `main`, ask manager whether to release.
- If manager confirms release:
  1. run `pnpm changeversion`
  2. wait for the changeversion PR checks to pass
  3. auto-merge the changeversion PR
  4. wait for GitHub Actions `release.yml` on `main` to publish packages and push tags
  5. notify manager only after the GitHub release automation succeeds

## OpenSpec 1.6 Adaptation Baseline

- `references/openspec` is the official upstream submodule and currently targets exact tag `v1.6.0` (`e1b51d1`).
- The shipped line is OpenSpecUI 5.x nominally targeting OpenSpec CLI 1.5.x. Version compatibility alone is not proof of feature completeness: the 1.4 `sync` core-profile change and the 1.5 resolved-root/Stores contract must be audited as part of the 1.6 plan. The established version law is one OpenSpecUI major per OpenSpec CLI minor; the 1.6 adaptation therefore plans the next major line unless an explicit decision changes that law.
- OpenSpec CLI remains the workflow source of truth. Prefer CLI JSON and exit status over parallel parsers or inferred workflow state.
- OpenSpec 1.6 adds the `update` planning workflow, Oh My Pi support, Trae command delivery, stricter archive/validate behavior, and tracked-task glob resolution. Audit profile workflows, tool initialization state, public workflow hooks, UI actions, validation/archive contracts, and task projection together.
- OpenSpec 1.6 tracked-artifact progress and OpenSpecUI's schema-wide checklist aggregate are different facts. The planning decision is recorded: only `trackedTaskProgress` drives workflow state; `documentChecklistSummary` remains secondary analytics, and `applyInstructionProgress` preserves the raw Apply result.
- The adaptation is tracked by `openspec/changes/target-openspec-cli-16-line/`. Wayfinder research, maps, and tickets live under that change's `wayfinder/` directory, then converge one-way into formal OpenSpec artifacts under `loop/` when implementation scope is settled.
- The product model has three layers: root-correct operation on the single CLI-selected planning root; context-aware presentation of read-only References; and higher-level Store/Context/Workset orchestration. Root correctness and Reference-aware project surfaces form the 6.0 correctness baseline. App-native Store administration remains experimental and is not a 6.0 release gate; Workset orchestration remains out of scope. Do not describe Stores as a package-monorepo graph.
- OpenSpec 1.6 `references:` resolves registered Store identities, not raw paths. `store setup` targets standalone planning repositories and rejects paths nested inside an existing Git repository, but `store register` can promote an existing healthy root inside a monorepo even when that root has no `.git` of its own. A Store is therefore not strictly one-to-one with a Git boundary. `store:` remains a fallback for a config-only root rather than a link between two writable roots.
- Store registration is user/machine-local and shared across projects by default at the XDG/global data location; OpenSpec has no project-local registry and `references:` never auto-registers. `XDG_DATA_HOME` can isolate a process environment's registry, but that is an environment boundary rather than a committed project declaration. Use the CLI registration path as the supported mutation surface because it validates identity/root health, canonicalizes paths, detects conflicts, and locks registry writes.
- `XDG_DATA_HOME` selects the whole OpenSpec user-data root: Store registry, Worksets, and user schema overrides. It is a single replacement scope, not a global-plus-project overlay. Do not expose it as `StoreRoot` or silently place it at the project root, where `${XDG_DATA_HOME}/openspec/schemas` collides semantically with project schemas.
- Any project-scoped OpenSpec data design must keep CliExecutor, workflow invocations, embedded terminals, and Agent-executed OpenSpec commands on the same effective scope. Do not load unrestricted repository-owned environment variables into PTYs or general subprocesses; a project `.env` is a trust boundary, and generic XDG injection affects non-OpenSpec programs too.
- Decision (2026-07-15): OpenSpecUI inherits the launch environment's `XDG_DATA_HOME` and preserves it across every OpenSpec execution surface. Do not add `openspec/.env`, generic `config env`, `StoreRoot`, project registry synthesis, or registry overlay behavior in the 1.6 adaptation. Lock existing CLIExecutor/PTY inheritance with tests; treat any future data-scope manager as a separate product change.
- `packages/app` owns persistent project-backend connections, runtime-environment identity, and cross-project entry points. One App tab hosts one project backend; App does not duplicate Change, Spec, Config, Git, or Terminal workflows.
- `packages/web` owns one launch project's workspace and every operation against that project's single CLI-resolved planning root. References extend its read-only spec context; they do not create multiple writable roots inside one project tab.
- Store mutation is OpenSpec runtime-environment scoped, not project scoped. App-native Store management requires a selected online environment and a backend protocol that exposes stable environment identity and CLI-backed Store capabilities. The project Web surface may show Store and Reference diagnostics but must not imply that its registry is project-local.
- Decision (2026-07-15): `--app` remains an explicit experimental mode, so production Store Manager is not a 6.0 release gate. A throwaway Store Manager prototype is nevertheless required before formal specs converge because environment-scoped Store administration closes the App product story.
- Implement the eventual Store Manager as App-native routes inside `packages/app`, alongside Home/Connections, Environment, and App settings. Do not add extra HTML entries to `packages/web` or extract a new package until a stable environment/Store protocol module is genuinely shared by multiple consumers.
- Decision (2026-07-15): Store Manager uses the Store Inspector (`B`) as its primary interaction, the Context Matrix (`C`) as a sibling Context view, and the Registry Table (`A`) as a wide-screen Inventory view. Do not collapse Root/Reference relationships into the destructive-operation inspector or make the table the only navigation model.
- Decision (2026-07-15): Any connected backend that satisfies the hosted protocol may participate in Store Manager; do not restrict the domain model to loopback backends. OpenSpec remains local to the backend host and its inherited data scope. App must not infer trust from URL locality or implement registry semantics itself.
- Decision (2026-07-15): The hosted protocol names runtime-environment identity `envUri`. It is a backend-issued, opaque, non-dereferenceable URI identifying the combination of backend host identity and effective OpenSpec data home. Multiple backend processes, projects, ports, and API URLs share one `envUri` when that pair is unchanged; changing host or data home changes it. `apiBaseUrl` remains the backend-instance locator, and App must neither construct `envUri` nor expose raw host/data-home values through it.
- Decision (2026-07-15): OpenSpecUI may optionally protect one backend with a single shared **Backend Access Gate** enabled by CLI `--auth` or `--password`. This is not a user, role, ACL, permission, or multi-tenant system. Without either flag, the current unguarded behavior remains unchanged.
- The Access Gate has one canonical credential form: `Authorization: Bearer <credential>`. `--auth` generates a high-entropy credential and prints the complete header; `--password` normalizes an operator-supplied secret into the same Bearer form. Prefer a hidden prompt when `--password` has no inline value; warn that `--password=...` can leak through shell history and process inspection.
- When enabled, the Access Gate covers the whole backend boundary: `/api/*`, HTTP tRPC, tRPC subscriptions, PTY WebSocket, files, terminal, notifications, and future Store operations. HTTP uses the Authorization header, tRPC WebSocket uses connection parameters, and PTY WebSocket authenticates in its first message before any command is accepted.
- Capability discovery only states which hosted-protocol features a backend implements; it never grants access. App may receive an auto-launched credential once through a URL fragment, must remove the fragment immediately, and must keep the credential in session memory rather than query parameters, persisted tabs, or `localStorage`.
- The Access Gate does not provide transport confidentiality. Any non-loopback deployment protected this way requires HTTPS/WSS; exposing the credential over plaintext transport is unsupported.
- Decision (2026-07-15): Store protocol discovery uses three product-level capabilities: `stores.inspect` for list/detail/doctor projections, `stores.mutate` for setup/register/unregister/remove execution, and `contexts.inspect` for project Root/Reference relationships. Do not mirror every CLI subcommand as a capability.
- Runtime capabilities are objective compatibility facts, not permissions or inferred workflow state. Protocol-version requirements decide whether a backend can connect; optional capabilities decide which surfaces can render. Operation applicability and failure reasons must come from CLI results and diagnostics rather than additional frontend capability inference.
- OpenSpecUI is an objective visual projection of OpenSpec. Preserve upstream field meanings, diagnostics, exit status, and uncertainty; presentation may summarize facts but must not silently invent health, ownership, completeness, synchronization, or authorization conclusions.
- Decision (2026-07-15): Store Inventory projects `openspec store list --json`, Store Inspector projects `openspec store doctor [id] --json`, and each project Context projects `openspec context --json`. Hosted envelopes may add provenance such as `envUri`, CLI version, observation time, and exit status, but must not replace or reinterpret upstream payload facts.
- Context Matrix is an observed-only App projection joined by `envUri` and Store id across online connected projects. It is not a machine-wide reverse index. Say "observed references" or "no reference currently observed", never "all references" or "unreferenced". Offline projects are unknown unless a last-observed snapshot is shown explicitly with its timestamp and stale state.
- Do not scan the backend filesystem for projects or create an OpenSpecUI-owned project-to-Store registry. Such discovery would invent completeness and ownership semantics absent from OpenSpec.
- Decision (2026-07-15): Store mutations are backend-owned operations with `accepted -> running -> succeeded | failed` lifecycle. Client disconnect only detaches observation; it does not kill the CLI. Loss of a recoverable terminal result is `indeterminate`, never fabricated as failure or cancellation. V1 exposes no mutation Cancel and performs no automatic mutation retry.
- A client request id deduplicates mutation starts within one backend process. Final results preserve CLI JSON, diagnostics, stdout/stderr, and exit status. Every terminal or indeterminate outcome invalidates affected projections before they are pulled again.
- The reactive kernel is OpenSpecUI's primary consistency enhancement over OpenSpec. Changes produced by CLI mutations or external filesystem activity must invalidate the affected `envUri` Store/Context facets; all subscribed clients then pull fresh CLI-owned projections. Push notifications carry invalidation, not a competing copy of Store truth.
- The reactive observation domain must include the effective OpenSpec data home and dynamically registered Store roots in addition to the launch project. Replace the current Store-specific five-second polling path with multi-root reactive observation; polling is only a watcher-failure or missing-path fallback.
- Normally, one endpoint's successful change reaches other endpoints sharing the same `envUri` before their next action. Only genuinely concurrent submissions remain for OpenSpec registry locking and diagnostics to arbitrate. Duplicate invalidations are harmless and must be coalesced or treated idempotently.
- Decision (2026-07-15): Split task data into `trackedTaskProgress`, `documentChecklistSummary`, and `applyInstructionProgress`; remove the ambiguous generic `progress` contract without a compatibility alias.
- `trackedTaskProgress` follows OpenSpec 1.6's tracked-artifact glob semantics and alone drives global task counts, workflow phase, completion notifications, and task-status labels. `0/0` means `no-tasks`, never complete; archive readiness remains a CLI validate/archive outcome.
- `documentChecklistSummary` preserves the indirect statistical value of checkboxes across all schema documents. Show it as visibly secondary analytics, grouped by artifact/file where possible, for planning inspection and residual-checklist discovery. It never changes readiness, notifications, or workflow state.
- `applyInstructionProgress` preserves the raw `openspec instructions apply --json` result for the Apply surface. When its literal-path behavior differs from tracked glob progress, attribute both sources and show the divergence instead of silently normalizing it.
- Decision (2026-07-15): Live and static modes share one source-aware Spec Catalog. Spec identity is compound: owned Specs use `(owned, specId)` and referenced Specs use `(referenced, storeId, specId)`. Routes, cache keys, search records, provider lookups, and SSG enumeration must preserve that full identity; never treat `specId` as globally unique.
- Static export supports only direct Reference Specs declared by the active CLI-resolved planning root. Materialize them through official `openspec list --specs --store <id> --json` and `openspec show <spec-id> --type spec --store <id>` paths; never walk transitive References, read the registry directly, or export referenced changes, archives, config, Git state, and unrelated Stores.
- Decision (2026-07-15): When effective References exist, static export requires `--references=include|omit`. Missing policy stops the export. `include` requires complete successful materialization and must not publish partial output; `omit` retains an explicit omission state rather than pretending no References exist.
- Static Reference snapshots retain compound Spec identity, Store id for included content, source/read-only state, and observation time. Remove absolute paths (including `meta.projectDir`), registry/data-home paths, remote URLs, backend/environment identity, and raw path-bearing diagnostics. An omitted export exposes only the omission state and aggregate count, not unpublished Store identities.
- Decision (2026-07-15): The OpenSpec 1.6 Wayfinder map is complete. Formal implementation truth now lives in `openspec/changes/target-openspec-cli-16-line/loop/{intake,research-plan,implementation,checkpoints}.md` under the declared `opsx-collab-pr-loop` schema. Keep `wayfinder/` as decision provenance; do not maintain it as a parallel execution plan.
- The repository-local OpenSpec artifact CLI currently reports 1.5.0 while the product target and `references/openspec` authority are 1.6.0. Use the local CLI to follow the declared artifact schema, but verify product behavior against the pinned 1.6 source, executable contracts, JSON, and exit status.
- Implementation baseline (2026-07-15): Section 2 CLI 1.6 contract baseline is complete at 11/11 on `feat/openspec-cli-16-contract-baseline`. Typed CLI evidence, 1.4-1.6 workflow/tool regressions, 6.x compatibility guidance, strict validate/archive behavior, Update/Sync Web actions, multiline Requirement rendering, and scenario-loss diagnostics pass all required local gates in an isolated clean worktree. The slice is not merged; do not claim Section 3+ production contracts from parallel skeleton files.
- A typed CLI command result preserves parsed command data, the raw JSON document, stdout, stderr, structured diagnostics, process success, and exit status as separate facts. Contract validation may report missing required semantics but must not discard raw evidence; additive fields remain accepted.
- First-party executable evidence against `references/openspec@e1b51d1` covers nearest/declared/explicit roots, self/missing/direct References, empty healthy Stores, multiline Requirements, proposal-less nested validation failure, and scenario-loss archive failure. Keep the source/tag regression tests alongside adapter fixtures so the version gate cannot substitute for feature completeness.
- Temporary work allocation (2026-07-15): Codex owns the backend/kernel slice while ClaudeCode drafts frontend/App surfaces in the shared worktree. This does not change architectural ownership. Preserve concurrent changes; exclude unreviewed Section 3+ skeleton files from the Section 2 PR.
- Verification boundary (2026-07-15): ClaudeCode's uncommitted App skeleton currently has a `ConnectionsRoute` external-store snapshot update loop and is not part of the Section 2 commits. The committed baseline App passes 38/38 tests in the isolated worktree; do not attribute the concurrent draft failure to this PR or include its lockfile/navigation changes as a workaround.
- Execute `loop/checkpoints.md` in order and continuously synchronize actual progress, verification evidence, and approved divergences into `loop/implementation.md`. Any listed loopback trigger requires manager re-approval before continuing.
