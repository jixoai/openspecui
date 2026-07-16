<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Report implementation state without converting planning work into false code progress.
2. Preserve approved architecture decisions as implementation constraints.
3. Record actual divergences from the approved plan.
4. Define conditions that require returning to intake and research-plan.
5. Record independent review findings and the evidence required to close them.

Original request (2026-07-14): "我们最终使用openspec来管理 wayfinder 产出的文档。"
Original request (2026-07-15): "解决方案可能没你想的那么简单，这点我们后续再说。"
Original request (2026-07-16): "代码已经提交，开始review。如果有问题，那么可更新change甚至可以新开change。"
-->

## Implementation State

Status: **Independent re-review corrections are complete and locally verified; PR #207 awaits refreshed CI and re-review before later checkpoints continue**.

Completed before code execution:

- Updated `references/openspec` to official `v1.6.0` (`e1b51d1`).
- Audited upstream 1.4 through 1.6 source, tests, changelog, and agent contracts.
- Closed the Wayfinder decisions for data scope, App/project ownership, Store Manager information architecture, hosted environment protocol, task projections, and static Reference export.
- Converted those decisions into `loop/intake.md` and `loop/research-plan.md` under the declared `opsx-collab-pr-loop` schema.
- Produced and selected the Store Inspector + Context Matrix + Inventory prototype composition.

At the end of the planning pass, no production TypeScript, package manifest, test, generated asset, changeset, or runtime behavior had changed. Implementation then began with Phase 1 from `loop/research-plan.md`: CLI contracts and 1.4-1.6 compatibility fixtures.

After implementation begins, append timestamped progress entries here after every merged or materially reviewed slice. Each entry must identify changed contracts, focused verification, unresolved facts, and any checkpoint state changes.

## Progress: 2026-07-15 CLI contract kernel

Changed contracts:

- Advanced the core compatibility law to OpenSpecUI 6.x targeting CLI 1.6.x, with 1.5.x as the only legacy-compatible line. Checkpoint 2.1 remains open until frontend tests and all user-facing guidance converge.
- Added command-specific Zod adapters for root-aware list/show/status/instructions, Store list/doctor/mutations, root Doctor, Context, validate, and archive. Parsed data, raw JSON, stdout, stderr, structured diagnostics, process success, and exit status remain distinct facts.
- Added CLI-first executor methods for nearest/declared/explicit root projections; direct Reference list/show; Store setup/register/unregister/remove; strict JSON validate/archive; and workflow path/Reference payloads.
- Added `update` to hook and server invocation contracts, restored `sync` to the core profile, added Oh My Pi, and added Oh My Pi/Trae command-delivery detection. Frontend actions remain pending parallel integration, so checkpoints 2.6 and 2.7 remain open.
- Corrected buffered and streaming validate argv to `validate <id> --type <type>`. The server buffered validate/archive endpoints now use JSON adapters; `--no-validate` appears only when explicitly requested and is never an automatic retry.

First-party executable evidence against `references/openspec@e1b51d1`:

```text
nearest doctor                         exit 0, root.source=nearest
declared Store doctor                  exit 0, root.source=declared, store_id=shared
explicit Store context                 exit 0, root.source=store, self-reference omitted
healthy + missing References           direct one-level member plus reference_unresolved warning
empty Store doctor/list                exit 0, healthy=true, absent optional planning directories
Store-selected show                    exit 0, multiline Requirement body preserved byte-for-byte
proposal-less nested delta validate    exit 1 with strict ERROR issues
scenario-loss archive                  exit 1, archive=null, archive_spec_update_failed
```

Focused verification:

- `pnpm --filter @openspecui/core exec vitest run src/upstream-contract-regression.test.ts src/cli-contracts/command-result.test.ts src/cli-executor-contracts.test.ts src/tool-config.test.ts src/tool-init-state.test.ts src/openspec-compat.test.ts` -> 39 passed.
- `pnpm --filter @openspecui/core exec vitest run src/cli-executor.test.ts src/cli-executor-contracts.test.ts src/cli-contracts/command-result.test.ts src/tool-config.test.ts src/tool-init-state.test.ts src/openspec-compat.test.ts` -> 62 passed.
- `pnpm --filter @openspecui/server exec vitest run src/workflow-invocation-service.test.ts src/router.test.ts` -> 49 passed.
- `pnpm --filter @openspecui/core typecheck` and `pnpm --filter @openspecui/server typecheck` passed.

Parallel boundary:

- Per manager direction, this slice owns `packages/core` and `packages/server`. ClaudeCode is producing an initial frontend/App projection concurrently. Its worktree changes are preserved and have not been edited by this slice. Section 2 completion will resume on top of that actual frontend state.
- No loopback trigger fired. The pinned CLI supplied every required Section 2 kernel fact without changing the approved product boundary.

## Progress: 2026-07-15 Section 2 Web contract closure

Changed contracts:

- Converged the Web compatibility gate, README guidance, website copy, reference-check script, and main CLI-integration spec on OpenSpecUI 6.x targeting CLI 1.6.x, with only 1.5.x accepted as legacy-compatible.
- Extracted the Web workflow profile vocabulary into one tested module. Its `core` sequence now exactly matches upstream 1.6: `propose, explore, apply, update, sync, archive`; the complete selection also exposes both `update` and `sync` with distinct labels.
- Added Update and Sync to the change command bar, compose route identity, agent invocation type, fallback evidence source, and command generator. Command mode preserves the action end to end and produces `/opsx:update <change-id>` or `/opsx:sync <change-id>` through the server workflow invocation service.
- Locked multiline Requirement rendering to preserve every authored paragraph and block before Scenario headings. Locked scenario-loss stderr rendering to preserve the complete `archive_spec_update_failed` message and stop the command queue after exit 1, without starting a synthesized `--no-validate` retry.

Focused verification:

- `pnpm openspec:check-reference` -> `v1.6.0` accepted.
- `pnpm --filter @openspecui/website exec vitest run --maxWorkers=1 src/lib/pages/home-page.test.ts` -> 1 passed.
- `pnpm --filter @openspecui/web exec vitest run --project unit --maxWorkers=1 src/components/cli-health-gate.test.tsx src/lib/opsx-profile.test.ts src/lib/opsx-agent-invocation.test.ts src/lib/opsx-compose.test.ts src/components/opsx/change-command-bar.test.tsx src/routes/opsx-compose.test.tsx src/components/markdown-viewer-open-spec-plugin.test.tsx src/lib/use-cli-runner.test.tsx` -> 41 passed.

Checkpoint state:

- Section 2 is complete at 11/11: checkpoints 2.1, 2.6, 2.7, and 2.10 closed in this slice; 2.2-2.5, 2.8-2.9, and 2.11 retain their earlier kernel evidence.
- Section 3 and later remain intentionally unchecked. ClaudeCode's frontend/App skeleton is preserved as parallel work and is not claimed as a completed later-phase contract.
- No loopback trigger fired.

CI-equivalent verification from an isolated clean worktree containing only the planning and Section 2 commits:

- `FORMAT_CHECK_BASE_SHA=0676d44 pnpm format:check` -> 81 changed text files passed.
- `pnpm lint:ci` -> 710 files, 0 warnings, 0 errors.
- `pnpm typecheck` -> all 15 runnable workspace packages passed; website reported 0 errors and 0 warnings.
- `pnpm test:ci` -> 216 test files and 1301 tests passed, including core 359, server 199, Web 543, App 38, and CLI 49.
- `pnpm test:browser:ci` -> xterm-input-panel 60 passed with 1 existing skip; Web Storybook 12 passed. Total: 10 files, 72 passed, 1 skipped.
- `CHANGESET_CHECK_BASE_SHA=0676d44 pnpm changeset:check` -> changeset detected.
- `pnpm openspec:check-reference` -> `v1.6.0` accepted; the clean worktree remained unchanged after verification.

Concurrent-worktree evidence:

- ClaudeCode's uncommitted App skeleton currently triggers a React `getSnapshot` / maximum-update-depth loop in `ConnectionsRoute`, and four pre-existing test workers remain outside this slice. Those files and `pnpm-lock.yaml` are excluded from the Section 2 commits. The isolated committed App baseline passes 38/38 tests, proving the loop is not introduced by this PR.
- Local CI is complete. Protected-branch push, PR creation, and remote checks remain pending; the PR must not be merged before independent review.

## Independent Review: 2026-07-16 PR #207 CLI 1.6 contract baseline

Review target: committed range `e89dd11...8b81f7d` only. The later uncommitted frontend/kernel work was excluded. Focused Core, Server, and Web tests passed, and all PR checks were green; those checks do not discharge the contract defects below.

Merge decision: **request changes**.

Blocking findings:

- Checkpoint 2.2 reopened: Store routes call the typed executor and then parse `stdout` again, discarding `data`, `payload`, diagnostics, contract drift, stderr, and exit evidence. `WorkflowInvocationService` similarly compresses JSON command results into prompt text. Known 1.6 workflow fields such as planning home, Apply requirements, next steps, action context, instruction, context, rules, and template remain untyped passthrough values.
- Checkpoint 2.3 reopened: explicit Store selectors use truthiness. `store doctor '' --json` and `--store ''` lose the supplied argument instead of preserving the upstream `invalid_store_id` failure; root-aware commands can fall back to another CLI-selected root.
- Checkpoint 2.4 reopened: the existing beta Store projection was changed from optional-field schemas to strict command schemas. This violates the published lenient Store contract and turns slightly reshaped beta payloads into `data-incompatible` failures. Store routes also ignore the typed executor result and repeat JSON parsing.
- Checkpoints 2.6 and 2.7 reopened: successful Update and Sync compose flows use Status output as the complete Agent prompt. The prompt no longer tells the Agent to update planning artifacts or sync specs, so action identity is present in routing while missing from execution intent.
- Checkpoint 2.11 reopened: `upstream-contract-regression.test.ts` asserts source substrings, while command-result tests use hand-authored payloads. No pinned CLI fixture executes the required nearest/declared/explicit root, Reference, empty Store, strict archive, scenario-loss, or tracked-glob matrix claimed by the checkpoint.

Required evidence before re-closing:

- One typed evidence envelope survives executor, Server route/service, hooks, and Web consumption without reparsing stdout or collapsing independent process facts.
- Store beta projections retain passthrough plus optional-field tolerance independently from stricter command-specific schemas.
- Empty explicit selectors reach the CLI unchanged and reproduce upstream failure diagnostics.
- Update and Sync compose tests assert both raw CLI evidence and the action-specific instruction presented to the Agent.
- Executable fixtures run the pinned OpenSpec 1.6 CLI against temporary real roots for every Phase 1 matrix item, including tracked-task globs and command failures.

Non-blocking standards debt remains in the same change: exported schemas/interfaces/methods need public API comments; `cli-contracts/index.ts` needs the required timestamped intent header; duplicated workflow action registries and prompt switches should converge before another workflow is added. Public validate/archive Store selection also arrived before Root Context owns selection and must not remain a client-controlled root boundary.

## Corrective Worker Goal: 2026-07-16

Use `openspec-apply-change` on `target-openspec-cli-16-line` and resolve the independent review of PR #207 inside this existing change. Begin by reading the CLI-reported context files and the review section above. Preserve all current uncommitted follow-on implementation; do not reset, revert, or silently overwrite work outside the corrective scope. Audit the actual current tree first because later uncommitted work may already partially address findings that were proven against `8b81f7d`.

Required implementation scope:

1. Re-close checkpoint 2.2 only after known OpenSpec 1.6 workflow fields are strongly typed and one command-result evidence envelope survives executor, Server, hooks, and Web consumption without reparsing stdout or collapsing payload, diagnostics, stderr, contract drift, success, or exit status.
2. Re-close checkpoint 2.3 only after explicit Store selector presence is preserved, including empty invalid values, and root-aware commands cannot silently fall back because of truthiness checks.
3. Re-close checkpoint 2.4 only after the beta Store UI projection is again passthrough plus optional-field tolerant, typed executor results are consumed directly, and list/doctor/mutation failure shapes remain objective CLI evidence.
4. Re-close checkpoints 2.6 and 2.7 only after Sync and Update retain both raw CLI evidence and explicit action instructions through compose, command, hook, and UI paths.
5. Re-close checkpoint 2.11 only after deterministic executable fixtures exercise official 1.4, 1.5, and pinned 1.6 behavior against temporary real roots. Source-substring assertions and hand-authored JSON alone are insufficient. The 1.6 matrix must cover nearest/declared/explicit roots, References, empty healthy Store, strict archive failure, scenario loss, tracked-task globs, and Store/root command failures.
6. Resolve the standards findings in touched public surfaces: API comments, `cli-contracts/index.ts` intent header, and duplicated workflow vocabulary. Ensure validate/archive root selection is server-owned by Root Context rather than an independent client-controlled Store selector.

Execution and delivery constraints:

- Keep production changes minimal and inside the current change; open no additional change unless implementation proves a genuinely separate product decision is required.
- Add or update focused regression tests before changing each checkpoint to complete. Mark a checkpoint immediately after its own evidence passes, not in one batch at the end.
- Append a timestamped implementation entry containing changed contracts, exact verification commands/results, remaining risks, and every checkpoint transition.
- Run focused Core/Server/Web tests first, then `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci` before updating PR #207.
- Commit only the intended corrective and already-owned follow-on work. Do not merge, archive, or release; return the updated commit and evidence for independent re-review.

### 2026-07-15 — Frontend skeleton (Phase A App + Phase B Web skeleton) drafted ahead of kernel data sources

Scope: UI projection layer only. No `packages/core`, `packages/server`, or `packages/cli` runtime behavior changed. All data sources are placeholder/loading states with `TODO(kernel)` markers; backend contracts (`envUri`, `RootContext`, `References`, the three task projections, the source-aware Spec Catalog, store mutation lifecycle) are consumed as local TypeScript type declarations that will migrate to `@openspecui/core` once the kernel lands them.

Phase A — `packages/app` (private, not published):

- Added TanStack Router (`^1.99.0`, same line as web). Routes: `/` (→`/connections`), `/connections`, `/environment`, `/sessions`, `/settings`, and experimental Store Manager `/environment/stores/{inspector,context,inventory}`.
- `main.tsx` wraps the existing `HostedShell` (iframe multi-tab) inside `RouterProvider`; launch-param/PWA/SW bootstrap is unchanged, fed via router context to `/sessions`.
- Home/Connections: lists persisted backend entries from the shared `shell-state` localStorage (no credentials), probes reachability via existing `/api/health`, Add/Open/Remove with loading locks.
- Environment Center: `envUri`-grouped (placeholder/empty), neutral "observed" copy, never "all references"/"unreferenced".
- Experimental Store Manager: Inspector (master/detail, `StoreDoctorStore` projection, remove dialog naming environment/host/Store/checkout with explicit confirm), Context Matrix (observed-only project↔Root/Reference table), Inventory (wide-screen registry). Marked Experimental; mutations are backend-owned lifecycle (`accepted→running→succeeded|failed`, `indeterminate` on unrecoverable terminal loss).
- Local type declarations under `packages/app/src/types/`: `env-uri.ts`, `capabilities.ts` (`stores.inspect|stores.mutate|contexts.inspect`), `store-mutation.ts`, `root-context.ts`.

Phase B — `packages/web` (published, `.changeset` minor):

- New project Context view `/context` (6.9) with placeholder `useContextSubscription` hook; neutral copy.
- Compound Spec identity & routes (5.7–5.9): `/specs/owned/$specId`, `/specs/referenced/$storeId/$specId`; `spec-catalog.ts` type + route helpers; legacy `/specs/$specId` retained for navigation continuity.
- Task projection contracts (5.1–5.6): `task-projections.ts` introduces `TrackedTaskProgress` (`0/0`→`no-tasks`), `DocumentChecklistSummary` (secondary analytics), `ApplyInstructionProgress` (raw Apply result); no `progress` alias.
- Nav: added `/context` to `nav-items.ts`, `nav-controller.ts` (`TabId`/`ALL_TABS`/`DEFAULT_MAIN_TABS`), and both route trees.

Divergence — frontend drafted before kernel data sources (intentional, per manager direction "先把前端的初步工作先完成，后续等后端开发好了再做对接"):

- No Section 6/9 checkpoint is marked complete: the skeleton provides UI structure and routing, but root-correct data, reactive propagation, capability gating, and real mutation lifecycle all depend on the Section 2/3/4 kernel contracts that are still in progress. Marking them now would claim feature completeness the kernel has not delivered.
- Loopback trigger status: no trigger fired. Every required UI-side contract (`envUri`, capabilities, mutation lifecycle, compound Spec identity, three task projections) is defined unambiguously by AGENTS.md and the `loop/` decisions and is implementable once the kernel exposes them. The placeholders are faithful to the approved boundaries (neutral copy, no machine-wide completeness claims, no project-local registry semantics, no `progress` alias).

Focused verification:

- `pnpm --filter @openspecui/app typecheck` and `pnpm --filter @openspecui/web typecheck` -> pass.
- `pnpm --filter @openspecui/app test` -> 72 passed (38 pre-existing + 34 new).
- New web tests (`spec-catalog`, `task-projections`, `context`) -> 19 passed.
- `pnpm format:check`, `pnpm lint:ci` -> pass on all changed source.
- Pre-existing failure noted (not caused by this slice): `packages/web/src/components/cli-health-gate.test.tsx` (5 tests) fails because of an unrelated uncommitted `packages/core/src/openspec-compat.ts` version-range edit (`>=1.5.0 <1.7.0` vs the test's expected `>=1.4.0 <1.6.0` text). That compat edit predates and is independent of this frontend slice.

#### 2026-07-15 — Frontend skeleton component-quality refactor

A self-audit against best practices found real defects in the first skeleton pass (not "waiting on kernel" gaps). All fixed in this sub-slice, no `packages/core`/`server`/`cli` changes:

- **Eliminated duplicated dialog markup.** `StoreRemoveDialog` and the Connections `AddBackendDialog` previously rendered raw `<dialog open>` with no focus management. Both now reuse the shared `@openspecui/web-src/components/dialog` `Dialog` (already used by `hosted-shell.tsx`), which provides focus trapping, ESC/backdrop dismiss, and `@starting-style` transition animation.
- **Extracted one shared `StatusBadge`/`StatusDot` component** (`packages/app/src/components/status-badge.tsx`) for all semantic presentation states (Store health, Backend reachability, Store mutation lifecycle). Replaced the inline `HealthDot`/`HealthBadge` in `store-inspector.tsx` and `ReachabilityBadge` in `connections.tsx`. This removed dead code: the old `HealthBadge` had a meaningless three-way ternary that resolved to the same `Stethoscope` icon in every branch.
- **Removed a fake data value.** `store-inventory.tsx` hard-coded `warningCount = 0` after dropping a `.filter`; it now honestly reports "unknown (see Inspector)" because `store list --json` carries no doctor diagnostics. The Inventory Health column renders a `neutral` "unknown" badge instead of fabricating "OK" from an empty diagnostic array.
- **Accessibility.** `LoadingView` is now `role="status" aria-live="polite"`; `ErrorView` is `role="alert" aria-live="assertive"`; decorative icons are `aria-hidden`. `StatusBadge`/`StatusDot` carry `role="status"` + `aria-label`.

Note on list-level fluid animation (Style directive "列表的物理惯性"): the repository has **no** list-animation library (no framer-motion / auto-animate / react-transition-group) and relies exclusively on the View Transitions API for route/page transitions. The existing web lists (e.g. `spec-list.tsx`) likewise render plain `.map()`. Introducing a list-animation library unilaterally in `packages/app` would create a divergent animation paradigm, so this is intentionally deferred to a whole-repository decision rather than patched into one package's skeleton.

Focused verification: `pnpm --filter @openspecui/app typecheck` pass; `pnpm --filter @openspecui/app test` -> 78 passed (18 files, +6 `status-badge` tests); `pnpm lint:ci` -> 0 warnings/errors; Prettier clean on all changed source.

## Progress: 2026-07-16 Root Context contract and project Context integration

Changed contracts:

- Added one public Core `RootContext` snapshot containing the launch-project path, exact CLI Doctor planning-root projection and source, effective Store id, CLI availability/version evidence, direct Reference index, Context members, inherited OpenSpec data-scope diagnostic, diagnostics, and raw command evidence (`stdout`, `stderr`, exit status, structured diagnostics, contract error).
- Added one `RootContextState` union for `loading`, `ready`, `refreshing`, and `error`. Error state keeps the current failed CLI attempt and can retain the last successful snapshot as stale data; no failure is converted into a fabricated healthy/complete conclusion.
- Added a resolver that composes `checkAvailability`, `doctor --json`, and `context --json`. It preserves upstream `nearest | declared | store | implicit` root sources, rejects cross-command root mismatch, and keeps unresolved Reference diagnostics visible instead of treating the projection as ready.
- Added `rootContext.get` and `rootContext.subscribe` to the server router. The subscription registers launch config, selected root config, and effective data-home registry dependencies and emits loading/refreshing/ready/stale-error states through one contract.
- Added one `PlanningRootServiceManager` that lazily creates and caches `OpenSpecAdapter`, `DocumentService`, `OpsxKernel`, file preview, Search, and Dashboard services by CLI-resolved root. The manager retains the launch `CliExecutor` so declared/Store selection stays CLI-owned while filesystem reads use the resolved root.
- Migrated Spec, Change, Archive, OPSX, Search, Dashboard, entity writes, previews, and reactive subscriptions off static launch-root services. Server startup no longer creates or warms a parallel launch-root Adapter/Document/Kernel/Search/Dashboard bundle; `init` remains the explicitly named launch-project operation.
- Replaced the Web `/context` loading placeholder with the real Root Context subscription. The view shows launch project versus planning root, Store id, observed direct References, exact CLI diagnostics, and read-only data-scope/registry provenance using neutral completeness language.

Checkpoint state:

- Checkpoints 3.1, 3.2, and 3.3 are complete.
- Checkpoint 3.4 onward remains open. `WorkflowInvocationService` still needs the CLI-resolved change/root/Store/action-context evidence migration; it is not claimed by the filesystem-service change.
- The current single-project watcher cannot yet observe existing files outside its launch root; dynamic data-home and Store-root watcher ownership remains Section 4 work, not hidden completion in this slice.
- Project Context checkpoint 6.9 remains open because environment identity/capability integration and removal of the legacy project Stores surface have not landed.
- No loopback trigger fired.

Focused verification:

- `pnpm --filter @openspecui/core typecheck` and focused Core tests -> 7 passed.
- `pnpm --filter @openspecui/server typecheck`; Root Context service + full server router tests -> 47 passed.
- `pnpm --filter @openspecui/web typecheck`; Context, Spec Catalog, and task projection tests -> 20 passed.
- Planning-root manager and Server startup/router/system/cache focused matrix -> 55 passed; the separated-root filesystem test proves reads and writes target only the selected planning root.
- `pnpm lint:ci` -> 756 files, 0 warnings, 0 errors.

## Progress: 2026-07-16 root-correct workflow action evidence

Changed contracts:

- Completed the OpenSpec 1.6 Status schema with required `planningHome`, `changeRoot`, `artifactPaths`, `existingOutputPaths`, `applyRequires`, `nextSteps`, and `actionContext`. Completed Artifact Instructions with planning home, instruction/context/rules/template, glob outputs, and References; Apply keeps its upstream raw progress/Reference shape.
- Replaced raw `executeCli(args)` text capture in `WorkflowInvocationService` with the typed `workflowStatus`, `artifactInstructions`, and `applyInstructions` executor surfaces. Each invocation now returns the exact command result: parsed data, JSON payload/stdout, stderr, structured diagnostics, process success/exit, and contract drift.
- Added one public workflow target containing launch project, planning root/source, Store id, exact explicit-Store selector, References, Root Context diagnostics, and root command evidence. Hook context uses this target instead of ambiguous `projectDir`; no compatibility alias was added.
- Moved `WorkflowInvocationService` and its HookRuntime under `PlanningRootServiceManager`. `opsx.runWorkflow` resolves the same root-scoped bundle as project documents and OPSX kernel data; Server startup no longer owns a parallel launch-root workflow service.
- Direct CLI and Agent command payloads retain `--store <id>` for explicit Store roots. Compose prompts retain raw CLI JSON and expose the target planning root/source/Store before terminal dispatch. Static fallbacks explicitly report null target/evidence rather than fabricating backend facts.
- Narrowed raw CLI payload typing from `unknown` to recursive JSON values so the evidence contract survives tRPC serialization without assertions or optional-field drift.

Checkpoint state:

- Checkpoint 3.4 is complete. Status/Instructions fixtures cover `changeRoot`, planning home, action context, direct References, Store selection, glob `existingOutputPaths`, stderr, exit status, structured diagnostics, Hook propagation, Router ownership, and Web target display.
- Checkpoint 3.5 remains open. The planning-root manager rejects unresolved Root Context before constructing services, but every root-dependent Web control has not yet been audited for loading locks and CLI-owned failed-attempt presentation.
- No loopback trigger fired; OpenSpec 1.6 supplied every required action fact through supported JSON/exit contracts.

Focused verification:

- Core Root Context/workflow contract/source matrix -> 28 passed.
- Server Root Context/planning/workflow/router/startup/search/system/cache matrix -> 64 passed.
- Web Context/Spec/task/Compose matrix -> 31 passed; App handoff suite -> 78 passed.
- Full workspace typecheck passed across 15 runnable packages; `pnpm lint:ci` passed on 756 files with zero warnings/errors.

## Progress: 2026-07-16 Root action readiness and workflow hook v2

Changed contracts:

- Added one shared Web `RootActionState` derived from the live Root Context subscription. Only a current `ready` projection unlocks actions; initial loading, refresh with stale data, transport failure, and CLI-owned error states remain locked. Static mode remains explicit with null backend context/evidence.
- Preserved failed-attempt evidence in the shared notice: attempted root/source/Store, Doctor and Context exit status, stderr, contract drift, and structured diagnostics remain visible without treating stale data as action authority.
- Applied the gate to OPSX Compose, Propose, New, Verify, the Change toolbar, terminal Copy/Save/Send, and global Archive. Blocked Compose/Verify/New paths do not call workflow preparation or create terminal/CLI actions.
- Added `getRootContextCliSelector` as the single selector law. Explicit Store roots emit `--store`; nearest and declared roots do not. Global Archive now queues Store-correct validate/archive commands, and buffered/streaming server validate/archive procedures derive their selector from Root Context rather than client input.
- Corrected validate argv to `validate <id> --type change`. `PlanningRootServiceManager` and `opsx.runWorkflow` reject failed Root Context resolution before workflow action creation.
- Split hook protocol versions after the breaking workflow context migration: document hooks remain `OnReadDocumentHookV1` at version 1; workflow hooks are now `OnRunWorkflowHookV2` at version 2 with explicit target/evidence. The prior workflow v1 names and shared version constant were removed without compatibility aliases.

Checkpoint state:

- Checkpoint 3.5 is complete. Loading/refresh/error/ready/static state tests, action-control tests, explicit Store queue tests, server selector tests, and failed-root short-circuit tests cover the acceptance boundary.
- Checkpoint 3.6 remains open. Config ownership is the next ordered slice; this checkpoint does not claim Config, Git, Terminal cwd selection, or Agent path migration beyond the workflow dispatch controls explicitly listed above.
- No loopback trigger fired. Root selection, failed-attempt evidence, and explicit Store selection remain available from the supported OpenSpec 1.6 CLI contracts.

Verification:

- Focused Core Root Context/CLI matrix -> 23 passed; focused Server document-hook/planning-root/Root Context/workflow/router matrix -> 67 passed; focused Web Root gate/action matrix -> 26 passed; Website hook docs -> 3 passed.
- `pnpm typecheck` -> all 15 runnable packages passed; Website reported 0 errors and 0 warnings.
- `pnpm lint:ci` -> 760 files, 0 warnings, 0 errors.
- `pnpm test:ci` -> root 43, Core 370, Server 209, Web 576, App 78, CLI 49, and every remaining workspace package passed.
- `pnpm format:check` -> 108 changed files passed; `git diff --check` passed.
- `pnpm test:browser:ci` -> xterm-input-panel 60 passed with 1 existing skip; Web Storybook 12 passed.

## Progress: 2026-07-16 configuration ownership boundary

Changed contracts:

- Added one public `planningConfig` boundary with three physically and semantically distinct facets: `project-binding`, `active-root`, and `environment-global`. Removed the ambiguous `opsx.projectConfig/subscribeProjectConfig/writeProjectConfig` and `cli.getGlobalConfig/getGlobalConfigPath/setGlobalConfig` procedures without compatibility aliases.
- Project Binding reads the launch project's existing `config.yaml` or `config.yml`, preserves raw content, and inspects only authored `store:` and `references:` declarations. Its Root Context preview is returned as `ready | error`, so malformed/unresolved binding remains fixable rather than being hidden behind planning-root service creation.
- Project Binding mutation accepts only Store and Reference fields, uses a structured YAML document update, and preserves unrelated schema, context, rules, and comments. Invalid declarations remain explicit diagnostics; they are not normalized into effective Store/Reference truth.
- Active Root Config reads and writes only the CLI-selected planning root and carries root source, Store id, and objective `externalToLaunchProject` provenance. Removed the now-dead project-config state from `OpsxKernel`, so workflow projection caches no longer own config state.
- Environment Global Config projects `openspec config path` and `openspec config list --json`, preserves path/list stdout, stderr, exit status, contract drift, and inherited OpenSpec data scope, then tracks the CLI-selected config file. Existing Config consumers now use the ownership-specific endpoint names.

Checkpoint state:

- Checkpoint 3.6 is complete. Core parsing/update tests, Server separated-root read/write tests, router ownership tests, and Web consumer migration prove the three owners cannot silently collapse into launch `projectDir`.
- Checkpoint 6.8 remains open: the Config page still needs the final three-section product UI and structured Project Binding controls. This slice establishes the contract and removes ambiguous endpoints without claiming that later surface work.
- Checkpoint 3.7 is next. No loopback trigger fired and no project `.env`, StoreRoot, registry overlay, or XDG editor was introduced.

Focused verification:

- Core planning-config/Root Context/OpsxKernel matrix -> 15 passed.
- Server planning-config/planning-root/router matrix -> 53 passed.
- Web Config consumer test -> 1 passed.
- Core, Server, and Web package typechecks passed.
- Full package suites: Core 374, Server 213, and Web 576 passed. The first concurrent Server run missed a transient Xet download-progress intermediate state after already reaching `downloaded 30/30`; the isolated test and a full standalone Server rerun both passed.
- `pnpm typecheck`, `pnpm lint:ci` (764 files), and `pnpm format:check` (117 changed files) passed.

## Progress: 2026-07-16 explicit Git repository scopes

Changed contracts:

- Added public `code | planning` Git repository scope types. Code repository is always the explicit default; Planning repository is advertised only when the CLI-selected planning root resolves to a canonical Git identity distinct from the launch project's repository.
- Defined repository identity as canonical Git worktree top-level plus common directory. Different launch/planning paths nested in one worktree collapse to Code scope, while another linked worktree or another repository remains distinct.
- Added `git.scopes` and made scope mandatory for overview, paged history, entry metadata, changed files, patches, refresh, detached-worktree removal, and worktree handoff. Dashboard Git refresh/removal now sends explicit Code scope rather than relying on an omitted server default.
- Resolved every downstream Git cwd from the selected repository top-level. Planning scope is rejected before command execution when Root Context is unavailable, the planning root is not a Git repository, or its identity collapses into Code.
- Added per-repository mutable cache generations. Refresh and destructive worktree changes invalidate only the selected repository; immutable commit-detail caches remain repository-keyed.
- Added the Web repository-scope segment, repository identity display, `gitScope=planning` URL state, scope-specific React Query keys, and scoped detail/back links. Status/history data is not reused as placeholder content when the selected repository changes.
- Preserved scope through View Transition detail prefetch and on-demand patch loading. Worktree removal and handoff execute only with the currently selected scope. No Store clone, pull, push, or synchronization behavior was added.

Checkpoint state:

- Checkpoint 3.7 is complete. Same-worktree nested roots expose Code only; separated repositories expose both scopes and return different uncommitted files. A Planning refresh writes its Git metadata stamp only in the Planning repository.
- Checkpoint 6.11 remains open because the later project-surface acceptance pass still covers complete page lifecycle and browser acceptance together with the other Section 6 surfaces.
- Checkpoint 3.8 is next: Terminal must expose launch-project cwd versus planning-root cwd while preserving inherited `XDG_DATA_HOME`.
- No loopback trigger fired. Git repository facts are obtained from Git itself, Store identity remains orthogonal, and the approved no-synchronization boundary is unchanged.

Focused verification:

- Git scope resolver plus Server router matrix -> 53 passed.
- Git URL/query/detail/patch/View Transition Web matrix -> 35 passed.
- Full package suites: Core 374, Server 218, Web 582 passed.
- Core, Server, and Web package typechecks passed before documentation synchronization.

## Progress: 2026-07-16 explicit terminal cwd targets

Changed contracts:

- Added one required PTY cwd target, `launch-project | planning-root`, across create, created, list, reconnect, controller snapshots, React context, and terminal creation APIs. No legacy optional field or arbitrary client cwd path was retained.
- Removed the hidden cwd from `PtyManager`. The WebSocket server resolves Launch from the configured project directory and Planning from the current CLI-owned `PlanningRootServiceManager` result before spawning; failed Planning resolution returns `PTY_CREATE_FAILED` without creating a process.
- Added `initialCwd` to server-owned PTY session metadata. Local queued creates, server acknowledgements, restored sessions, terminal tabs, tooltips, and dispatch target labels retain both semantic target and resolved initial path.
- Added one Web Root Context projection for terminal targets. Launch remains selectable even before Root Context observation; Planning is selectable only for current `ready` data and remains locked through loading, refresh, transport failure, and CLI-owned error states.
- Added explicit Launch/Planning creation controls to the Terminal panel and configured-command dialog. Existing Config and OPSX-New internal callers now state `launch-project` rather than depending on a default.
- PTY spawn environment is a filtered copy of the inherited backend environment plus `TERM=xterm-256color`. Launch and Planning do not load project `.env`, synthesize XDG paths, or mutate `XDG_DATA_HOME` by target.

Checkpoint state:

- Checkpoint 3.8 is complete. Protocol, queued-create, restore, unavailable-Planning, displayed identity, and environment tests cover the contract.
- Checkpoint 6.12 remains open for the later complete project-surface/browser acceptance pass; this slice implements its creation-control and tab-identity contract without claiming all Section 6 lifecycle gates.
- Checkpoint 3.9 is next. No loopback trigger fired, and ClaudeCode's App/Store frontend skeleton remains preserved for its ordered backend integration.

Focused and full verification:

- Server PTY manager/WebSocket matrix -> 22 passed; Web terminal controller/cwd/panel/dialog matrix -> 60 passed.
- Full package suites: Core 374, Server 221, Web 591, and App 78 passed.
- `pnpm typecheck`, `pnpm lint:ci` (770 files), and `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 CLI-resolved Agent and OPSX paths

Changed contracts:

- Every server-generated Agent prompt now fixes the launch-project command cwd, CLI-selected planning root, root source, optional Store id, and exact explicit-Store selector before presenting workflow content.
- Agent prompts with successful CLI evidence retain the raw Status/Instructions JSON inside that target envelope. Absolute `planningHome`, `changeRoot`, `resolvedOutputPath`, `existingOutputPaths`, `contextFiles`, and `allowedEditRoots` therefore remain CLI-owned facts rather than Web or Server path reconstruction.
- Prompt instructions state that the planning root and CLI-resolved paths are authoritative and explicitly forbid deriving `<launch-project>/openspec`. Archive prompts keep the same target envelope around strict status evidence.
- OPSX command mode and direct CLI mode preserve the Root Context selector. Quick Propose no longer drops `--store` when its input is already an `/opsx:*` command; the resolved selector is appended last so the selected root remains authoritative.
- Static fallback prompts remain explicitly targetless and non-executable against backend state. No browser-side root, Store, or artifact-path resolver was added.

Checkpoint state:

- Checkpoint 3.9 is complete. Nearest, declared, and explicit-Store fixtures prove prompts carry `/planning` CLI paths, never synthesize `/launch/openspec`, and preserve Store selectors across Agent-command and direct-command modes.
- Checkpoint 6.14 remains open for the later full OPSX surface and browser acceptance pass.
- Checkpoint 3.10 is next. No loopback trigger fired; all required paths and selectors were already available in supported OpenSpec 1.6 JSON/Root Context contracts.

Verification:

- Focused Workflow Invocation + Server Router matrix -> 60 passed.
- Full Server suite -> 224 passed; Server typecheck and `pnpm lint:ci` (770 files) passed before documentation synchronization.

## Progress: 2026-07-16 inherited OpenSpec data-scope boundary

Verified contracts:

- Production source contains no project `.env` loader, `StoreRoot`, registry overlay, project registry synthesis, or code path that derives a registry file from the launch project.
- `resolveOpenSpecDataScope` remains a read-only projection of inherited `XDG_DATA_HOME`, platform `LOCALAPPDATA`, or the upstream home-directory fallback. It accepts no project path and creates no overlay.
- `createCleanCliEnv` and PTY spawn preserve inherited `XDG_DATA_HOME`. A project-authored `openspec/.env` with a conflicting value does not affect a CLI child; the ambient launch value remains authoritative.
- `OpenSpecUIConfigSchema` has no environment, Store-root, or registry-overlay facet. Unknown `env`, `StoreRoot`, `storeRoot`, and `registryOverlay` inputs are excluded from the public parsed configuration rather than becoming an alternate execution scope.
- Agent/OPSX commands retain the same inherited environment through CLIExecutor or PTY execution. No general subprocess receives repository-authored environment variables.

Checkpoint state:

- Checkpoint 3.10 is complete. The adaptation preserves one process environment boundary and adds no competing project data-scope product.
- Checkpoint 3.11 is next. No loopback trigger fired; the approved negative boundary is technically enforceable without new runtime abstractions.

Verification:

- Core CLI/data-scope/Root Context matrix -> 40 passed; Server PTY/workflow matrix -> 18 passed.
- Full Core suite -> 376 passed.

## Progress: 2026-07-16 planning-root mutation boundary

Changed contracts:

- Root-dependent Spec, Change, task, archive, entity-file, artifact-output, schema, and Active Root Config mutations all resolve the CLI-selected planning-root service or its explicit Root Context owner before filesystem access.
- Extended the separated Launch/Planning integration fixture with real Spec creation, Change proposal/tasks creation, task toggle, and archive rename. Every expected file appears under Planning; the corresponding Launch paths remain absent.
- Added a router-level separated-root matrix for Change entity files, archived entity files, and OPSX artifact outputs. The test performs real writes and proves all three land only under the selected Planning root.
- Replaced the artifact-output writer's direct `join(planningRoot, ..., outputPath)` with the guarded change-entity resolver. Client `../` traversal is rejected before directory creation or write, matching Change and Archive file behavior.
- Launch-owned Project Binding and Code Git remain explicit exceptions with different owners; the checkpoint does not falsely redirect those surfaces into Planning.

Checkpoint state:

- Checkpoint 3.11 is complete. Section 3 Root Context and Service Ownership is complete at 11/11.
- Checkpoint 4.1 is next: dynamic reference-counted observation must extend the current launch-oriented watcher model without changing the owners established here.
- No loopback trigger fired. Root-correct mutation required replacement of one unsafe path join, not parallel launch/planning implementations.

Verification:

- Planning-root service/config/router real-write matrix -> 56 passed.
- Full Server suite -> 225 passed; Server typecheck and `pnpm lint:ci` (770 files) passed before documentation synchronization.

## Progress: 2026-07-16 reference-counted dynamic observation roots

Changed contracts:

- Replaced the process-global single `ProjectWatcher` with a dynamic set of normalized physical roots. `acquireWatcherRoot` returns an idempotent asynchronous lease; repeated acquisition increments the root reference count, and only the final release closes the physical watcher.
- Added `ReactiveObservationEnvironment` as the owner of one backend runtime environment's logical root set. Repeated acquisition inside one environment shares one physical pool lease, multiple environments can share a physical root safely, and environment teardown releases every owned root.
- Decoupled path subscriptions from current root availability. A reactive read made before any matching root now retains a pending subscription, binds when a containing root appears, selects the deepest active root for overlaps, and rebinds when that root is removed or recovers.
- Replaced single-root runtime status with aggregate and per-root status: root path, reference count, initialization, subscription count, generation, recovery counts, and residency. Project Recovery consumes only the status entry matching the Launch root, so Planning or future data-home eviction cannot impersonate project-worktree loss.
- Server runtime now owns the Launch observation lease. Each `PlanningRootServiceManager` record owns one Planning lease and releases it with its root-scoped kernel, hook, search, and dashboard services. The obsolete `initWatcherPool` and `getWatchedProjectDir` contracts were removed without aliases.

Checkpoint state:

- Checkpoint 4.1 is complete. Dynamic root infrastructure contains no Store registry, data-home facet, invalidation-message, or polling policy semantics; those remain ordered work in 4.2 through 4.8.
- Checkpoint 4.2 is next. No loopback trigger fired: roots can be acquired, shared, rebound, and released safely without requiring polling as the primary consistency path.

Verification:

- Core dynamic watcher, delayed-binding, environment ownership, Config, Global Settings, and OPSX matrix -> 123 passed.
- Full Core suite -> 381 passed; full Server suite -> 225 passed.
- Server planning ownership, Project Recovery, system status, startup, and router matrix -> 61 passed.
- Full workspace typecheck passed; `pnpm lint:ci` -> 772 files, 0 warnings/errors; `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 effective data-home facet invalidation

Changed contracts:

- Added one environment-local `RuntimeInvalidationIndex` with four type-safe facet identities: `stores`, `worksets`, `schemas`, and `context`. Each invalidation advances a monotonic generation and carries no projected payload, registry contents, path inference, health, completeness, or authorization conclusion.
- Added one `OpenSpecDataHomeObserver` that acquires the inherited effective OpenSpec data-home root through `ReactiveObservationEnvironment`, listens recursively, invalidates the four data-home facets on external filesystem activity, and releases both path subscription and root lease during teardown.
- Store subscription now listens for the `stores` facet and immediately pulls a fresh `openspec store list --json` projection. Its existing five-second timer remains unchanged as temporary fallback until checkpoint 4.8; this slice does not claim polling policy completion.
- Root Context subscription and reactive planning-root resolution track the `context` facet before rerunning Doctor/Context CLI contracts. Registry or other data-home activity therefore cannot leave a connected project on a stale CLI-selected root/Reference projection.
- `OpsxKernel` schema streams track the `schemas` facet before executing `openspec schemas --json`. User schema override changes now refresh the CLI-owned schema list without teaching OpenSpecUI the upstream override resolver.
- The `worksets` facet is emitted and subscribable even though this change has no Workset product surface. It preserves the data-home contract without introducing Workset orchestration.

Checkpoint state:

- Checkpoint 4.2 is complete. Checkpoint 4.3 is next: Store roots must be reconciled from fresh CLI registry truth and acquired/released dynamically.
- No loopback trigger fired. Data-home observation is watcher-first, identity-only, safely releasable, and does not require OpenSpecUI to parse or own the registry, Worksets, or user schema payloads.

Verification:

- Core facet index, real data-home watcher, and CLI schema refresh tests -> 8 passed.
- Server Root Context, Planning manager, Store subscription, and startup matrix -> 61 passed.
- Full Core suite -> 385 passed; full Server suite -> 227 passed.
- Full workspace typecheck passed; `pnpm lint:ci` -> 776 files, 0 warnings/errors before documentation synchronization.

## Progress: 2026-07-16 CLI-truth Store-root reconciliation

Changed contracts:

- Added `StoreObservationService` as the serialized environment owner for registered Store root leases. It consumes only typed `StoreListEntry { id, root }` values from a successful `openspec store list --json` projection and contains no registry parser or filesystem discovery.
- Reconciliation uses Store id as identity: added ids acquire their CLI-returned roots, unchanged id/root pairs retain their leases, moved ids release the old root and acquire the new root, removed ids release, and a successful empty list releases every Store root.
- Store list query and subscription reconcile only when the beta projection is `available: true`. Nonzero exit, spawn/command failure, or incompatible successful payload returns its existing structured error and performs no reconciliation, so failure cannot be misreported as an empty registry.
- A Store-root watcher acquisition failure is logged as observation failure, releases any moved stale root, and leaves the Store absent from the observation set so the next successful list can retry. It does not alter the CLI-owned Store result.
- Server and WebSocket/runtime teardown release Store leases before disposing the shared data-home/environment owner. Store roots therefore share the same physical watcher reference-count law as Launch, Planning, and data-home roots.

Checkpoint state:

- Checkpoint 4.3 is complete. Checkpoint 4.4 is next: Launch and connected Planning root filesystem activity must map to project/context invalidation facets.
- No loopback trigger fired. A real watcher integration moved physical observation from Store A to Store B and then to no Store without polling, registry parsing, or leaked leases.

Verification:

- Store observation unit and physical watcher reconciliation tests -> 3 passed.
- Store Router, reconciliation, and Server startup matrix -> 59 passed.
- Full Server suite -> 231 passed.
- Full workspace typecheck passed; `pnpm lint:ci` -> 778 files, 0 warnings/errors; `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 Launch and planning-root facet invalidation

Changed contracts:

- Added one environment-owned `RuntimeRootInvalidationRegistry` beside the physical `ReactiveObservationEnvironment`. The observation environment owns watcher lifetimes; the registry maps normalized Launch/Planning paths to the shared runtime invalidation index without owning project data.
- Registered the Launch project once for the backend lifetime and each connected planning-root service record for that record's lifetime. Repeated ownership of the same canonical root increments one registry reference count and retains one recursive path callback, so Launch equal to Planning does not create duplicate registrations.
- Launch or Planning filesystem activity invalidates exactly `project` and `context` with monotonic generations and no projection payload. Root Context and reactive planning-root resolution then pull fresh CLI Doctor/Context truth; planning resolution tracks both facets before selecting or reusing a service record.
- Made `OpenSpecDataHomeObserver` a path observer only. It receives the shared invalidation controller but no longer exposes reader methods, preventing data-home observation ownership from being confused with the environment-wide invalidation boundary.
- Planning-root disposal releases its project invalidation lease before root-scoped services and physical observation leases. Server teardown disposes the shared registry before the observation environment, including startup and WebSocket shutdown paths.

Checkpoint state:

- Checkpoint 4.4 is complete. Checkpoint 4.5 is next: terminal or indeterminate CLI mutation outcomes must invalidate affected facets before clients pull again.
- No loopback trigger fired. Project-root invalidation reuses dynamic observation and Root Context contracts without parallel root implementations, payload push, registry parsing, or polling.

Verification:

- Core invalidation index, data-home separation, and real Launch/Planning watcher matrix -> 4 passed.
- Server Planning manager, Root Context, startup, and local subscription transport matrix -> 14 passed.
- Full Core suite -> 386 passed; full Server suite -> 231 passed.
- Core and Server package typechecks passed; `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 CLI mutation settlement invalidation

Changed contracts:

- Added one server-owned OpenSpec mutation classifier. Project/root commands (`init`, `update`, `archive`, `new`), project-local schema mutations, environment-global config mutations, Store mutations, and Workset mutations map to explicit runtime facets; read-only, help, and unknown commands return no inferred mutation claim.
- Added `CliMutationInvalidator` as the shared buffered/stream settlement boundary. Buffered success, nonzero failure, null/unknown result, and thrown indeterminate failure invalidate before the original result or error reaches the caller. Streaming exit, null exit, startup failure, and cancellation invalidate exactly once before the event/error/cancel reaches the client or process.
- Applied the boundary to buffered Init, Archive, and generic OpenSpec execution; streamed Init, Archive, and generic `openspec` command execution; and Environment Global Config writes. Validate and other read-only paths remain outside mutation invalidation.
- Fixed the CLI observable startup race: if a client detaches before asynchronous stream startup returns its cancel function, the process is canceled immediately when that function becomes available. Mutation settlement therefore cannot lose its indeterminate invalidation on this path.
- Kept command-to-facet mapping on the backend. Clients do not submit facet names, infer mutation meaning, or push projection data. The future backend-owned Store mutation lifecycle can reuse this settlement boundary, but `accepted/running` operation ownership remains checkpoint 8.7 work and is not claimed here.

Checkpoint state:

- Checkpoint 4.5 is complete. Checkpoint 4.6 is next: push messages must carry invalidation identity only and subscribers must pull their own fresh projections.
- No loopback trigger fired. Existing CLI results, events, errors, and cancellation behavior remain unchanged; the new boundary adds immediate identity-only invalidation before delivery.

Verification:

- Mutation classifier, buffered/stream settlement, delayed-start cancellation, and Router integration matrix -> 79 passed.
- Full Server suite -> 257 passed across 38 files; Server package typecheck passed.
- `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 identity-only invalidation push and client pull

Changed contracts:

- Added `runtimeInvalidation.subscribe({ facets })` to the Server router. Its initial and subsequent frames contain only `RuntimeInvalidationToken[]` (`facet` plus monotonic `generation`); no Store, Context, registry, path, health, or other projected data crosses the push boundary.
- Removed the old full-payload `stores.subscribe` contract. Store consumers now subscribe to `stores` invalidation identity and explicitly pull `stores.list` through HTTP after each token, preserving CLI JSON/diagnostics in the query response.
- Kept a temporary five-second Store reminder in the identity-only subscription so watcher-failure fallback remains available until checkpoint 4.8 replaces per-client timers with a bounded observation fallback. The timer emits no projection payload and does not reconcile registry truth itself.
- Added Web coverage proving the initial and subsequent token frames cause Store pulls and that a token object is never accepted as Store projection data. Server coverage proves invalidation can be observed without invoking `listStores` until the client explicitly pulls.

Checkpoint state:

- Checkpoint 4.6 is complete. Checkpoint 4.7 is next: duplicate invalidations must coalesce or remain idempotent across subscribers.
- No loopback trigger fired. Root Context remains the separately typed full projection subscription required by checkpoint 3.2; the generic runtime invalidation channel carries identity only.

Verification:

- Server identity-only invalidation and client-pull Router matrix -> 55 passed.
- Web Store pull and existing Stores page matrix -> 5 passed; Web and Server package typechecks passed.
- Full Server suite -> 257 passed across 38 files.
- `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 invalidation coalescing and pull idempotency

Changed contracts:

- Kept invalidation generation and `ReactiveState` updates synchronous, so mutation settlement still marks facets stale before returning. Direct listener delivery now batches at the microtask boundary per subscriber and retains only the latest token for each facet.
- Every subscriber present at invalidation time receives one deterministic facet-ordered batch. Repeated Store/Context invalidations in one turn can advance generations multiple times but emit only the latest generation; a subscriber released before flush receives nothing.
- Isolated listener failures so one closed or faulty subscriber cannot prevent other subscribers from receiving the coalesced batch.
- Added a request generation to the Web Store pull. Multiple invalidation/reminder frames may start overlapping read-only pulls, but a slower older response cannot replace a newer CLI projection.
- Corrected the 4.4 dynamic-root test to compare its documented lexicographic root order rather than random temp-directory creation order.

Checkpoint state:

- Checkpoint 4.7 is complete. Checkpoint 4.8 is next: remove per-client Store polling as a primary path and retain only a bounded watcher-failure or missing-path fallback.
- No loopback trigger fired. Coalescing changes notification scheduling only; CLI truth, generations, projection payloads, and physical watcher ownership remain unchanged.

Verification:

- Core invalidation batching, dynamic-root, and data-home matrix -> 5 passed.
- Server Router/mutation matrix -> 61 passed; Web Store pull/page matrix -> 6 passed.
- Full Core suite -> 387 passed; full Server suite -> 257 passed.
- Full workspace typecheck and `git diff --check` passed.

## Progress: 2026-07-16 bounded watcher-failure fallback

Changed contracts:

- Removed the five-second timer from each `runtimeInvalidation` subscriber. Healthy clients now receive only watcher/mutation-driven tokens; elapsed polling intervals do not trigger Store pulls.
- Added one `StoreObservationFallbackService` per backend runtime environment. Its single interval only invalidates `stores` and `context` when the data-home observer is unavailable, successful CLI Store truth contains an unobserved root, or an environment-owned watcher root is absent, uninitialized, or residency-evicted.
- Made failed data-home root acquisition retryable. `OpenSpecDataHomeObserver` now exposes `idle | starting | active | failed | disposed`, resets a failed start promise, and lets the bounded fallback reacquire the root without adding a registry parser.
- Retained desired Store roots separately from acquired leases. A watcher acquisition failure records an observation gap; the fallback emits identity-only tokens, the client pulls `stores.list`, and reconciliation retries the same CLI truth until the gap clears.
- The fallback check is non-overlapping and never executes Store CLI itself. Recovery, command failure, and projection truth remain owned by the existing query/reconciliation paths.

Checkpoint state:

- Checkpoint 4.8 is complete. Checkpoint 4.9 is next: unregister, root removal, disconnect, and environment teardown must release all watchers and fallback timers.
- No loopback trigger fired. Polling no longer exists in the healthy primary path and remains one bounded environment-level recovery mechanism.

Verification:

- Data-home retry, Store observation gap/retry, fallback health, and no-per-client-timer matrix -> 64 passed.
- Full Core suite -> 388 passed; full Server suite -> 263 passed.
- Core and Server package typechecks and `git diff --check` passed.

## Progress: 2026-07-16 observation and fallback teardown

Changed contracts:

- Made fallback teardown asynchronous and deterministic. `StoreObservationFallbackService.dispose()` clears its timer, waits for an in-flight data-home retry/check, and suppresses any invalidation after disposal.
- Made WebSocket/runtime close one idempotent asynchronous operation. It stops fallback first, then releases planning services, Store leases, data-home observation, project invalidation registrations, the shared observation environment, recovery state, and translation cache before resolving.
- Removed the duplicate pre-disposal sequence from `startServer.close`; local model services close once, then the shared WebSocket/runtime close path owns reactive teardown.
- Added a real-watcher lifecycle integration covering Store registration then unregister/root removal, invalidation subscriber disconnect before a pending microtask flush, fallback stop, data-home release, Launch/path-subscription release, and environment teardown. The final physical watcher-root and path-subscription counts are zero.

Checkpoint state:

- Checkpoint 4.9 is complete. Checkpoint 4.10 is next: multi-client behavior must cover external Store edits, registry changes, concurrent operations, reconnect, and root disappearance together.
- No loopback trigger fired. Every root and timer can be released without restoring polling as a primary path or leaking a fallback invalidation after teardown.

Verification:

- Store/fallback/startup/local-transport teardown matrix -> 18 passed.
- Full Server suite -> 265 passed across 40 files; Server package typecheck passed.
- `git diff --check` passed.

## Progress: 2026-07-16 multi-client reactive convergence

Changed contracts:

- Added Store-root invalidation leases beside Store-root observation leases. Each successful CLI Store entry now maps external filesystem activity on that Store root to `stores` and `context`; move, unregister, failed replacement, and teardown release both leases together.
- Added a real-watcher two-client environment test. Both clients receive the same identity-only batches after an external Store file write and an effective data-home registry write.
- Concurrent successful/failed CLI mutation settlements advance generations independently but coalesce to the same latest batch for both clients. Disconnect removes pending delivery; reconnect obtains the current generation snapshot before observing subsequent changes.
- Removing the Store directory triggers Store/Context invalidation through the Store-root watcher/fallback path, reaches every still-connected client, and still permits complete teardown with zero watcher roots or path subscriptions.

Checkpoint state:

- Checkpoint 4.10 is complete. Section 4 Multi-Root Reactive Kernel is complete at 10/10; checkpoint 5.1 is next.
- No loopback trigger fired. The watcher-first, identity-only, client-pull model converges across external edits, mutation settlement, reconnect, and root disappearance without registry parsing or machine-wide completeness claims.

Verification:

- Multi-client, Store observation, fallback, and lifecycle matrix -> 11 passed.
- Full Server suite -> 266 passed across 41 files; Server package typecheck passed.
- `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 source-distinct task projections

Changed contracts:

- Replaced the public generic task `progress`, `TaskProgress`, and `TaskProjection` contracts across Core, Server, CLI export, Web live/static providers, Dashboard, Change lists, and task components. The three public facts are now `trackedTaskProgress`, `documentChecklistSummary`, and `applyInstructionProgress`; no compatibility alias remains.
- Replaced the 3.12 schema-wide formal task algorithm with the OpenSpec 1.6 tracked-artifact law. `apply.tracks` selects the artifact by exact output equality, only that output glob is expanded, schemas without `apply.tracks` select the `tasks` artifact, and failed resolution or zero matched source falls back only to top-level `tasks.md`.
- Retained the broader 3.12 value as `documentChecklistSummary`. It scans only schema-matched Markdown documents when schema detail is available, deduplicates each physical file, retains all matching artifact ids, and groups task/count statistics per file. Metadata-only entities retain all Markdown documents as explicitly secondary analytics.
- Transformed application Apply instructions from upstream's raw `progress` field to attributed `applyInstructionProgress` while leaving the raw CLI command envelope unchanged. `OpsxKernel` compares it with the tracked projection and preserves both values plus a typed non-fatal divergence diagnostic.
- Added the divergence diagnostic to Change detail. It labels literal Apply counts and tracked artifact-glob counts independently; agreement renders no warning.
- Made `no-tasks` a formal phase. `0/0` cannot satisfy workflow completion, and the former inferred `Ready to Archive` label is now the objective `Workflow Complete`; only validate/archive CLI outcomes can claim archive readiness.

Checkpoint state:

- Checkpoints 5.1 through 5.6 are complete. Checkpoint 5.7 is next: move ClaudeCode's compound Spec identity skeleton into one shared Core contract before adapting catalogs and consumers.
- No loopback trigger fired. The three projections remain type-distinct without aliases, and upstream CLI JSON retains its original field names only inside command evidence.

Verification:

- Core task/Apply/kernel matrix -> 16 passed; Core parser/adapter/validator projection matrix -> 38 passed.
- Server Router/Search task-consumer matrix -> 61 passed; CLI export matrix -> 17 passed.
- Web Change/Apply/Dashboard/static-provider matrix -> 31 passed.
- Core, Server, CLI, and Web package typechecks passed before documentation synchronization.

## Progress: 2026-07-16 compound Spec identity and source-aware Catalog

Changed contracts:

- Moved ClaudeCode's Web-only Spec identity skeleton into one browser-safe Core contract. `SpecIdentity` is now the discriminated union `(owned, specId) | (referenced, storeId, specId)`; one helper law owns collision-safe keys, route paths, route-parameter projection, catalog lookup, and source/read-only document types.
- Replaced the bare-id Spec Router (`list`, `listWithMeta`, `get`, `getRaw`, and the three legacy subscriptions) with `catalog`, `document`, `subscribeCatalog`, and `subscribeDocument`. Save/validate accept only `OwnedSpecIdentity`; no compatibility aliases remain.
- Built the live Catalog from planning-root owned metadata plus the direct Root Context Reference index. Referenced documents are accepted only when the exact Store/spec pair is present in that index, then projected through typed `openspec show <specId> --type spec --store <storeId> --json` evidence. Unrelated registered Stores are not exposed as project References.
- Preserved referenced CLI JSON, stdout, stderr, diagnostics, contract drift, and exit status. Referenced detail renders the upstream Spec title, overview, Requirement text, and raw Scenarios as read-only data; it does not invent Requirement titles or convert that payload into writable local Markdown.
- Migrated Web subscriptions, cache priming, links, shared-element keys, route semantics, and detail prefetch to compound identity. Removed `/specs/$specId`; live and static route trees now expose only Owned and Referenced compound routes.
- Migrated Search document ids, hrefs, and displayed paths. Owned bodies remain planning-root documents; direct References contribute only the summaries present in the CLI Reference index, never referenced changes or inferred body content.
- Added compound identity/source/read-only fields to the current static Spec snapshot, whose Section 5 entries remain Owned only. Static provider lookup, search, SSG route enumeration, and title resolution use the same Core identity helpers. Reference include/omit materialization and privacy redaction remain ordered Section 7 work.
- Added duplicate `auth` fixtures across Owned, `platform-a`, and `platform-b` through Core catalog lookup, Server CLI selection, Search records, Web links, detail rendering, View Transition cache keys, route semantics, and static Owned route enumeration.

Checkpoint state:

- Checkpoints 5.7 through 5.11 are complete. Section 5 Task and Spec Projection Contracts is complete at 11/11; checkpoint 6.1 is next.
- No loopback trigger fired. OpenSpec 1.6 provided direct Reference list/show facts without requiring writable References, recursive traversal, ownership inference, or a parallel parser.

Verification:

- Full Core suite -> 398 passed; full Server suite -> 269 passed.
- Full Web suite -> 590 passed; CLI -> 49, Search -> 4, App -> 78 passed.
- Core, Server, Web, and App package typechecks passed before documentation synchronization.
- Focused duplicate identity/catalog/search/route/provider/View Transition matrix -> 138 passed across Core, Server, Search, and Web.
- `pnpm format:check` -> 229 changed files passed; `pnpm lint:ci` -> 796 files, 0 warnings/errors; full workspace `pnpm typecheck` passed.
- `pnpm test:ci` and `pnpm test:browser:ci` passed; browser matrix -> xterm 60 passed/1 skipped and Web Storybook 12 passed.
- Clean `pnpm --filter @openspecui/web build:ssg` passed with only the existing `scroll-button` CSS warning. The rebuilt server bundle contains `/specs/owned/$specId` and no legacy `/specs/$specId` route.

## Progress: 2026-07-16 global Root Context shell identity

Changed contracts:

- Added one shared responsive shell indicator that always labels the launch project and active planning root as separate facts. Expanded desktop, collapsed desktop, mobile header, and mobile drawer variants retain the same Root Context link, Store/source provenance, and loading/refresh/error signal.
- Kept the shell informational. It links to `/context` and does not add a browser-owned root switcher, alternate writable root, inferred Store ownership, or action authority from stale data.
- Extended the project Context surface with an on-demand full-evidence disclosure. It preserves observation time, CLI availability/version/command, raw Context members, Doctor/Context stdout, stderr, diagnostics, exit status, and contract drift without crowding the high-frequency shell.

Checkpoint state:

- Checkpoint 6.1 is complete. Checkpoint 6.2 is next: Dashboard metrics and provenance must be adapted together.
- No loopback trigger fired. The shell consumes the existing single Root Context subscription and introduces no second root or environment contract.

Verification:

- Root Context indicator, Desktop Sidebar, Mobile Header, and Context disclosure matrix -> 14 passed.
- Full Web suite -> 595 passed; Web typecheck passed.
- `pnpm format:check` -> 235 changed files passed; `pnpm lint:ci` -> 798 files, 0 warnings/errors; `git diff --check` passed.
- Local Server/Web started on `http://localhost:3101` and `http://localhost:13003`. In-app browser control was unavailable in the execution environment, so real desktop/mobile screenshot acceptance remains explicitly open under checkpoint 10.9.

## Progress: 2026-07-16 Dashboard planning and repository provenance

Changed contracts:

- Kept Dashboard Spec, Change, task, and workflow metrics inside the planning-root-owned Dashboard service. A separated-root fixture now proves Launch-only Specs/Changes cannot enter those counts or recent-item lists.
- Added one live Dashboard provenance band for the exact Planning root path/source, optional Store id, and direct Reference diagnostic counts. It preserves stale Root Context data beside the latest error and never invents Reference health or machine-wide completeness.
- Renamed the existing Git block `Code Git Snapshot` and projects the backend-resolved Code repository independently from an optional distinct Planning repository. Static mode creates neither Root Context nor Git-scope requests until Section 7 snapshot provenance lands.
- Removed the Dashboard's inferred `archive-ready` label. A completed Status plus formal tracked-task completion is now `workflow-complete`; only CLI validate/archive outcomes can claim archive readiness.

Checkpoint state:

- Checkpoint 6.2 is complete. Checkpoint 6.3 is next: Changes must remain writable-root-only and use formal tracked progress for every workflow state.
- No loopback trigger fired. Dashboard provenance consumes existing Root Context, planning-service, and Git-scope contracts without adding a root selector, parallel parser, or inferred Store/Reference conclusion.

Verification:

- Dashboard provenance/state and integration matrix -> 14 passed; Planning-root service matrix -> 2 passed.
- Full Web suite -> 601 passed; full Server suite -> 269 passed.
- `pnpm format:check` -> 237 changed files passed; `pnpm lint:ci` -> 800 files with zero issues; full workspace typecheck and `git diff --check` passed.
- Clean `pnpm --filter @openspecui/web build:ssg` passed with only the existing `scroll-button` CSS warning.

## Progress: 2026-07-16 writable-root Change list semantics

Changed contracts:

- Kept Change list/query/subscription data on the planning-root Adapter. A separated-root fixture proves the list contains the Planning Change and excludes a Launch-only Change; References contribute no writable Changes.
- Replaced the workflow classifier's lossy `tasksComplete` boolean input with the formal `TrackedTaskPhase`. `complete` can contribute to `Workflow Complete`, `no-tasks` renders `No Tracked Tasks`, and neither state implies archive readiness.
- Updated list copy to name the current writable Planning root and replaced `0% task completion` for `0/0` with explicit `No tracked tasks` evidence.

Checkpoint state:

- Checkpoint 6.3 is complete. Checkpoint 6.4 is next: Change detail must preserve CLI paths/context, expose Update, Reference context, and strict validate/archive diagnostics.
- No loopback trigger fired. The page consumes existing planning-root and formal task contracts without adding Reference Changes, writable secondary roots, or a compatibility progress alias.

Verification:

- Change list plus Dashboard classifier matrix -> 13 passed; separated planning-root service matrix -> 2 passed.
- Full Web suite -> 602 passed across 110 files.
- Web and Server package typechecks, focused Prettier check, and `git diff --check` passed before documentation synchronization.

## Progress: 2026-07-16 Change detail CLI evidence and archive arbitration

Changed contracts:

- Migrated reactive Status, artifact Instructions, and Apply Instructions to the typed CLI contract executor and the Root Context-derived Store selector. Explicit Store detail can no longer resolve Status correctly while pulling Instructions from another root.
- Added a required `ChangeStatus.provenance` union. Live Status preserves CLI `planningHome`, `changeRoot`, `artifactPaths`, `existingOutputPaths`, `nextSteps`, `actionContext`, and root source; static Status states that CLI provenance is unavailable instead of synthesizing paths.
- Added a read-only Change evidence band for CLI paths/action context and direct Root Context Reference diagnostic counts. Full artifact paths, allowed edit roots, linked context, constraints, and next steps remain available on demand without inferred health or completeness.
- Kept `Update` and every existing workflow action, but delegated `Archive` to the real CLI validation/archive dialog. The frontend no longer disables Archive from `status.isComplete`; CLI validation and archive outcomes decide applicability.
- Made archive preflight `validate <change> --type change --strict`, followed by archive only after the serial queue succeeds. Verify and Archive surfaces retain multiline diagnostics such as `archive_spec_update_failed`; no synthesized retry or implicit validation bypass is started after failure.

Checkpoint state:

- Checkpoint 6.4 is complete. Checkpoint 6.5 is next: Specs must default to Owned and provide a Store-grouped Referenced view with immutable entries.
- No loopback trigger fired. OpenSpec 1.6 typed Status/Instructions and strict command outcomes supplied every required fact without a parallel parser, browser-owned applicability rule, or writable Reference path.

Verification:

- Typed Status/Instructions/Store-selector Core matrix -> 14 passed.
- Change evidence, command bar, Change detail, strict Archive/Verify, CLI runner, and static provider matrix -> 27 passed.
- Full Core suite -> 399 passed; full Server suite -> 269 passed; full Web suite -> 607 passed.
- `pnpm format:check` -> 239 changed files passed; `pnpm lint:ci` -> 802 files with zero issues; full workspace typecheck and `git diff --check` passed.
- Clean `pnpm --filter @openspecui/web build:ssg` passed with only the existing `scroll-button` CSS warning.

## Progress: 2026-07-16 Owned-default and Store-grouped Spec Catalog

Changed contracts:

- Replaced the flat mixed-source Spec list with an explicit Owned/Referenced segmented view. Owned is always the initial project view and contains only writable Planning-root Specs.
- Grouped Referenced entries by exact Store id, retained read-only state in group and row semantics, and kept every link/cache/View Transition identity compound. Duplicate `specId` values across Owned, `platform-a`, and `platform-b` remain independently navigable.
- Added source-specific empty states. Referenced absence is `No Referenced Specs currently observed`; it does not claim that no machine-wide References exist.
- Reused the same Catalog and row renderer in live/static mode. Static snapshots that currently contain only Owned entries render the same source control without inventing Reference groups before Section 7 materialization.

Checkpoint state:

- Checkpoint 6.5 is complete. Checkpoint 6.6 is next: Spec detail must show source/read-only state, disable Reference mutation, and return to the correct list scope.
- No loopback trigger fired. The view uses the existing Core Catalog and compound routes without a parallel Reference registry, recursive traversal, or flattened id lookup.

Verification:

- Spec list/detail/static-provider focused matrix -> 5 passed.
- Full Web suite -> 608 passed across 111 files; Web typecheck, focused Prettier check, and `git diff --check` passed.

## Progress: 2026-07-16 Spec detail source and return scope

Changed contracts:

- Spec detail resolves the compound route identity before rendering and labels Owned versus exact Store-backed Referenced sources in the header.
- Referenced detail renders only the read-only CLI projection and never mounts the Owned Markdown pipeline or exposes a Spec mutation control; the server mutation contract remains restricted to `OwnedSpecIdentity`.
- Detail back navigation carries an explicit Owned/Referenced list-scope state. Returning from a referenced detail restores the Store-grouped Referenced view, while Owned detail returns to the default Owned view.

Checkpoint state:

- Checkpoint 6.6 is complete. Checkpoint 6.7 is next: Archive must remain writable-root-only and never synthesize a validation-bypass retry.
- No loopback trigger fired. The scope handoff is presentation state only and does not alter Spec identity, Store resolution, or mutation authority.

Verification:

- Full Web unit suite -> 609 passed across 111 files.
- Web package typecheck, focused Prettier check, and `git diff --check` passed.

## Progress: 2026-07-16 writable-root Archive and strict queue settlement

Changed contracts:

- Kept Archive list, detail, files, previews, and subscriptions on the planning-root service. A separated Launch/Planning fixture now proves the list contains only the Planning-root archive; a router test independently proves Archive never falls back to `launchProjectAdapter`.
- Updated Archive list, empty-state, and missing-detail copy to name the current writable Planning root instead of the ambiguous current project. References and Launch-only archives remain outside that projection.
- Preserved the serial strict preflight law: `validate <change> --type change --strict` must exit zero before archive runs. The follow-up archive command may avoid duplicate validation, but a failed or indeterminate preflight leaves it idle; no synthesized `--no-validate` retry starts.

Checkpoint state:

- Checkpoint 6.7 is complete. Checkpoint 6.8 is next: Config must render Project Binding, Active Root Config, and Environment Global Config as three distinct ownership sections.
- No loopback trigger fired. The Archive surface consumes existing planning-root, Root Context Store-selector, CLI exit-status, and mutation-invalidation contracts without a second archive source or browser-owned readiness rule.

Verification:

- Archive list/detail/modal/CLI-runner Web matrix -> 13 passed.
- Planning-root and Router Server matrix -> 58 passed.
- Web and Server package typechecks, focused lint, focused Prettier check, and `git diff --check` passed.

## Progress: 2026-07-16 independent-review CLI evidence and Store corrections

Changed contracts:

- Completed the command-specific OpenSpec CLI adapter surface with complete process facts, raw JSON payload, typed data, structured diagnostics, contract drift, root provenance, and exit status. Exported schemas, option interfaces, executor methods, and the contract barrel now carry public intent documentation.
- Changed root and Store option construction from truthiness to presence semantics. Explicit empty Store, schema, id, and remote values now reach the official CLI so it can return its own invalid selector or argument evidence instead of OpenSpecUI silently falling back.
- Restored the beta Store UI projection as a physically separate lenient Zod contract. The strict typed executor remains authoritative; the Server projects its already parsed payload, preserves complete evidence on success and failure, supports empty healthy Stores and partial Doctor facts, and never reparses stdout.

Checkpoint state:

- Checkpoints 2.2, 2.3, and 2.4 are complete. Checkpoints 2.6 and 2.7 are next: Sync and Update compose prompts must preserve their action intent alongside complete CLI evidence.
- No loopback trigger fired. The correction strengthens the approved CLI-first boundary and does not add a parser, registry, root selector, or compatibility alias.

Verification:

- Core command-result, argv, and Store projection matrix -> 26 passed across 3 files.
- Server Router and workflow invocation matrix -> 69 passed across 2 files.
- Core, Server, and Web package typechecks passed; `git diff --check` passed.

## Progress: 2026-07-16 Sync and Update intent/evidence correction

Changed contracts:

- Added one browser-safe Core workflow vocabulary for all twelve OPSX actions, core profile membership, input-shape groups, command-capable actions, labels, and official skill-directory mappings. Hooks, tool initialization, Server validation/mode resolution, and Web controls now consume that shared source.
- Compose prompts now retain the action-specific Sync or Update instruction before the raw CLI Status document. Root Context, explicit Store selector, typed Status evidence, process diagnostics, and hook v2 evidence remain attached to the same result.
- The Web compose surface retains the complete command evidence in a secondary disclosure while keeping the generated prompt and planning-root target in the primary workflow.

Checkpoint state:

- Checkpoints 2.6 and 2.7 are complete. Checkpoint 2.11 is next: first-party executable CLI fixtures must prove the 1.4, 1.5, and 1.6 behavior contracts.
- No loopback trigger fired. Workflow vocabulary moved to Core without changing action meaning, invocation ownership, or static fallback behavior.

Verification:

- Core tool initialization matrix -> 8 passed.
- Server workflow and Router matrix -> 71 passed across 2 files.
- Web compose, profile, and Config matrix -> 12 passed across 3 files.
- Core, Server, and Web package typechecks passed; the new Core subpath build passed; `git diff --check` passed.

## Progress: 2026-07-16 executable official CLI contract fixtures

Changed contracts:

- Added lockfile-pinned npm aliases for the official OpenSpec CLI 1.4.0, 1.5.0, and 1.6.0 packages. Contract acceptance now executes each published binary directly; the existing source-provenance assertions are no longer the only evidence.
- The 1.4 fixture initializes a real core-profile project and proves Sync command/skill delivery while Update remains absent. The 1.5 fixture creates a real empty Store and proves healthy Doctor facts plus declared and explicit root provenance.
- The 1.6 fixture uses isolated temporary XDG environments and real roots to prove nearest, declared, and explicit Store selection; direct References; empty healthy Store diagnostics; core Sync and Update delivery; tracked-task glob aggregation; strict archive failure; scenario-loss protection with byte-identical preservation; empty-selector invalid_store_id; and unknown-Store failure.

Checkpoint state:

- Checkpoint 2.11 is complete. All independent-review reopenings for the CLI 1.6 contract baseline are now closed.
- No loopback trigger fired. Every required Phase 1 fact was available from the supported published CLI binaries, JSON documents, exit status, and real filesystem effects.

Verification:

- Official executable CLI fixture matrix -> 3 passed: 1.4, 1.5, and complete 1.6 behavior.
- Core package typecheck passed with the pinned fixture packages and no type assertions in the fixture harness.

## Verification: 2026-07-16 independent-review correction gates

- `pnpm format:check` passed across 256 changed files.
- `pnpm lint:ci` passed across 808 files with zero warnings and zero errors.
- `pnpm typecheck` passed across all 15 runnable workspace packages; Website reported zero errors and zero warnings.
- `pnpm test:ci` passed: root 43, Core 405, Server 275, Web 617, App 78, CLI 49, and every remaining workspace package.
- `pnpm test:browser:ci` passed: xterm-input-panel 60 with one existing skip; Web Storybook 12.
- Fresh `pnpm --filter @openspecui/web build:ssg` passed. The only CSS warning is the pre-existing unsupported `scroll-button` pseudo-element warning.
- `git diff --check` and frozen offline lockfile installation passed.

## Verification: 2026-07-16 clean-environment Core subpath resolution

Changed contracts:

- Added the public `@openspecui/core/store-types` source alias to the shared TypeScript path map and to the CLI package's overriding path map. Server and CLI clean typecheck lanes now resolve the same exported Core subpath without depending on a previously built `packages/core/dist`.
- Kept the package export and runtime contract unchanged. Browser Gate had no independent failure; its shard was skipped after Fast Gate failed, and the aggregate Browser Gate correctly propagated that skipped dependency state as failure.

Root cause and checkpoint state:

- PR #207 Fast Gate failed in a clean checkout because `packages/server/src/store-observation-service.ts` imports `@openspecui/core/store-types`, but the source alias was absent. Local verification had passed only while stale Core declarations existed in `packages/core/dist`.
- No product checkpoint transitioned. This repairs the delivery evidence for the already completed Store observation and CLI contract slices; final verification and PR gates remain open until all implementation checkpoints complete.
- No loopback trigger fired. The fix changes build-time source resolution only and does not alter package boundaries, runtime behavior, or approved product scope.

Verification after removing `packages/core/dist`:

- Server and CLI package typechecks passed; Store observation/fallback tests passed 9/9.
- `pnpm format:check` passed; `pnpm lint:ci` passed across 808 files with zero warnings and errors; `pnpm typecheck` passed across all 15 runnable workspace packages.
- `pnpm test:ci` passed: root 43, Core 405, Server 275, Web 617, App 78, CLI 49, and every remaining workspace package.
- `pnpm test:browser:ci` passed: xterm-input-panel 60 with one existing skip; Web Storybook 12.
- Fresh `pnpm --filter @openspecui/web build:ssg` passed with only the existing `scroll-button` CSS warning; `git diff --check` passed.

## Independent Re-review: 2026-07-16 PR #207 root and mutation boundaries

Review target: `origin/main...31fe6f6`. Remote Changeset, CI Scope, Fast Gate, Web browser, xterm browser, and aggregate Browser Gate checks passed before this semantic review.

Standards findings:

- Checkpoint 2.3 reopened: buffered typed commands preserve explicit empty Store selectors, but `validateStream` and `archiveStream` still use truthiness and silently drop `store: ''`.
- Checkpoints 3.5 and 6.7 reopened: Global Archive reconstructs the Root Context Store selector in the browser, imports the Core root entry at runtime, and sends generic CLI command arrays. The dedicated Server validate/archive procedures already own selector derivation but are bypassed by this surface.

Spec findings:

- Checkpoint 3.5 reopened: Root Context converts every non-info Reference diagnostic into a root-resolution failure. OpenSpec 1.6 intentionally degrades missing or unhealthy References to warning evidence while preserving successful root operation.
- Checkpoints 3.11 and 5.2 reopened: task mutation accepts an unguarded `changeId`, always writes top-level `tasks.md`, and receives only one flattened task index. It cannot mutate the exact tracked file selected by a custom `apply.tracks` glob and does not enforce the selected entity-root boundary.

No loopback trigger fired. All findings correct existing approved contracts without changing product scope, security posture, package ownership, or the Intake non-goals.

## Progress: 2026-07-16 independent re-review root and mutation corrections

Changed contracts:

- Preserved explicit empty Store selectors in buffered and streaming CLI surfaces. `validateStream` and `archiveStream` now use presence semantics consistently with the typed contract executor.
- Kept successful writable-root resolution available when OpenSpec reports degraded Reference warnings. Warning evidence remains in Root Context; only error-level Reference diagnostics can produce `references-unresolved`.
- Added exact `{ filePath, taskIndex }` identity to every formal tracked task. Glob-expanded tasks retain their physical source, the Server resolves that source through the guarded Planning-root entity path, and the fixed top-level `tasks.md` Adapter mutation was removed without an alias.
- Hardened entity-root resolution against `changeId` and entry-path traversal before task and artifact writes.
- Replaced Global Archive's browser-authored Store selector and generic CLI queue with one typed `archiveStrictStream`. The Server resolves Root Context once, runs strict validation, starts archive only after exit zero, preserves nonzero diagnostics without retry, and owns mutation invalidation and cancellation across both phases.
- Removed the Global Archive runtime import of the Core root entry; its remaining Core dependency is type-only inside the shared runner.

Checkpoint state:

- Re-closed checkpoints 2.3, 3.5, 3.11, 5.2, and 6.7 after focused regression evidence passed. Overall progress returns to 57/130.
- No loopback trigger fired. The corrections preserve the approved CLI-first, single writable root, tracked-artifact, and strict archive laws.

Verification:

- Focused Core root/selector/task/parser/Adapter matrix -> 66 passed; focused Server strict archive and guarded mutation matrix -> 3 passed; focused Web archive runner/task matrix -> 8 passed.
- `pnpm format:check` passed across 24 changed files; `pnpm lint:ci` passed across 809 files with zero warnings and errors; `pnpm typecheck` passed across all 15 runnable workspace packages.
- The first full test run exposed one stale PlanningRootService fixture expectation after removing the old Adapter toggle. Its isolated test passed 2/2 after aligning the expected unchecked file and Dashboard count.
- Final `pnpm test:ci` passed: root 43, Core 408, Server 277, Web 618, App 78, CLI 49, and every remaining workspace package.
- `pnpm test:browser:ci` passed: xterm-input-panel 60 with one existing skip; Web Storybook 12.
- Fresh `pnpm --filter @openspecui/web build:ssg` passed with only the existing `scroll-button` CSS warning; `git diff --check` passed.

## Verification: 2026-07-16 tracked-task Router fixture closure

- Added the missing `readChangeTaskProjection` contract to the Server Router test Adapter. The fixture now returns the two exact `work/backend/tasks.md` task locations used by the separated Launch/Planning mutation matrix; no production contract changed.
- Focused Router verification passed 61/61, including exact tracked-file mutation, canonical `changeId` rejection, entity-path escape rejection, and non-tracked Markdown rejection.
- Current full gates passed: `pnpm format:check` across 27 changed files; `pnpm lint:ci` across 809 files; all 15 workspace typechecks; `pnpm test:ci` with Root 43, Core 408, Server 277, Web 618, App 78, and CLI 49; browser tests with xterm 60 passed/1 skipped and Web Storybook 12 passed; fresh SSG with only the existing `scroll-button` warning; and `git diff --check`.
- OpenSpec progress remains 57/130. No checkpoint transition or loopback trigger occurred; this closes stale test infrastructure after the already recorded root/mutation correction.

## Decisions Taken

The following approved decisions constrain implementation:

- OpenSpec CLI JSON, diagnostics, resolved paths, and exit status are authoritative. OpenSpecUI does not recreate root, Store, Reference, validation, archive, or task semantics.
- One project backend has one launch project and one CLI-selected writable planning root. References add read-only Specs, not writable workspaces.
- OpenSpecUI inherits `XDG_DATA_HOME` consistently and adds no project `.env`, registry overlay, or StoreRoot abstraction.
- `packages/web` owns the project workspace. `packages/app` owns backend connections, environment identity, and experimental Store administration.
- Runtime environment identity is the backend-issued opaque `envUri`; `apiBaseUrl` locates one backend instance.
- Hosted capabilities are `stores.inspect`, `stores.mutate`, and `contexts.inspect`; they are compatibility facts, not authorization.
- The optional Backend Access Gate is one whole-backend Bearer credential and not a user or permission system.
- Store mutations are backend-owned, survive client disconnect, never auto-retry, and report unrecoverable terminal loss as `indeterminate`.
- Reactive consistency is `push invalidation -> client pull`; the effective data home, project roots, and registered Store roots all belong to the observation domain.
- Task facts are `trackedTaskProgress`, `documentChecklistSummary`, and `applyInstructionProgress`; no generic `progress` compatibility alias remains.
- Spec identity is `(owned, specId)` or `(referenced, storeId, specId)` across live and static routes, search, caches, provider lookups, and SSG.
- Static Reference export requires explicit `include|omit`, follows only direct resolved References through CLI list/show, fails rather than publishes a partial include, and removes machine-sensitive provenance.
- Store Manager uses Inspector as primary, Context Matrix as sibling, and Inventory as the wide-screen scan. It remains experimental and is not the 6.0 support gate.
- Breaking code-contract updates do not add legacy aliases by default. Any protocol compatibility need must be physically isolated and returned to plan review.

## Divergence Notes

- The convergence ticket initially named the conventional `proposal`, `design`, `specs`, and `tasks` artifacts. The existing change actually declares `opsx-collab-pr-loop`, whose formal artifacts are `intake`, `research-plan`, `implementation`, and `checkpoints` under `loop/`. The ticket and execution path were corrected to the CLI-declared schema before artifacts were written.
- The local OpenSpec CLI used to manage artifacts reports `1.5.0`, while the product target and checked-out authority are 1.6.0. Planning follows the local schema, but implementation acceptance must execute or fixture the pinned 1.6 contracts. No target behavior is inferred from the local artifact CLI version.
- `openspec validate <item>` validates conventional Spec/delta content rather than custom artifact-graph completeness. The local 1.5 CLI also predates the 1.6 proposal-less change-resolution fix and reports this loop-only change as `unknown_item`. Planning readiness is therefore verified through schema validation, `status` artifact completeness, and `instructions apply` task projection; the generic delta validator is not reported as a passing gate.
- The manager split execution temporarily: this Codex owns the backend/kernel first while ClaudeCode drafts frontend/App surfaces. This changes work allocation, not approved product scope or architecture.

## Loopback Triggers

Return to `loop/intake.md` and `loop/research-plan.md` for explicit manager approval before continuing if any of these occur:

- A required root, Reference, Store, workflow, validation, archive, or task fact cannot be obtained from the supported OpenSpec 1.6 CLI JSON/exit contract.
- Root-correct operation would require maintaining launch-directory and planning-root implementations in parallel rather than replacing the old assumption.
- Stable `envUri` cannot be produced without exposing raw host identity or effective data-home paths to clients.
- The Backend Access Gate cannot cover HTTP, tRPC subscriptions, and PTY WebSocket uniformly without creating transport-specific authorization semantics.
- Multi-root reactive observation cannot release watchers safely, cannot recover from Store unregister/removal, or requires polling to remain the primary consistency mechanism.
- Referenced Specs require writable actions, recursive References, or an ownership/completeness conclusion not present in OpenSpec CLI facts.
- Static Reference inclusion cannot be complete and machine-safe without serializing forbidden paths, remotes, registry values, or backend identity.
- The three task projections cannot remain type-distinct without a public compatibility alias.
- Store Manager begins to block the 6.0 root/Reference correctness baseline or requires a new package before a second consumer exists.
- A phase changes user-visible scope, security posture, destructive behavior, package boundaries, release law, or any Non-Goal from Intake.
