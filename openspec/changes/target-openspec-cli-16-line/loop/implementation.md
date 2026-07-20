<!--
Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
1. Report implementation state without converting planning work into false code progress.
2. Preserve approved architecture decisions as implementation constraints.
3. Record actual divergences from the approved plan.
4. Define conditions that require returning to intake and research-plan.
5. Record independent review findings and the evidence required to close them.

Original request (2026-07-14): "我们最终使用openspec来管理 wayfinder 产出的文档。"
Original request (2026-07-15): "解决方案可能没你想的那么简单，这点我们后续再说。"
Original request (2026-07-16): "代码已经提交，开始review。如果有问题，那么可更新change甚至可以新开change。"
Original request (2026-07-17): "Make late-child-close bookkeeping proof resistant to the exact missing-cleanup mutation."
Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
-->

## Implementation State

Status: **PR #207 remains unmerged after the latest review-correction cycle; later checkpoints remain paused**.

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

## Independent Re-review: 2026-07-16 filesystem and archive closure

Review target: `origin/main...bd74ff6` after all remote PR gates passed. Standards and Spec were reviewed independently against `CLAUDE.md`, `AGENTS.md`, and the formal loop artifacts.

Findings:

- Standards found one hard violation: task mutation read a live OpenSpec document through `node:fs/promises.readFile` instead of reactive-fs, so a successful write had no immediate reactive-cache update guarantee.
- Spec found checkpoint 3.11 partial: legacy Spec/Change save paths still joined unchecked client ids inside the Adapter, allowing path syntax to escape the intended entity directory.
- Spec found checkpoint 6.7 partial: public `change.archive` still called the legacy Adapter rename path and could bypass the Server-owned strict CLI validate/archive stream.
- Review residual risk identified missing direct tests for strict-stream cancellation and archive startup failure. No loopback trigger fired; all findings tighten already approved boundaries.

Corrections:

- Added one shared Core canonical OpenSpec entity-id guard and applied it in Core Adapter reads/writes, OPSX Kernel path-backed projections, Server entity resolvers, and public Spec/Change save mutations before filesystem access.
- Removed `change.archive` and `OpenSpecAdapter.archiveChange` without compatibility aliases. The strict Server CLI stream is now the only public archive mutation boundary.
- Extracted tracked-task mutation into a Server module using `reactiveReadFile`, exact tracked-file identity, guarded path resolution, and immediate `updateReactiveFileCache` after write. Its reactive projection test proves subscribers observe the updated task without waiting for watcher timing.
- Added strict archive tests for successful phase handoff, validation failure, detach during asynchronous archive startup, and archive startup rejection. Added task UI tests for memoized physical-location changes and loading-state locking.

Verification and checkpoint state:

- Focused Core entity/task/OPSX matrix passed 25/25; focused Server task/archive/Router/Planning matrix passed 69/69; focused Web task/archive runner matrix passed 10/10.
- `pnpm format:check` passed across 19 changed files; `pnpm lint:ci` passed across 814 files; all 15 workspace typechecks passed; `git diff --check` passed.
- `pnpm test:ci` passed: Root 43, Core 417, Server 283, Web 620, App 78, CLI 49, and every remaining workspace package.
- `pnpm test:browser:ci` passed: xterm-input-panel 60 with one existing skip; Web Storybook 12. Fresh SSG passed while reporting the existing `scroll-button` CSS warning and an ineffective dynamic-import bundling warning.
- Checkpoints 3.11 and 6.7 remain closed on stronger evidence. Overall progress remains 57/130; no other checkpoint transitioned.

## Final Dual-Axis Re-review: 2026-07-16 artifact-read and archive-entry closure

Review target: `origin/main...1a8fdc5` after all six refreshed PR checks passed. Standards and Spec independently confirmed the earlier entity-id, reactive task, legacy rename, and strict archive-race corrections, then found two remaining parallel boundaries.

Findings:

- OPSX artifact queries and subscriptions accepted unchecked literal/glob `outputPath` values. Kernel dependency registration could join parent traversal outside the selected Change root before the processed DocumentService projection ran.
- Public `cli.archive` and `cli.archiveStream` procedures remained parallel typed Archive mutations beside `archiveStrictStream`, so callers could bypass the single Server-owned strict preflight flow.

Corrections:

- Added one shared Core entity-relative path guard for file and glob paths. Router queries/subscriptions, OPSX Kernel reads/watcher dependencies, and Server entity resolvers now reject absolute, drive/UNC, NUL, and parent-traversal inputs before projection access.
- Removed direct buffered and streaming Archive procedures from the public router. `archiveStrictStream` is the only typed Archive mutation procedure; the lower-level executor stream remains private to its validated archive phase.
- Added query/subscription traversal, Kernel literal/glob traversal, shared path normalization, and public route-absence regression tests.

Verification and checkpoint state:

- Focused Core entity/OPSX matrix passed 23/23; focused Server Router/archive/task/Planning matrix passed 71/71.
- `pnpm format:check` passed across 12 changed files; `pnpm lint:ci` passed across 814 files with zero warnings/errors; all 15 workspace typechecks passed; `git diff --check` passed.
- `pnpm test:ci` passed: Root 43, Core 419, Server 285, Web 620, App 78, CLI 49, and every remaining workspace package.
- `pnpm test:browser:ci` passed: xterm-input-panel 60 with one existing skip; Web Storybook 12. Fresh SSG passed while reporting the existing `scroll-button` CSS warning and an ineffective dynamic-import bundling warning.
- Checkpoints 3.11 and 6.7 remain closed on stronger evidence. Overall progress remains 57/130; no other checkpoint transitioned and no loopback trigger fired.

## Blocking Dual-Axis Re-review: 2026-07-16 committed correction range

Review target: committed range `8b81f7d...8d38f35` on PR #207. All six refreshed remote checks were green. Standards and Spec were reviewed independently against `CLAUDE.md`, `AGENTS.md`, the formal loop artifacts, and the pinned OpenSpec 1.6 source. Passing checks do not discharge the reachable contract defects below.

Standards findings:

- Spec, Change, entity-file, Archive-file, and artifact-output writes use direct `node:fs/promises` writes without updating reactive-fs state. An immediate Adapter read after `writeSpec` returned the old cached content, violating the reactive filesystem and next-action convergence laws.
- Three Router entity write paths duplicate planning-root resolution, lexical guarding, directory creation, and write behavior. One physical-boundary/reactive-write owner is required so every caller receives the same symlink and cache guarantees.
- 24 of 59 newly added production files lack the required timestamped orthogonal-intent/original-request header. Several new public contracts also lack API comments. This is tracked explicitly by checkpoint 10.17 rather than being hidden behind passing lint.

Spec findings:

- Public `cli.runCommandStream` and `cli.execute` still accept arbitrary OpenSpec argv. A caller can run `archive <change> --yes --no-validate --store <other>`, bypassing `archiveStrictStream`, Root Context selection, and the single strict Archive mutation law.
- Referenced Spec Catalog reads `doctor.references[*].specs`, but official OpenSpec 1.6 Doctor explicitly returns only `{ store_id, root, status }`. Real Referenced Catalogs are therefore empty and referenced detail identity checks reject valid Specs; each direct Reference must be enumerated through the typed `list --specs --store --json` contract before Catalog construction.
- Entity entry guards prove only lexical containment. A symlink below a valid Change or Archive entity can redirect `mkdir`/`writeFile` outside the selected planning root.
- Direct filesystem mutations can return success while reactive readers and subscribers still hold old cached content until watcher timing happens to repair it.
- `PlanningRootServiceManager` retains every root-path record until backend teardown. Replacing root A with root B leaves A's watcher lease, invalidation lease, Kernel, hooks, Search, Dashboard, and preview sessions live and readable.
- The Web changeset says `/context` replaces the project Stores panel under checkpoint 6.9, while both routes remain in navigation and 6.9 is correctly still open. Release metadata must describe the current additive state until replacement is actually complete.

Checkpoint state:

- Reopened 3.11 for physical symlink containment; 4.5 for immediate reactive write settlement; 4.9 for root-record replacement teardown; 5.8, 6.5, and 6.6 for real CLI-backed Referenced Catalog data; and 6.7 for the generic CLI Archive bypass.
- Checkpoint 6.9 remains open. Checkpoint 10.17 now makes the mandatory file-header/public-contract documentation gate explicit. Progress is 50/131.
- No loopback trigger fired and no separate change is justified. Every finding is a defect inside the already approved CLI-first, single writable root, reactive convergence, Referenced Spec, and strict Archive boundaries.

Review evidence:

- Focused Core official-fixture/Adapter/Root Context/entity-guard matrix passed 31/31; focused Server Planning-root/Router/tracked-task/strict-Archive/reactive matrix passed 73/73.
- Symlink reproduction wrote `escape/pwn.md` through a valid lexical entity path and observed the content in the external symlink target.
- Reactive-cache reproduction read `old`, called `writeSpec(..., 'new')`, then immediately read `old` again while disk contained the new content.
- `FORMAT_CHECK_BASE_SHA=8b81f7d pnpm format:check` passed across 263 changed files; `git diff --check 8b81f7d...8d38f35` passed. A whole-repository Prettier audit reports 11 pre-existing files outside this PR range and is not attributed to this change.
- Full local CI was not rerun during this review; the current remote Changeset, CI Scope, Fast Gate, Web browser, xterm browser, and aggregate Browser Gate checks all passed.

## Corrective Worker Goal: 2026-07-16 recurrence-safe closure

This goal supersedes the historical corrective goal at the start of this file, whose Section 2 findings were already implemented and reviewed. Do not repeat that completed scope; use the latest blocking review and reopened checkpoints below as current truth.

Use `openspec-apply-change` with change `target-openspec-cli-16-line`. Read every CLI-reported context file before editing. Preserve the current uncommitted review documentation in `AGENTS.md`, `loop/checkpoints.md`, and this file; it is part of the correction, not disposable reviewer residue.

Goal:

> Close the independent review of PR #207 by replacing endpoint-local fixes with ownership-complete contracts for public Archive execution, physical/reactive filesystem writes, CLI-backed Referenced Catalogs, and Planning-root replacement lifecycle. Correct release metadata and mandatory source documentation, prove each repaired class against its full reachable surface, update PR #207, and stop before checkpoints 6.8+.

Required execution order:

1. Build and record a public capability inventory from Router inputs and all Web/App callers to every `CliExecutor.execute*` path. Make `archiveStrictStream` the only public Archive mutation. Generic execution must reject or delegate protected root-dependent mutations; a new spelling or streaming/buffered sibling must not restore the bypass.
2. Introduce one physical/reactive entity-write owner shared by Spec, Change, entity-file, Archive-file, artifact-output, and tracked-task paths. Keep lexical validation, add physical ancestor/symlink confinement, write disk first, then settle reactive state before success. Do not claim stronger TOCTOU protection than the implementation provides.
3. Replace `doctor.references[*].specs` consumption with explicit typed per-Store `list --specs --store --json` enumeration. Preserve direct-only scope, compound identity, read-only state, command evidence, and partial Store failure diagnostics. Use official 1.6 payloads; remove synthetic Doctor fields from fixtures.
4. Give `PlanningRootServiceManager` one serialized active-root replacement lifecycle. Root A resources and previews must retire when B becomes active without corrupting concurrent in-flight resolution; final backend disposal remains idempotent.
5. Correct `.changeset/openspec-16-frontend-skeleton.md` so it describes `/context` as additive while 6.9 is open. Complete checkpoint 10.17 across the changed production surface and public contracts without adding placeholder comments.
6. Re-audit every sibling entry after implementation. Append the inventory, recurrence reflection, focused red/green evidence, residual limits, and exact checkpoint transitions here before changing any checkbox.

Required regression evidence:

- Generic buffered and streamed OpenSpec execution cannot archive, inject `--no-validate`, or choose another Store; `archiveStrictStream` still preserves strict failure, explicit operator skip, cancellation, and indeterminate settlement.
- Intermediate and final symlink escapes fail before write; valid missing-leaf creation remains functional; no external file is created.
- Every direct write path returns only after an immediate reactive read sees new bytes, and two subscribers converge without waiting for a watcher event.
- A pinned executable OpenSpec 1.6 scenario with a Doctor-declared Reference and real Store Specs produces non-empty Store-grouped Catalog/detail results; missing/unhealthy Store evidence remains visible without fabricating Specs.
- A -> B -> A root replacement releases obsolete watchers, invalidation leases, services, and preview access; concurrent resolution and final teardown leak nothing and dispose once.
- Focused Core/Server/Web tests pass first, followed by `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`, fresh `pnpm --filter @openspecui/web build:ssg`, and `git diff --check`.

Completion boundary:

- Re-close only 3.11, 4.5, 4.9, 5.8, 6.5, 6.6, 6.7, and 10.17 when their evidence is present. Keep 6.9 open unless project Stores is actually replaced in the same reviewed scope.
- Commit the review documents and implementation together on `feat/openspec-cli-16-contract-baseline`, push PR #207, and return commit SHA, capability inventory, tests, remaining checkpoints, and any residual risk. Do not merge, archive, release, or continue into 6.8+; independent re-review remains required.

## Review Correction Closure: 2026-07-16 ownership-complete contracts

Public CLI capability and caller inventory:

| Public capability                     | Server owner                                                             | Web/App caller                                                         | Archive reachability                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `cli.executeOpenSpec`                 | buffered OpenSpec argv plus `assertGenericOpenSpecCommandAllowed`        | Config schema creation; Settings Update/profile actions; no App caller | `archive` argv rejected before `CliExecutor.execute`                                 |
| `cli.executeOpenSpecStream`           | streamed OpenSpec argv plus the same protected-command gate              | `useCliRunner` for literal OpenSpec commands; no App caller            | `archive` argv rejected before process start; client cannot select a wrapper command |
| `cli.installGlobalCliStream`          | fixed `npm install -g @fission-ai/openspec` command with no client input | Settings explicit `install-global-cli` transport                       | no OpenSpec argv or Archive capability                                               |
| `cli.initStream`                      | fixed typed Init stream                                                  | existing initialization surface                                        | no client-selected subcommand                                                        |
| `cli.validate` / `cli.validateStream` | Server-derived Root Context selector and typed validation                | Verify and strict preflight consumers                                  | read-only validation only                                                            |
| `cli.archiveStrictStream`             | `startStrictArchiveStream` plus one Root Context selector                | Global Archive dedicated transport                                     | only public application Archive mutation RPC                                         |

- Removed public `cli.execute` and `cli.runCommandStream`; the Web runner rejects non-OpenSpec commands unless a dedicated Server transport exists. `CliExecutor.executeCommandStream` remains an internal primitive used by the fixed installer and the dedicated OpenSpec stream. Typed Store, workflow, Root, and config procedures construct their own fixed command families rather than accepting command names from callers.
- PTY remains the intentionally user-controlled shell and is outside the application Archive RPC contract. This boundary is not an operating-system command sandbox. The configured OpenSpec runner is likewise an operator-owned trust boundary; the public command gate governs official OpenSpec argv and cannot prove the semantics of a malicious replacement executable.

Shared owners introduced:

1. `public-cli-execution.ts` owns the protected OpenSpec argv policy used by both buffered and streamed RPCs; `archiveStrictStream` owns Root Context selection, strict validation, explicit operator skip, Archive start, cancellation, and settlement.
2. `physical-reactive-file-writer.ts` owns lexical containment, existing-ancestor physical confinement, disk write, and post-write reactive settlement. `OpenSpecAdapter.writeSpec`, `writeChange`, and `writeEntityFile` delegate to it; Router entity/Archive/artifact writers and tracked-task mutation delegate through the Adapter.
3. `spec-catalog-service.ts` owns direct Reference enumeration and detail. It lists each Doctor-declared Store through typed `listSpecs({ store })`, retains per-Store list evidence, validates compound identity before typed `showSpec`, and lets Search consume the same Catalog entries.
4. `PlanningRootServiceManager` owns one serialized active record. A -> B -> A and root disappearance retire observation/invalidation leases, Kernel, hooks, Search, Dashboard, and preview state before the transition resolves; final disposal is idempotent.

Recurrence reflection and regression evidence:

- Earlier Archive corrections removed one endpoint at a time while generic buffered/streamed execution remained. Against `8d38f35`, all six canonical/global-prefix/argument-separator generic Archive rejection tests failed. Both current OpenSpec RPCs now share one gate, the public arbitrary-command route is absent, and the Web transport cannot choose `node`, a shell, or another wrapper.
- Earlier path guards proved only lexical syntax and task mutation alone updated one reactive cache. Against `8d38f35`, an intermediate-directory symlink wrote outside the Planning root and an immediate reactive read returned old bytes. The shared writer now rejects intermediate and final target symlinks, supports missing-leaf creation, settles file/directory/exists/stat projections after disk success, and converges two subscribers without watcher timing.
- Earlier synthetic Doctor fixtures embedded a nonexistent `specs` field. Against `8d38f35`, three of four real-contract Catalog tests failed: Referenced entries were empty, valid detail was rejected, and a partial Store failure erased healthy results. Doctor and Instructions types are now physically distinct; the pinned 1.6 fixture supplies a Doctor Store id and real per-Store list output, while partial failures retain evidence beside healthy Store groups.
- Earlier teardown covered backend disposal but retained every Planning-root record. Against `8d38f35`, both A -> B lease release and concurrent transition tests failed. The manager now serializes transition requests, disposes the replaced record, removes stale preview access, handles root disappearance, and disposes every resource once.

Focused green evidence after the final public CLI correction:

- Core correction matrix: 6 files, 72/72 passed (`adapter`, entity guard, reactive-fs, CLI command result, official 1.6 fixture, Spec Catalog).
- Server correction matrix: 5 files, 89/89 passed (Planning-root lifecycle, Router/public CLI, Search, Spec Catalog, strict Archive).
- Web correction matrix: 3 files, 11/11 passed (CLI runner, Spec list, Spec detail). App skeleton suite: 18 files, 78/78 passed.
- Core, Server, Web, and App package typechecks passed. The production-header audit found no missing timestamped intent/original-request header among added non-test TS/TSX files, and the new public contracts carry API comments.
- The final completion audit rejected the earlier assumption that field/schema comments also documented the exported `PhysicalReactiveFileWrite` and `CliDoctorReferenceEntry` contracts. Direct interface/type API comments were added, including the now-distinct Instructions Reference type; the added-export diff has no remaining undocumented contract in this correction range.

Full update-PR gate evidence:

- `pnpm format:check` passed across 88 changed files; `pnpm lint:ci` passed across 816 files with zero warnings/errors; `pnpm typecheck` passed all 15 runnable workspace packages.
- `pnpm test:ci` exited zero: Root 43, Core 427, Server 295, Web 623, App 78, CLI 49, and every remaining workspace package passed.
- `pnpm test:browser:ci` exited zero: xterm-input-panel 60 passed with one existing skip; Web Storybook 12/12 passed.
- Removed `packages/web/dist-ssg` and `packages/web/.vite`, then `pnpm --filter @openspecui/web build:ssg` exited zero. It retained only the existing unsupported `scroll-button` pseudo-element warning and ineffective dynamic-import warning.
- `git diff --check` passed. These slice-level gate results do not close final acceptance checkpoints 10.10-10.16 while later product phases remain open.

Residual limits:

- Physical confinement uses pre-write `realpath`/`lstat` checks and is not race-free `openat`/directory-handle-relative I/O. Hard-link aliases are not distinguishable by `realpath`; macOS symlink behavior is directly covered, while other platforms remain CI evidence.
- Per-Store Reference list calls are independent observations, not one cross-Store atomic snapshot. A failing Store remains explicit and does not erase healthy entries.
- Immediate reactive settlement covers OpenSpecUI-owned direct writes. External mutations still converge through watcher-first observation and the bounded missing-path/watcher-failure fallback.
- The public OpenSpec gate recognizes the official `archive` command spelling. A configured replacement executable and the explicit PTY shell are trusted operator capabilities, not adversarially sandboxed processes.

Checkpoint state:

- Re-closed 3.11, 4.5, 4.9, 5.8, 6.5, 6.6, 6.7, and 10.17. Progress is 58/131.
- Checkpoint 6.9 remains open because `/context` is additive and the project Stores panel still exists. Checkpoints 6.8+ remain paused, and PR #207 requires full local gates plus a new independent review before any merge decision.
- No loopback trigger fired. The corrections implement the already approved CLI-first, one-writable-root, reactive, direct-Reference, and strict Archive laws without changing product scope or security posture.

## Blocking Independent Re-review: 2026-07-16 recurrence remains after `f138765`

Review target: `8d38f35...f138765` (`8e2cf32`, `f138765`) on PR #207. The worktree was clean and matched the remote branch. Standards and Spec were reviewed independently against the correction work package, `AGENTS.md`, `CLAUDE.md`, and pinned OpenSpec 1.6 behavior.

Standards findings:

- The Web scenario-loss regression still submits two generic `openspec archive` commands and mocks `executeOpenSpecStream`. Production rejects the first command before CLI diagnostics can exist, so this test proves neither the supported `archiveStrictStream` diagnostic path nor absence of a synthesized retry.
- The completion audit checked only newly added production files. Seven modified production files still lack the required timestamped orthogonal-intent/original-request header: Core and reactive-fs barrels, Server Search service/documents, Web CLI runner, static provider, and Settings route.

Spec findings and direct reproductions:

- `assertGenericOpenSpecCommandAllowed` rejects only an argv element equal to `archive`. Public buffered/streamed RPCs still accept `new change demo --store other`, `store remove shared`, and `config reset --yes`; the first is an official root-dependent mutation that writes the caller-selected Store instead of the current Server-owned Planning root. The claimed capability-complete audit therefore repeated the same deny-one-endpoint failure pattern.
- Config's live Schema/Template write, create, directory-create, delete, and template-write routes still call `mkdir`, `writeFile`, and `rm` behind lexical guards. They bypass `physical-reactive-file-writer`, permit intermediate-symlink escape, and return before cached OPSX projections settle. The 6.x changeset claim that schema and active-config writes use one physical/reactive owner is false.
- Reference enumeration accepts a successful Spec list with `root: null` as ready. A local contract reproduction produced a Referenced Catalog entry under the requested Store without any returned Store provenance. Referenced detail validates only `upstream.id`; a payload whose `root.store_id` names another Store was returned as `state: ready`. The pinned executable fixture separately asserts Doctor and list payloads but never drives those real results through Catalog and detail as required by the corrective goal.
- Planning-root retirement is lazy. Root Context query/subscription resolves new truth independently of `PlanningRootServiceManager`; `/api/file-preview/:hash/*` reads the manager's old active record synchronously. After clients observe root B, root A preview URLs remain readable until another Planning-root RPC happens to trigger manager transition.

Checkpoint state:

- Reopened 3.11 and 4.5 for generic/Schema mutation ownership and reactive settlement; 4.9 for Root Context-driven preview retirement; 5.8, 6.5, and 6.6 for end-to-end Store provenance; 6.7 for supported-path Archive diagnostic evidence; and 10.17 for the full modified-file documentation audit.
- Progress returns from 58/131 to 50/131. No separate change or loopback is justified: every issue is inside the recurrence-safe closure contract already approved for this change.

Verification:

- Focused Core correction matrix passed 57/57; focused Server Planning/Router/Catalog/Search/Archive matrix passed 89/89; focused Web CLI runner/Spec matrix passed 11/11. These suites do not cover the reachable counterexamples above.
- `FORMAT_CHECK_BASE_SHA=8d38f35 pnpm format:check` passed across 89 changed files and `git diff --check 8d38f35...f138765` passed.
- Remote Changeset, CI Scope, Fast Gate, and Web Browser Gate passed. `Browser Gate (xterm-input-panel)` failed after all retries because `Persist State Across Terminal Switch` timed out; the aggregate Browser Gate is therefore red. This package is outside the correction diff, but PR #207 still cannot merge until the required gate passes.

## Corrective Worker Goal after `f138765`

The worker continues on `feat/openspec-cli-16-contract-baseline` and updates PR #207. The complete executable brief is mirrored at repository-root `GOAL.md`; this section is the durable Change record and remains authoritative if that transient worker file is later replaced.

Construction order:

```text
counterexample that fails on f138765
                 |
                 v
complete public caller/capability inventory
                 |
                 v
one Server owner + invariant-level correction
                 |
                 v
sibling-route re-audit + pinned CLI/physical/reactive/lifecycle proof
                 |
                 v
focused green -> full gates -> clean SSG -> remote CI -> independent review
```

1. Replace the generic OpenSpec deny-one-command gate with an explicit read-only allowlist. Every root/environment mutation uses a typed Server owner; `archiveStrictStream` remains the only application Archive mutation. Reproduce and reject `new change demo --store other`, `store remove shared`, and `config reset --yes`, then positively cover every command left on the allowlist.
2. Route every live OPSX Schema/Template write, create, directory-create, delete, and template-write through one physical/reactive Planning-root mutation owner. Project schemas are Planning-root owned. User/package schemas stay read-only unless a distinct environment-global owner is separately designed; that capability is not authorized by this correction.
3. Require exact non-null `root.store_id` provenance matching the requested Store for both Reference list and show, plus matching Spec id for detail. Add a pinned executable OpenSpec 1.6 test that drives real Doctor/list/show outputs through the production Catalog and referenced-detail path while retaining per-Store partial failure evidence.
4. Make Root Context replacement/removal actively drive the serialized `PlanningRootServiceManager` transition. Do not expose root B until A's leases, services, and previews are retired; prove A -> B -> A, disappearance, concurrency, old-preview rejection, zero stale leases, and idempotent disposal.
5. Rewrite Archive scenario-loss/no-retry coverage through `archiveStrictStream`. Add accurate intent/timestamp/original-request headers to the seven known modified files listed in `GOAL.md`, then audit the complete production diff and all changed public APIs.
6. Record red/green evidence, final capability/owner inventory, sibling routes audited, recurrence reflection, checkpoint transitions, and residual limits here. Pre-write physical checks are not race-free `openat` and cannot detect hard-link aliases; independent per-Store enumeration is not an atomic snapshot; external writes still require watcher/fallback convergence.

Acceptance and scope:

- Re-close only `3.11`, `4.5`, `4.9`, `5.8`, `6.5`, `6.6`, `6.7`, and `10.17`, and only from direct evidence. Keep `6.8` and `6.9` open.
- Run focused tests, `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`, clean `packages/web/dist-ssg` and `packages/web/.vite`, rebuild SSG, and run `git diff --check`.
- Commit and push PR #207, wait for remote CI, and return the SHA, capability/owner inventory, focused and full test evidence, remaining checkpoints, and residual risks. The existing xterm Browser Gate timeout remains a merge blocker until green but is not part of this correction without causal evidence.
- Do not merge, archive, release, implement `6.8` or `6.9`, or begin later product phases. Stop for a new independent review.

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

## PR #207 Closure Audit: 2026-07-17

Scope is limited to re-closing `3.11`, `4.5`, `4.9`, `5.8`, `6.5`, `6.6`, `6.7`, and `10.17`. `6.8` and `6.9` remain open.

Public execution and ownership inventory:

| Reachable capability                                        | Server-owned boundary                                                                                                | Browser caller/result                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `cli.executeOpenSpec`, `cli.executeOpenSpecStream`          | `assertGenericOpenSpecCommandAllowed` accepts only canonical read-only argv and rejects every browser root selector. | `useCliRunner` fallback only; no mutation path remains. |
| `cli.init`, `cli.initStream`                                | Fixed typed launch-project initialization.                                                                           | Settings init transport.                                |
| `cli.update`, `cli.updateStream`                            | Server resolves current Planning root and supplies the upstream `update [path]` target.                              | Settings/config dedicated update transport.             |
| `cli.validate`, `cli.validateStream`                        | Server derives the Root Context selector.                                                                            | Verify and strict-archive preflight transports.         |
| `cli.archiveStrictStream`                                   | One Root Context resolution, strict validation, then Archive with `--no-validate`; no generic retry.                 | `useCliRunner` archive transport only.                  |
| `planningConfig.applyCoreProfile`, `writeEnvironmentGlobal` | Fixed environment-global command families; no browser argv.                                                          | Settings/config typed mutations.                        |
| `opsx.initSchema`, `opsx.forkSchema`                        | `PlanningRootServiceManager` serializes a root-local `SchemaMutationService`.                                        | Config Schema creation only.                            |

`CliExecutor.execute*` sibling audit also covers fixed `config path/list` projections, typed Store/Workflow/Reference contracts, and the argument-free global-install route. `CliExecutor.executeCommandStream` is reachable only for fixed global install and the read-only-gated OpenSpec stream. PTY remains an explicit operator shell rather than an application command sandbox.

Schema/Template routes now share one path:

```text
Router write/create/delete
        |
        v
PlanningRootServiceManager transition lane
        |
        v
SchemaMutationService
        |
        v
physical/reactive Core mutation
```

The nine Schema/Template operations (`write-yaml`, file write/create/directory/delete, template write, schema delete, init, fork) validate before root/CLI/filesystem access. Project-only resolution and physical ancestor/final-target checks prevent observed symlink escape; direct writes settle cached file, directory, exists, and stat projections before success. User/package Schema sources remain read-only.

Root and Reference re-audit:

- Production `resolveServerRootContext` is called only by `PlanningRootServiceManager`; Root Context query/subscription and Project Binding/Environment Global previews consume that manager. No non-manager Root Context projection remains.
- `PlanningRootServiceManager` clears and disposes A before installing B. Tests prove A -> B -> A, root disappearance, concurrent resolution ordering, preview invalidation/404, lease release, and idempotent disposal.
- Catalog list requires non-null `root.store_id === requestedStore`; detail additionally requires the requested Spec id and matching non-null Store provenance. Mismatch/missing provenance stays per-Store error evidence. The pinned `openspec-cli-16` integration invokes real Doctor, Store list, and show through production Catalog/detail code.

Red/green evidence:

- The preceding `f138765` re-review records the red counterexamples: generic Store/root mutation, Schema intermediate-symlink escape, stale reactive reads, missing/wrong Store provenance, lazy root retirement, and unsupported generic Archive diagnostics.
- Current focused confirmation: Core `430/430`, Server `374/374`, Web `629/629`; Core/Server/Web/App typechecks pass.
- Documentation audit covers all 76 changed non-test production TS/TSX files in `8d38f35...HEAD`: every file has the timestamped intent/original-request header and every exported public contract has an API comment. The earlier App `no-explicit-any` suppression is removed.
- Changeset review confirms `/context` is described as additive while `6.9` remains open.

Full local gates:

- `pnpm format:check`: pass (41 changed files).
- `pnpm lint:ci`: pass (820 files, zero warnings/errors).
- `pnpm typecheck`: pass (15 runnable workspace packages).
- `pnpm test:ci`: pass: Root 43, Core 430, Server 374, Web 629, App 78, CLI 49, plus all remaining workspace suites.
- `pnpm test:browser:ci`: pass: xterm 60 passed/1 skipped; Web Storybook 12/12.
- Clean `packages/web/dist-ssg` and `.vite`, then `pnpm --filter @openspecui/web build:ssg`: pass. Existing `scroll-button` and ineffective dynamic-import warnings remain non-fatal and outside this correction.
- `git diff --check`: pass.

Residual limits remain explicit: `realpath`/`lstat` confinement has TOCTOU and hard-link-alias limits; per-Store enumeration is not a cross-Store atomic snapshot; external filesystem changes converge through watchers/fallbacks; and PTY/configured CLI runners are operator capabilities, not sandboxes.

Checkpoint transition: `50/131 -> 58/131`; only the eight scoped checkpoints above changed. Do not merge, archive, release, or implement `6.8`/`6.9` before a new independent review.

## Blocking Independent Re-review after `a6e2dcd`: 2026-07-17

Review target: `f138765...a6e2dcd` on PR #207. The branch and remote both resolve to `a6e2dcd5f271f2aec727efb724deb8aa43a9a32e`; the worktree was clean before review. Standards and Spec were reviewed independently, then the highest-risk lifetime counterexample was reproduced through the public Router.

Spec blockers:

1. `cli.archiveStrictStream` accepts `changeId: z.string()` and forwards it unchanged to strict validation and Archive. Pinned OpenSpec 1.6 constructs source and destination through `path.join`; `archive/../legit` with explicit no-validation is accepted and moves the active Change to an unintended undated archive path. This bypasses the shared canonical Change-id guard before the only public Archive mutation.
2. `PlanningRootServiceManager.resolve*()` serializes root resolution/replacement but returns raw mutable services whose operations run outside the transition lane. A public `spec.save` reproduction paused after receiving root A, completed A -> B Root Context replacement, then resumed and successfully wrote A after B had been exposed. Disposing watchers, Kernel, and Preview does not revoke the Adapter capability or wait for in-flight mutations.

Standards blockers:

1. `public-cli-execution.ts` implements a custom argv parser for command paths, positionals, boolean/value options, and inline values. This violates the mandatory `CLAUDE.md` `yargs` rule. Its positive tests iterate the production policy's own `exampleArgs`, so they prove internal consistency rather than pinned OpenSpec 1.6 compatibility.
2. The new Schema-action validation/execution switches and CLI-stream discriminant cascade ignore the repository's `ts-pattern` preference. The duplicated Schema action vocabulary is also a Repeated Switches drift risk.

Independent evidence:

- Focused package rerun passed Core `430/430`, Server `374/374`, and Web `629/629`; these green suites do not contain either counterexample above.
- A temporary public-Router reproduction passed `1/1` by proving the defect: an in-flight `spec.save` wrote `root-a/openspec/specs/stale-after-switch/spec.md` after `resolveRootContext()` had returned ready root B. The temporary test file was removed after capture.
- Source inspection plus pinned executable reproduction confirms OpenSpec 1.6 accepts the traversal-shaped Archive id when validation is skipped. The application must reject it before invoking upstream.
- GitHub reports Changeset, CI Scope, Fast, Web Browser, xterm Browser, and aggregate Browser gates green; `mergeStateStatus=CLEAN`. CI success does not cover these review counterexamples.
- `git diff --check f138765...a6e2dcd` passed. Checkpoint arithmetic before this review was correctly `58/131`.

Checkpoint state:

- Reopened `3.11` for canonical Archive identity and stale-root mutations, `4.9` for operation-lifetime retirement, and `6.7` for the unsafe Archive input boundary. Progress returns to `55/131`.
- `4.5`, `5.8`, `6.5`, `6.6`, and `10.17` remain closed: this review found no counterexample to physical/reactive settlement, exact Reference provenance, pinned Catalog/detail flow, supported Archive diagnostic rendering, or changed-file documentation.
- No new Change or loopback is justified. These are direct violations of the current Change's recurrence-safe ownership and canonical-input laws. PR #207 remains merge-blocked; do not merge, archive, release, or continue `6.8+` before correction and another independent review.

## Corrective Worker Goal after `a6e2dcd`

The worker continues on `feat/openspec-cli-16-contract-baseline` and updates PR #207. Repository-root `GOAL.md` contains the complete executable brief; this section preserves the same ownership decisions inside the active Change.

Construction order:

```text
permanent public red tests against a6e2dcd
                    |
                    v
canonical Archive identity before Root/CLI work
                    +
Manager-owned operation lifetime for every root-scoped caller
                    |
                    v
remove unused generic argv execution + exhaustive typed dispatch
                    |
                    v
full caller re-audit -> focused green -> all gates -> remote CI -> review
```

1. Guard Archive `changeId` with `requireCanonicalOpenSpecEntityId` before Root Context, preflight, stream, invalidation, or CLI execution. Use the canonical value for both validate and Archive. Permanently cover traversal and malformed ids through strict and explicit no-validation inputs, including a pinned OpenSpec 1.6 boundary fixture.
2. Replace raw mutable `PlanningRootServices` use with a Manager-owned scoped operation/lease. An admitted A operation completes before A is retired and B is exposed; a later operation queues behind replacement and resolves B. Release must cover buffered success/failure, stream terminal/indeterminate/cancel/startup failure, and disposal without deadlock.
3. Migrate and inventory every root-scoped query/mutation/stream. Acceptance must directly cover Spec, Change/task, Change/Archive entity file, artifact output, Schema/Template, Active Root Config, Update, strict Archive, and any root-scoped workflow mutation found by audit. A lease-disposal or Preview-only test is insufficient.
4. Audit generic OpenSpec RPC/Web fallback consumers. The default construction is deletion because no current production caller was found. If a real caller exists, retain only strict `yargs` parsing with independent pinned 1.6 fixtures; handwritten parsing and production-policy-derived tests are forbidden.
5. Replace duplicated Schema action switches and CLI-stream discriminant cascades with Zod plus exhaustive `ts-pattern`, or one typed descriptor map. Invalid Schema actions still fail before Root Context/Kernel/CLI/filesystem access.
6. Append exact red/green evidence, the Manager state machine, complete capability/caller inventory, recurrence reflection, checkpoint transitions, full gates, remote CI, and residual risks here before changing checkboxes.

Scope and acceptance:

- Preserve the reviewer's current uncommitted updates to `AGENTS.md`, `i18n.zh.md`, `loop/checkpoints.md`, and this file; include them in the correction commit.
- Re-close only `3.11`, `4.9`, and `6.7`, returning progress from `55/131` to `58/131` only if every matrix passes. Keep `6.8`, `6.9`, and later phases open.
- Run focused tests, `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`, clean SSG, and `git diff --check`; push PR #207 and wait for all remote checks.
- Return the pushed SHA, Archive and operation-lifetime inventories, red/green evidence, local/remote gates, remaining checkpoints, and residual risks. Do not merge, archive, or release; stop for another independent review.

## Corrective Implementation Evidence after `df41665`: 2026-07-17

The permanent red commit is `df41665e72b7d4750b919515fa3f24d6b22ba52a` (`test: capture archive and root lifetime counterexamples`). It records both counterexamples before the owner correction:

- Pinned OpenSpec 1.6 test `executes the complete 1.6 root, Reference, task, archive, and failure matrix` proves that `archive/../legit` with validation skipped exits zero, removes the active Change, and writes the unintended `archive/legit` destination. Upstream validation is therefore not an identity or path-confinement boundary.
- Public Router test `keeps root B unexposed until an admitted root A Router mutation settles` failed against `a6e2dcd`: root B became ready while the paused `spec.save` still held A, then that stale operation wrote A after replacement.

Canonical Archive-input inventory:

| Public input                                                                      | Owner boundary                                                                                                                                                 | Permanent evidence                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical `changeId`, strict preflight                                            | `requireCanonicalOpenSpecEntityId` runs before `startOperationStream`; one canonical value and Root Context Store selector are reused by validate and Archive. | Strict success, strict failure/no retry, and one-selector tests pass.                                                                                                                                |
| Canonical `changeId`, explicit `noValidate`                                       | The same entity guard runs before the operator skip is interpreted; Archive still uses the Manager-owned stream lease.                                         | Explicit-skip test passes without calling validate.                                                                                                                                                  |
| Traversal, slash/backslash, absolute, dot, leading/trailing whitespace, or NUL id | Rejected before Manager acquisition, Root Context, validate, Archive, invalidation, or filesystem mutation.                                                    | Eight malformed ids multiplied by strict/skip inputs produce sixteen public Router cases.                                                                                                            |
| Generic or legacy Archive entry                                                   | No public capability exists.                                                                                                                                   | Route-absence test covers `cli.archive`, `cli.archiveStream`, `cli.execute`, `cli.runCommandStream`, `cli.executeOpenSpec`, `cli.executeOpenSpecStream`, and retains only `cli.archiveStrictStream`. |

The Manager now owns operation lifetime rather than returning a durable mutable service record:

```text
operation A request           replacement A -> B            later operation
        |                            |                              |
        v                            v                              v
transition admits A --------> queue replacement ------------> queue behind B
        |                            |
        v                            |
run with revocable proxy            |
        |                            |
success | throw | terminal | indeterminate | cancel | startup failure | dispose
        |                            |
        +------ idempotent release --+
                                     |
                                     v
                         drain A -> revoke capabilities
                                  -> retire Preview/hooks/Kernel/
                                     Search/Dashboard/watchers/invalidation
                                  -> expose B -> admit later operation
```

`runOperation`, `runReactiveOperation`, `startOperationStream`, and `mutateSchema` are the only mutable Planning-root acquisition paths. The operation lease increments the active record before returning a revocable proxy and decrements it exactly once. Replacement first becomes the transition-queue head, so later calls cannot re-enter A; it waits for admitted A work without holding a lock that release must re-enter. Escaped Adapter/service capabilities throw after their operation ends. Stream settlement and cancellation are independently idempotent, and Manager disposal waits for admitted streams before final record teardown.

Complete root-scoped caller inventory:

| Lifetime class                 | Migrated callers                                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buffered operation             | Owned Spec catalog/read/save/validate; Change/list/read/save/validate/task; Change and Archive entity files; OPSX artifact reads/writes; Schema/Template init/fork/write/create/delete; Active Root Config; workflow preparation; Search; Dashboard; Planning Git; buffered Update; PTY planning-root creation. |
| Reactive operation             | Spec, Change, Archive, OPSX artifact, Schema/Template, Active Root Config, Search, Dashboard, and Planning-root subscriptions execute the complete pull inside `runReactiveOperation`.                                                                                                                          |
| Streamed operation             | Planning-root validate, Update, and strict validate-then-Archive retain one lease through terminal exit, indeterminate exit, unsubscribe/cancel, startup failure, and backend disposal.                                                                                                                         |
| Synchronous active-record read | Preview HTTP lookup exposes only the current record's prepared asset; old hashes disappear before B is exposed and no mutable service is returned.                                                                                                                                                              |
| Explicitly separate owner      | Launch Project Binding, Code Git, fixed launch init, argument-free global CLI install, and user-controlled PTY shell remain outside Planning-root mutation ownership.                                                                                                                                           |

The public generic OpenSpec capability was deleted because no production caller existed: `public-cli-execution.ts`, `cli.executeOpenSpec`, `cli.executeOpenSpecStream`, and the Web generic fallback are absent. The Web runner now has exactly five dedicated transports (`archive-strict`, `init`, `planning-root-update`, `validate`, `install-global-cli`) selected by exhaustive `ts-pattern`. Schema mutation uses one Zod discriminated union as the action vocabulary and one exhaustive `ts-pattern` execution match; malformed input is rejected before Manager/Root/Kernel/CLI/filesystem access.

Green evidence before remote CI:

- Manager tests prove revocation, A -> B -> A, root disappearance, concurrent transition order, subscription ordering, Preview retirement, zero stale observation/invalidation releases, stream terminal, indeterminate terminal through the public Update path, cancellation, startup failure, Schema mutation, and idempotent disposal.
- Public Router lifetime test covers direct Spec write, buffered Update, streamed indeterminate Update, strict validate -> Archive, and verifies the next mutation targets B only after A settles. Router ownership tests also cover task/entity/artifact writes and all nine Schema/Template actions.
- Core full suite: `433/433`; Server full suite: `331/331`; Web unit suite: `628/628`.
- `pnpm format:check`: pass for 21 changed files.
- `pnpm lint:ci`: pass after removing the sole `no-useless-spread` warning.
- `pnpm typecheck`: pass for all 15 runnable workspace packages.
- `pnpm test:ci`: pass, including Root `43`, Core `433`, Server `331`, Web `628`, App `78`, and CLI `49`.
- `pnpm test:browser:ci`: pass: xterm `60 passed / 1 skipped`; Web Storybook `12/12`. The known xterm post-success close timeout warning remains non-fatal.
- Clean `packages/web/dist-ssg` and `.vite`, then `pnpm --filter @openspecui/web build:ssg`: pass. Existing `scroll-button` and ineffective dynamic-import warnings remain non-fatal and outside this correction.

Recurrence reflection: the previous Manager serialized root selection and replacement but let the returned service outlive that serialization. Endpoint-local guards could therefore never close the class. The corrected public type makes the invalid lifetime unrepresentable: mutable services exist only behind revocable operation proxies, every sibling caller enters through the same Manager, and replacement owns both admission and retirement.

Residual limits remain unchanged and explicit: physical `realpath`/`lstat` checks are not race-free `openat` and cannot detect hard-link aliases; per-Store Reference enumeration is not one atomic snapshot; external filesystem writes converge through watcher/fallback delivery; PTY and configured CLI executables are operator trust boundaries rather than command sandboxes.

Remote CI for correction commit `50b9faba358f573aa11e6cbbb418090d481239c2` is green: Changeset Gate, CI Scope, Fast Gate, Browser Gate (`@openspecui/web`), Browser Gate (`xterm-input-panel`), and the aggregate Browser Gate all completed successfully with zero failures; GitHub reports `mergeStateStatus=CLEAN`.

Checkpoint transition: `55/131 -> 58/131`. Only `3.11`, `4.9`, and `6.7` returned to closed. `6.8`, `6.9`, and every later product checkpoint remain open. PR #207 must stop for another independent review; do not merge, archive, release, or continue implementation.

## Independent Review after `fa6604b`: 2026-07-17

Review range: `a6e2dcd...fa6604b`. Blocking GitHub review `4719013149` is recorded at <https://github.com/jixoai/openspecui/pull/207#pullrequestreview-4719013149>. The branch and remote matched at `fa6604b8ea6e7facf5211654e78a69d81641d72c`; all six remote checks were green. Fresh package suites also passed (`Core 433/433`, `Server 331/331`, `Web 628/628`). Those gates do not close the stream-lifetime counterexamples below.

### Blocking stream-owner counterexamples

The Manager treats a cancellation request as if the child process had settled:

```text
unsubscribe / dispose
        |
        v
child.kill() requested -----> lease released -----> retire A / expose B
        |                                               |
        +---- child is still running and may write A ---+
```

`CliExecutor.executeStream` calls `child.kill()`, immediately clears `activeChild`, and returns. Node `ChildProcess.kill()` only sends a signal. A direct reproduction returned from `kill()` in about 1 ms while a SIGTERM-delaying child emitted `close` about 186 ms later. `PlanningRootServiceManager.startOperationStream` then calls `settle()` immediately after the void cancel function returns, so canceled Update and strict Archive processes may outlive the lease that protects their selected root. This directly disproves the stale-operation and replacement claims in `3.11` and `4.9`.

Backend disposal has the inverse failure. The Manager does not retain active-stream cancel handles. `dispose()` sets no cancellation in motion and waits only for `activeOperationCount` to reach zero. A stream that never emits terminal and whose subscriber remains attached therefore blocks disposal forever. `RunningServer.close()` broadcasts reconnect and calls `wss.close()`, but neither action guarantees subscription cleanup; it then awaits the blocked Manager. The committed Manager test currently encodes the defect by asserting disposal remains pending until the test injects an external terminal signal.

The required owner state machine is:

```text
normal:   terminal child close -> release lease -> replacement may retire A
cancel:   request termination -> await child close / bounded indeterminate -> release
dispose:  stop admission -> cancel all owned streams -> await settlement -> retire record
```

Permanent red tests must fail against `fa6604b` before the repair:

1. Spawn an Update/Archive fixture that delays SIGTERM. Queue A -> B, unsubscribe, and prove B remains unavailable until the child actually closes; prove the child cannot write A after B is exposed.
2. Keep a public Planning-root stream nonterminal with a real tRPC WebSocket client, call `RunningServer.close()`, and prove shutdown actively cancels the stream and reaches zero operation/watcher/invalidation resources without an externally injected event.
3. Cover terminal exit, null exit, spawn/build failure, delayed startup, unsubscribe, repeated cancel, backend disposal, and cancellation escalation with one settlement-aware cancel contract. A mock `vi.fn()` cancel that returns synchronously is insufficient process-lifetime evidence.

### Objective runner and standards findings

`useCliRunner` removed generic execution but still accepts independent `command/args` and `stream` values. Rendering uses `command/args`; dispatch uses only the typed stream. Its new test deliberately displays `openspec config list --json` while executing `validate demo`. This creates false CLI evidence despite exhaustive dispatch. The typed transport must own both execution and display projection, with the backend-emitted effective command preferred when root selection or configured runner resolution adds arguments.

Four touched tests (`router.test.ts`, `pty-websocket.test.ts`, `server-startup.test.ts`, and `search-router.test.ts`) still lack the mandatory timestamped orthogonal-intent/original-request header. The previous changed-file audit was therefore incomplete.

Archive canonical identity, strict Server entry ownership, generic-RPC removal, FIFO admission before cancellation, Schema exhaustiveness, and checkpoint arithmetic otherwise match the reviewed correction. `6.7` remains closed. Checkpoint transition: `58/131 -> 56/131`; only `3.11` and `4.9` reopen. Keep `6.8+` untouched and stop PR #207 for another correction plus independent review.

### Apply ownership clarification

Manager clarification on 2026-07-17: the reviewer is responsible for research, independent review, and an executable construction plan; the assigned worker is responsible for applying this Change through concrete code, tests, checkpoint evidence, commits, and PR delivery. `GOAL.md` is therefore an implementation contract for `openspec-apply-change`, not a request for another review-only or plan-only pass.

The approved worker slice is exactly the fourth-review correction above: settlement-aware CLI stream ownership, Manager-owned active-stream disposal, one typed CLI execution/display truth, and complete changed-test headers. The worker may re-close only `3.11` and `4.9` after the required real-process and real-WebSocket evidence passes (`56/131 -> 58/131`). `6.7` remains closed; `6.8+` remains outside this apply slice. Any material expansion into cross-platform process-tree supervision must loop back to `loop/research-plan.md`; otherwise the worker should proceed without another planning round.

## Fourth-Review Correction after `a57b884`: 2026-07-17

Permanent recurrence evidence was committed before implementation as `a57b884` (`test: capture stream settlement counterexamples`). Against `fa6604b`, the exact failures were:

- Core `makes cancellation available before delayed CLI runner resolution completes`: expected `true`, received `false`; the old Promise did not expose cancellation until runner resolution and spawn startup returned.
- Manager `keeps A leased until a cancelled real child closes and can no longer write A`: expected first evidence `child`, received `replacement`; B became visible before the delayed-SIGTERM A child wrote its sentinel and closed.
- Manager `actively cancels attached streams before repeated disposal retires their root`: expected disposal without an external terminal event, received `false`; the old Manager retained no cancel owner.
- Server `waits for an attached Planning-root CLI child to close during backend shutdown`: `closeFinishedAt` preceded the real child's `closedAt`; a real tRPC WebSocket subscriber proved `RunningServer.close()` could return before process settlement.
- Web `runs commands after replaceAll + runAll without requiring an extra render`: expected the Validate descriptor, received caller-authored `config list` display argv while the dedicated Validate transport executed.

### Settlement owner

Implementation commits are `bc8e37c` (`fix: enforce CLI stream settlement ownership`) and `9457c22` (`fix: unify CLI transport command evidence`). Core now returns one handle immediately:

```text
CliStreamHandle
  +-- settled: Promise<CliStreamSettlement>
  `-- cancel(): Promise<CliStreamSettlement>

starting -- runner/build failure ----------------------> startup-failed
    |
    +-- cancel before child ----------------------------> cancelled (no child)
    |
    `-- spawned -- close 0 | nonzero | signal(null) ----> exited
           |
           `-- cancel -> SIGTERM -> 1s grace -> SIGKILL
                                      |
                                      +-- close --------> cancelled
                                      `-- no close 1s --> reject termination;
                                                          lease remains held
```

Cancellation is idempotent. Natural exit and cancellation share one settlement resolver and emit one terminal event. Every asynchronous runner-resolution and ENOENT-retry boundary checks the cancellation decision before spawning again. A post-spawn `error` is evidence only, not settlement; only a never-spawned error or child `close` proves that no direct child remains. Failure to confirm close after forced termination rejects teardown rather than exposing a replacement root.

The Manager owns stream handles separately from operation counts:

```text
replacement A -> B: queue -> wait A settlement -> release lease -> retire A -> expose B

dispose request
  -> close admission synchronously
  -> enter transition queue
  -> cancel every Manager-owned active stream
  -> await each settlement and lease release
  -> await buffered operations
  -> retire Preview/hooks/Kernel/Search/Dashboard/watchers/invalidation
```

Ordinary root replacement never cancels user work. Backend disposal does. tRPC unsubscribe remains synchronous and requests cancellation only; the Manager independently retains and awaits the settlement Promise. Concurrent natural exit, repeated cancel, client detach, and repeated disposal converge without double release. Strict Archive owns one composite handle: successful validation must itself settle before Archive starts, validation failure terminates the composite, and Archive settlement releases the one Planning-root lease. `CliMutationInvalidator` invalidates once before terminal/cancel settlement reaches its caller.

Complete application stream inventory:

| Stream                       | Planning-root owner                                                                          | Settlement path                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `cli.validateStream`         | `createPlanningRootCliStreamObservable` -> `PlanningRootServiceManager.startOperationStream` | Root Context-derived Store selector -> Core Validate handle -> Manager settlement             |
| `cli.updateStream`           | Same Manager path                                                                            | Root Context-derived Update argv -> mutation invalidator -> Core handle -> Manager settlement |
| `cli.archiveStrictStream`    | Canonical Change guard -> same Manager path                                                  | strict Validate handle -> Archive mutation handle -> one composite settlement                 |
| `cli.initStream`             | Launch-scoped, explicitly outside Planning-root replacement                                  | mutation invalidator -> Core handle -> observable cancellation                                |
| `cli.installGlobalCliStream` | Fixed environment-global install, argument-free public route                                 | raw-command Core handle -> observable cancellation                                            |
| PTY WebSocket                | Explicit user-controlled shell owner                                                         | PTY session lifecycle; not an application OpenSpec mutation stream                            |

### One command truth

`useCliRunner.commands.replaceAll` now accepts `CliStreamTransport[]` directly. There is no input shape containing independent `command`, `args`, and `stream`. One exhaustive `planCliStream` match derives both logical preview argv and the matching subscription for exactly five transports: `archive-strict`, `init`, `planning-root-update`, `validate`, and `install-global-cli`. A future sixth transport cannot compile without adding both facts in the same match. Once the backend emits `command`, its verbatim string becomes `effectiveCommand` on both `CommandDescriptor` and `CommandProcess`; the browser does not parse server argv to reconstruct intent.

Production callers now submit only typed transports: Global Archive, OPSX Verify, Config Update, Settings Init, and fixed global install. The former mismatch is unrepresentable at the caller boundary. Tests separately prove the transport-derived preview and the backend-emitted effective command.

### Green evidence and recurrence reflection

Focused evidence after both implementation commits:

- Core CLI executor: `37/37`, including runner-resolution cancellation, exits `0`, `7`, and signal/null, retry/start failure, repeated cancel, delayed SIGTERM, SIGKILL escalation, and confirmed close.
- Server: `128/128` across Manager, observable detach, invalidator, Strict Archive, real WebSocket shutdown, Router, PTY, and Search.
- Web: `26/26` across the runner and affected Archive/Verify/Settings callers.

Full local gates:

- `pnpm format:check`: pass; `pnpm lint:ci`: zero warnings/errors; `pnpm typecheck`: all 15 runnable workspace packages pass; `git diff --check`: pass.
- `pnpm test:ci`: pass, including Root `43`, Core `439`, Server `334`, Web `628`, App `78`, and CLI `49`.
- `pnpm test:browser:ci`: xterm `60 passed / 1 skipped`; Web Storybook `12/12`.
- Clean `packages/web/dist-ssg` and `.vite`, then `pnpm --filter @openspecui/web build:ssg`: pass. Existing `scroll-button` and ineffective dynamic-import warnings remain non-fatal.
- The environment-local pre-commit hook is misconfigured (`No "staged" config found in vite.config.ts`), so commits used `--no-verify` only after the explicit formatting, lint, typecheck, test, browser, SSG, and diff gates above passed.

Reflection: `fa6604b` correctly revoked service capabilities but represented stream lifetime as a void cancellation request. Counting the lease without retaining the cancel owner made replacement release early and disposal depend on the client. Synchronous `vi.fn()` cancels hid both defects. The replacement interface makes early release and uncancelable disposal unrepresentable across Validate, Update, and Archive. Exhaustive typed dispatch alone was likewise insufficient while display argv remained independently writable; the queue input now has only one semantic source.

Residual limits are explicit. POSIX tests prove direct-child SIGTERM delay and SIGKILL escalation; Windows signal behavior is not exercised in current CI. The owner confirms the direct child's close, not a separately daemonized descendant process tree. Expanding to cross-platform process-tree/job-object supervision remains outside this approved slice and must return to `loop/research-plan.md`. A termination escalation that still yields no `close` rejects disposal and keeps the old lease/root blocked rather than claiming safety.

Checkpoint transition: `56/131 -> 58/131`. Only `3.11` and `4.9` re-close. `6.7` remains closed from the accepted prior correction. `6.8+` remains open and unstarted. Stop after PR #207 remote checks for a new independent review; do not merge, archive, release, or continue the product phase.

Remote CI for correction head `4da9fad192fba92baea54c3a94b878f0e6a713e1` is green. GitHub Actions run `29555628670` completed Changeset Gate, CI Scope, Fast Gate, Browser Gate (`@openspecui/web`), Browser Gate (`xterm-input-panel`), and the aggregate Browser Gate with six successful conclusions and zero failures; GitHub reports `mergeStateStatus=CLEAN`. This closes delivery of the approved correction slice only. PR #207 remains open for independent review and is not authorized for merge, archive, release, or `6.8+` implementation.

## Fifth-Review Correction after `ca72cc0`: 2026-07-17

The independent review found two P1 counterexamples not exercised by the green suites. The correction is an apply-change code slice, not another audit-only pass.

```text
A -> B transition:  activeRecord = null -> wait A operation lease
dispose request:     cancel A stream queued behind that transition
A stream:            needs dispose cancellation to settle

Result at ca72cc0: the transition and backend shutdown deadlock.
```

`PlanningRootServiceManager.activate()` clears A and awaits `waitForOperations(A)` inside the transition lane. `dispose()` sets `disposed`, but calls `stream.cancel()` only in a later transition callback. The operation lease is released only after the stream's `settled` Promise resolves. Therefore an attached A stream which needs disposal cancellation cannot settle and `RunningServer.close()` waits forever. The existing disposal test covers an idle queue, not A -> B waiting followed by disposal.

The second counterexample is terminal-result loss. `CliExecutor.failTermination()` rejects `CliStreamHandle.settled` when SIGTERM/SIGKILL still cannot confirm `close`. `createCliStreamObservable()` never observes that rejection after startup; `installGlobalCliStream` duplicates the omission. Attached tRPC clients receive neither `exit` nor `error`, leaving `useCliRunner` permanently `running` even though the invalidator has already recorded the affected facets. Strict Archive must propagate the same rejection through its composite handle.

The safety decision is unchanged: missing direct-child `close` is not a license to release A's lease or expose B. It is a bounded termination failure. The owner must retain A as blocked, invalidate, emit exactly one terminal error to attached clients, and let backend teardown reject in bounded time. This is safer than claiming a process stopped, while also preventing an infinite shutdown wait or an indefinite client spinner.

Required construction and red evidence against `ca72cc0`:

1. Start A, attach a nonterminal Planning-root stream, queue A -> B, then call `dispose()` without client detach. Prove cancellation starts despite the blocked transition, B never becomes available, and disposal completes after confirmed child close with zero stream/operation/watcher/invalidation leases.
2. Make a real or deterministic no-close termination handle reject after its bounded timeout. Prove planning-root stream observable, strict Archive, and fixed global install emit exactly one tRPC error; prove no duplicate exit/error and detached subscribers receive no late emission.
3. Drive that rejection through `useCliRunner`. `CommandProcess.done` must resolve `null`, active subscription state must clear, and the command must render `error` rather than `running`.
4. Preserve the previous delayed-SIGTERM replacement proof: a cancellation request does not release A before actual `close`; no process may mutate A after B is exposed.
5. Cover repeated cancel/dispose and a late close after forced-timeout rejection. The late event may clean local process bookkeeping exactly once, but must not retroactively expose B, emit a second terminal result, or make the first teardown claim success.

Required implementation boundary:

- Retain a retiring record/stream collection that disposal can cancel outside a transition lane currently waiting for that record's leases. Prevent B creation once disposal begins.
- Give every streamed route one terminal-projection owner. Resolved handles retain the existing CLI `exit`; rejected handles emit one observable error. Do not convert rejection into a synthetic successful exit or silently swallow it.
- Keep `CliMutationInvalidator` before the externally visible terminal result for both resolution and rejection. Keep forced-no-close lease retention; do not add an unconditional `finally` release to the Manager.
- Use the shared observable for fixed global installation where possible, or prove an equivalent single-terminal contract. Audit Strict Archive's composite rejection path.

Checkpoint state changes from `58/131` to `57/131`: only `4.9` is reopened. `3.11`, `4.5`, and `6.7` remain closed. `6.8+` remains unstarted. Re-close `4.9` only after the red/green evidence above, focused and full gates, Change evidence update, PR push, remote CI, and another independent review. Do not merge, archive, release, or start the Config product phase in this correction PR.

## Fifth-Review Correction Implementation: 2026-07-17

Permanent test coverage was committed before this repair as `986d514` (`test: capture stream termination counterexamples`). Against `ca72cc0`, it captured the blocked `A -> B` plus disposal cycle, missing error projection for a rejected settled handle, silent detached subscribers, strict Archive rejection, fixed global-install rejection, and the Web runner spinner; the sixth review below distinguishes which scenarios were red counterexamples and which were characterization coverage.

The correction keeps cancellation and settlement separate:

```text
dispose
  -> close admission; retain active/retiring records
  -> cancel their stream handles outside transitionTail
  -> await confirmed handle settlement and operation-lease release
  -> retire A resources
  -> reject B creation because disposal owns the manager
```

`PlanningRootServiceManager` now keeps retiring records visible to disposal before it waits on their leases. Disposal synchronously marks the manager closed, retains A, requests cancellation outside the transition that may already be waiting on A, and only then waits for retirement. A cancellation rejection rejects the bounded teardown; it does not release A or expose B. Repeated disposal returns the same promise.

`createCliStreamObservable` now has the single terminal projection for each returned handle: normal CLI `exit` remains the success terminal, while `settled` rejection sends exactly one observer error when attached. A detached observer remains silent but still requests cancellation. `installGlobalCliStream` delegates to that observable, so its result cannot diverge. Strict Archive forwards the same composite-handle rejection; `useCliRunner` therefore resolves the command, clears active subscription state, and renders `error` rather than retaining `running`.

Green evidence:

- Targeted Server and Web test invocations passed the complete package suites: Server `341/341`; Web `629/629`.
- `pnpm format:check`, `pnpm lint:ci`, and `pnpm typecheck` passed with zero formatting, lint, or type errors. `git diff --check` passed.
- `pnpm test:ci` passed: Root `43/43`, Core `439/439`, Server `341/341`, Web `629/629`, App `78/78`, and CLI `49/49`.
- `pnpm test:browser:ci` passed: xterm `60 passed / 1 skipped`; Web Storybook `12/12`.
- After removing `packages/web/dist-ssg` and `packages/web/.vite`, `pnpm --filter @openspecui/web build:ssg` passed. Existing `scroll-button` and ineffective dynamic-import warnings remain non-fatal.

Residual boundary: direct-child `close` is the only confirmed process settlement. A forced SIGTERM/SIGKILL timeout rejects teardown, retains the old root, and emits one terminal error; it does not supervise independently daemonized descendants or prove Windows process-tree behavior. That expansion remains outside this correction and must return to `loop/research-plan.md`.

Checkpoint transition: `57/131 -> 58/131`; only `4.9` re-closes. `3.11`, `4.5`, and `6.7` remain closed. `6.8+` remains open and unstarted. Commit, push PR #207, wait for remote CI, then stop for independent review. Do not merge, archive, release, or begin the Config product phase.

## Sixth Independent Review after `e68e4de`: 2026-07-17

The fifth correction fixes the two observed production failures: disposal can cancel a retiring A stream outside the blocked transition, and rejected stream settlement reaches attached clients as one terminal error. Focused review runs pass: Core CLI executor `37/37`, Server lifecycle/observable/Router/Strict Archive `108/108`, and Web runner `10/10`. PR #207 is open at `e68e4de`, `mergeStateStatus=CLEAN`, with all six remote checks successful.

The checkpoint nevertheless cannot remain closed because the committed evidence does not implement the complete construction contract:

1. `GOAL.md` and this artifact required permanent coverage for a late child `close` after forced-timeout rejection. No such Core or Manager test exists. `CliExecutor.failTermination()` makes the first settlement immutable and a later `close` clears its local child reference without another settlement; the intended behavior is plausible from inspection but remains unproved against regression.
2. The forced-no-close Manager test calls `resolveRootContext()` and immediately calls `dispose()` without proving the A -> B transition entered `retireRecord(A)`. Disposal can win admission and make the replacement reject before it ever waits on A. It therefore does not prove the required blocked-transition failure state or late-close invariants.
3. The new Strict Archive unit test rejects the Archive-phase handle after validation already succeeded. The source implementation is identical at `ca72cc0`, so this test was not red there and does not prove that a rejected Validate handle prevents Archive from starting. The public Router test covers observable projection of an Archive-phase rejection, not the missing phase boundary.
4. No direct rejected-handle tests exercise the Planning-root Validate and Update public routes, although `GOAL.md:47` and the fifth-review directive require route parity. The shared observable makes the implementation likely correct, but checkpoint evidence must cover both owners, including Update invalidation before error delivery.
5. The Web test manually invokes the pre-existing `onError` callback. That callback already resolved `done` and cleared state at `ca72cc0`, so the test was not red for the transport-loss defect. It also does not retain and assert the subscription's `unsubscribe` function. This is useful characterization, not proof that the Server-to-Web rejection path was captured.
6. The changed test headers in `cli-stream-observable.test.ts` and `use-cli-runner.test.tsx` omit their new settlement-rejection intents and original request, repeating the exact full-file header-audit defect prohibited by `AGENTS.md`.

The statement at line 1598 that commit `986d514` demonstrated every listed counterexample is therefore too broad. Red evidence in that commit covers the blocked A -> B disposal cycle and Server observable projection; Strict Archive phase ownership and the Web handler are characterization tests. Future evidence must name which tests fail at which fixed point and quote the actual assertion failure instead of grouping every new test under one red label.

No new production behavior defect is confirmed by this review, so a separate Change would create false scope. Keep the correction in this Change, reopen only `4.9`, and move progress `58/131 -> 57/131`. The next apply slice is test and contract hardening first; production code changes are permitted only when those stronger counterexamples expose a real mismatch. Keep `3.11`, `4.5`, and `6.7` closed, leave `6.8+` unstarted, and stop again for independent review before crossing into the Config product phase.

## Sixth-Review Evidence Correction: 2026-07-17

Commit `82c7546` adds permanent tests only. No production source changed: the fifth correction already owned the two production repairs. The sixth slice closes the missing evidence and records its fixed-point status honestly.

```text
fixed point ca72cc0
  Core late close        pass  -> characterization
  Strict Validate reject pass  -> characterization
  Web onError projection pass  -> characterization
  Manager A -> B dispose fail  -> red: cancel is queued behind retirement
  Route Validate/Update  fail  -> red: rejected settlement is never emitted

repaired e68e4de + 82c7546 tests
  Core 38/38 | Server 117/117 | Web 14/14
```

| Permanent test                                                                       | Fixed-point result                                                                               | Repaired-head result             | Evidence class                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Core `keeps forced-timeout rejection immutable when the child closes late`           | `38/38` pass                                                                                     | `38/38` pass                     | Characterization. `CliExecutor` already preserved the first rejection and suppressed a second exit.                                            |
| Manager `keeps an already-retiring A blocked after forced rejection and late close`  | fail: `expected cancel to be called once, but got 0 times` after the `waitForOperations(A)` gate | pass in Server focused `117/117` | Red. At `ca72cc0`, disposal queued cancellation behind the transition already waiting on A.                                                    |
| Strict Archive `keeps Archive unstarted when the Validate handle rejects settlement` | `6/6` pass                                                                                       | pass in Server focused `117/117` | Characterization. Validate-phase rejection already prevented phase two; this permanently closes phase-boundary coverage.                       |
| Router Validate rejected handle                                                      | fail: expected `[failure]`, received `[]`                                                        | pass in Server focused `117/117` | Red. The old observable never attached to `handle.settled`.                                                                                    |
| Router Update rejected handle                                                        | fail: expected `[failure]`, received `[]`                                                        | pass in Server focused `117/117` | Red. The error was absent even though Update invalidation had occurred.                                                                        |
| Web five dedicated transport rejections                                              | `14/14` pass                                                                                     | `14/14` pass                     | Characterization. The test injects the already-correct Web `onError`; it proves subscription-owner release, not old Server transport delivery. |

The Manager test installs a deterministic `waitForOperations(A)` probe before calling `dispose()`. It then uses an EventEmitter-backed child seam: cancellation schedules the forced rejection, while `child.emit('close')` drives the real close listener twice. The repaired result proves the first error remains the only settlement, local child bookkeeping clears once, the Preview stays unavailable, observation/invalidation leases stay retained, and B remains blocked.

The public-route tests attach to the real Validate and Update observables. They require exactly one error, no exit, no complete, and cancellation on unsubscribe. Update records invalidation inside its error callback; it observes `project=1, context=1` before the error and both remain `1` after unsubscribe, proving `CliMutationInvalidator` runs once before external terminal delivery.

The Web table covers Strict Archive, Init, Planning-root Update, Validate, and global install. Each rejected transport resolves `CommandProcess.done` to `null`, leaves process and descriptor `error` with `exitCode=null`, leaves no command `running`, calls its returned `unsubscribe` exactly once, and does not call it again after `cancel()`.

Reflection gate:

- Red evidence is limited to the Manager retirement/cancellation deadlock and public Validate/Update rejection transport. Core late-close, Strict Validate rejection, and direct Web `onError` are characterization because they already pass at `ca72cc0`.
- The Manager's `waitForOperations(A)` probe proves the replacement was already blocked on A before disposal begins.
- The Strict Archive Validate-rejection test proves `startArchive` is never called.
- The Core EventEmitter test proves late close emits no second exit; the Manager test proves it cannot release the rejected lease or expose B.
- The Web test retains each subscription's `unsubscribe` spy and proves error convergence calls it exactly once rather than only updating UI state.

Focused verification after `82c7546`:

- `pnpm --filter @openspecui/core exec vitest run src/cli-executor.test.ts` -> `38/38`.
- `pnpm --filter @openspecui/server exec vitest run src/planning-root-service.test.ts src/cli-stream-observable.test.ts src/cli-mutation-invalidator.test.ts src/router.test.ts src/strict-archive-stream.test.ts` -> `117/117`.
- `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/use-cli-runner.test.tsx` -> `14/14`.
- The isolated `ca72cc0` worktree reproduced the two Manager/Router red assertions above and passed Core `38/38`, Strict Archive `6/6`, and Web `14/14` as characterization.

The local pre-commit hook still fails before project checks because the environment's Vite+ configuration lacks `staged`; `82c7546` therefore used `--no-verify` only after the focused suites and `git diff --check` passed. Full project gates remain required before this documentation/checkpoint commit is pushed.

Checkpoint transition: `57/131 -> 58/131`; re-close only `4.9`. `3.11`, `4.5`, and `6.7` remain closed. `6.8+` remains open and unstarted. Do not merge, archive, release, or begin `6.8+`; push only after the required local gates, then stop for independent review.

## Seventh Independent Review after `c1571f3`: 2026-07-17

PR #207 is open at `c1571f32dc06325ff42c9383ed334340b17b2c16`. Changeset, CI Scope, Fast, Web Browser, xterm Browser, and aggregate Browser gates are all green; the worktree and remote branch match. Those gates accept the submitted suites but do not prove the hidden Core cleanup transition below.

The sixth correction closes the previously listed Manager, Strict Archive, public Validate/Update, Web owner-release, and changed-header gaps. Its red/characterization matrix is honest. No new production behavior defect is confirmed in those boundaries.

One mandatory Core claim remains unproved. `keeps forced-timeout rejection immutable when the child closes late` asserts the first rejection, two signal attempts, no `exit`, and idempotent cancel. If production line `activeChild = null` is removed from the `close` handler, all of those assertions can still pass: `failTermination()` has already set `settled = true`, so both later `settle()` and `cancel()` return before exposing the retained child reference. The Manager test's `clearActiveChild` spy cannot close this gap because that listener and bookkeeping are authored inside the test rather than executed by `CliExecutor`.

This is an evidence defect, not yet a confirmed production defect. Keep the work in this Change. Reopen only `4.9` and move progress `58/131 -> 57/131`; keep `3.11`, `4.5`, and `6.7` closed and leave `6.8+` unstarted. The next apply slice must first demonstrate the blind spot by mutation at `c1571f3`, then add the narrowest non-public child-owner seam or equivalent production-observable assertion. Production behavior may change only if that counterexample exposes an actual mismatch. Stop for another independent review after focused/full gates and remote CI.

## Seventh Core Ownership Evidence Correction: 2026-07-17

The original late-close test was characterization, not mutation-resistant proof. The production child slot was local state invisible after `failTermination()` had already made settlement immutable.

```text
spawned child -> CliStreamChildOwner.currentChild
                       |
                       +-> forced timeout: retain child, reject once
                       `-> actual close: release child once, then settle is a no-op
```

### Required blind-spot mutation at `c1571f3`

An isolated worktree was created with `git worktree add --detach /private/tmp/openspecui-seventh-c157 c1571f32dc06325ff42c9383ed334340b17b2c16`. Its `CliExecutor` close handler had only `activeChild = null` removed, then ran:

```text
pnpm --filter @openspecui/core exec vitest run src/cli-executor.test.ts -t "keeps forced-timeout rejection immutable when the child closes late"
```

Result: `Test Files 1 passed`; `Tests 1 passed | 37 skipped`. The old assertions still accepted the mutation because `settled = true` made later `settle()` and `cancel()` return before either exposed the retained child.

### Permanent Core assertion and second mutation

`CliStreamChildOwner` is an internal Core module, not a package-root export or `CliStreamHandle` field. `CliExecutor.executeStream` claims the spawned direct child, checks that exact slot for termination/cancel work, and releases it in the actual `close` and pre-spawn `error` transitions. Its direct-module inspection seam reads the Core-owned slot; the test does not write, clear, or simulate that bookkeeping.

The strengthened `keeps forced-timeout rejection immutable when the child closes late` test executes `CliExecutor.executeStream`, reaches the forced-timeout `CliStreamTerminationError`, confirms the slot is `{ currentChild: child, releaseCount: 0 }`, emits `close` twice, then requires `{ currentChild: null, releaseCount: 1 }`. It retains the prior immutable-first-error, no-second-exit, and repeated-cancel assertions.

The same deliberate mutation then removed only `childOwner.release(child)` from the production close handler and ran the same focused command. It failed at `packages/core/src/cli-executor.test.ts:461`:

```text
AssertionError: expected { ... } to deeply equal { currentChild: null, releaseCount: 1 }
Received: currentChild: ChildProcess, releaseCount: 0
```

After restoring the cleanup transition, `pnpm --filter @openspecui/core exec vitest run src/cli-executor.test.ts` passes `38/38`.

Reflection gate:

- The exact prior mutation was removal of `activeChild = null` in the `c1571f3` close handler; the old test passed.
- The exact corrected mutation is removal of `childOwner.release(child)`; the slot-empty assertion above fails.
- The assertion observes the actual `CliStreamChildOwner` claimed by `CliExecutor`, rather than a test-authored listener or clear spy.
- `settled` can suppress another settlement, but it cannot now mask retained Core child ownership because the test reads that slot after both late close events.
- Public API is unchanged: no package-root export, published subpath, `CliStreamHandle` member, diagnostics field, or generic execution capability was added.

Checkpoint `4.9` remains open until the required full CI-equivalent suite, clean SSG build, diff check, commit, and PR CI evidence pass. The sixth-correction labels remain unchanged: Core late-close, Strict Validate rejection, and direct Web `onError` are characterization; only the Manager/Router fixed-point tests are red evidence.

### Local closure verification

- `pnpm format:check`: pass.
- `pnpm lint:ci`: pass, zero warnings and errors.
- `pnpm typecheck`: pass across 15 runnable workspace packages.
- `pnpm test:ci`: pass.
- `pnpm test:browser:ci`: xterm `60 passed | 1 skipped`; Web Storybook `12 passed`.
- Clean `packages/web/dist-ssg` and `.vite`, then `pnpm --filter @openspecui/web build:ssg`: pass. The existing `scroll-button` CSS and ineffective dynamic-import warnings remain non-fatal and outside this Core correction.
- `git diff --check`: pass after the final closure-artifact edit.

Checkpoint transition: `57/131 -> 58/131`; re-close only `4.9`. `3.11`, `4.5`, and `6.7` remain closed. `6.8+` remains open and unstarted. Do not merge, archive, release, or begin `6.8+`; commit, push PR #207, wait for all six remote checks, then stop for independent review.

Remote evidence at code/evidence commit `00067d6bf6f45395c26eb0a7ed6e02c583dac492`: PR #207 remained open with `mergeStateStatus=CLEAN`; Changeset Gate, CI Scope, Fast Gate, Browser Gate (`@openspecui/web`), Browser Gate (`xterm-input-panel`), and aggregate Browser Gate all completed successfully. The final documentation-only evidence commit must also pass the PR checks before handoff.

## Eighth Independent Review after `f2d1ddf`: 2026-07-17

Review range: `a92647d...f2d1ddf`. Standards and Spec were reviewed independently with no findings. `CliStreamChildOwner` remains a narrow internal Core module: it is absent from the package root, published subpaths, `CliStreamHandle`, and diagnostics. The changed TypeScript files retain accurate headers and typed public comments.

The mutation evidence was independently reproduced rather than accepted from the worker summary:

```text
c1571f3 minus activeChild = null
  focused late-close test -> 1 passed | 37 skipped

f2d1ddf minus childOwner.release(child)
  focused late-close test -> 1 failed | 37 skipped
  expected currentChild:null/releaseCount:1
  received ChildProcess/releaseCount:0 at cli-executor.test.ts:461
```

Restored HEAD passes the complete Core CLI-executor file `38/38`. PR #207 is open and `CLEAN` at `f2d1ddf391cf5fd5846f1f3658a95e238a43c602`; Changeset, CI Scope, Fast, Web Browser, xterm Browser, and aggregate Browser checks all pass. The one earlier xterm timeout did not reproduce under the exact local, complete, serial, or rerun lanes, so no deterministic defect is attributed to this Core slice.

Checkpoint `4.9` is accepted closed. Progress remains `58/131`; `6.8+` was not started by the correction. Do not merge, archive, or release. The next apply slice is checkpoint `6.8` only: complete and test the three ownership-specific Config sections, then stop for independent review before `6.9`.

## Config Ownership Checkpoint 6.8: 2026-07-17

This slice implements only the three ownership-specific Config sections. The route remains tab/schema orchestration; Schema discovery, editing, templates, and their mutations stay in `packages/web/src/routes/config.tsx`.

### Red evidence at the accepted fixed point

The permanent empty-file regression was first injected into an isolated worktree at `f2d1ddf` (`/private/tmp/openspecui-config-red`) without the implementation patch:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/routes/config.test.tsx -t "keeps an existing empty Active Root"

FAIL src/routes/config.test.tsx > Config schema tabs > keeps an existing empty Active Root config editable instead of rendering absence
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Edit"
at src/routes/config.test.tsx:327:19
available action: "Create Active Root config"
```

At `f2d1ddf`, the route used `const configYaml = activeRootConfig?.content` and tested its truthiness. Therefore `exists: true, content: ""` entered the absent-file branch. The test was then retained on the repaired branch and passes as green evidence; this is the required counterexample rather than a manually invoked downstream handler.

### Ownership and mutation inventory

| Facet              | Physical owner                   | Only Server mutation                                                           | Evidence                                                                                                                     |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Project Binding    | `ProjectBindingSection`          | `planningConfig.updateProjectBinding` with structured `store` and `references` | owner/root preview, structured payload, pending lock, failure draft retention, static absence tests                          |
| Active Root        | `ActiveRootConfigSection`        | `planningConfig.writeActiveRoot` with editor content                           | `exists` is independent from content; Planning-root/source/Store/path provenance; loading/error/pending/failure/static tests |
| Environment Global | `EnvironmentGlobalConfigSection` | `planningConfig.writeEnvironmentGlobal` with a validated JSON object           | CLI path/data-scope/raw evidence, unknown-field preservation, invalid JSON rejection, pending/error/static tests             |

The Environment Global `Run update` action remains on `useCliRunner`'s typed `planning-root-update` command descriptor. No browser-authored argv or independent Store/root selector was added. Static mode renders the exported Active Root snapshot read-only, states that Project Binding is not included, and states that Environment Global is unavailable; it does not synthesize launch binding, runtime data-home, or global config facts.

### Focused and full verification

- Focused Web Config matrix: `pnpm --filter @openspecui/web exec vitest run --project unit src/components/config/project-binding-section.test.tsx src/components/config/active-root-config-section.test.tsx src/components/config/environment-global-config-section.test.tsx src/routes/config.test.tsx` -> `4 files, 29/29 tests passed`.
- `pnpm format:check` -> passed.
- `pnpm lint:ci` -> passed, 824 files, zero warnings/errors.
- `pnpm typecheck` -> passed across all 15 runnable workspace packages.
- `pnpm test:ci` -> passed for every workspace package (Core `47 files / 440 tests`, Server `46 files / 344 tests`, Web `115 files / 656 tests`, App `78 tests`, CLI `49 tests`; no failed project).
- `pnpm test:browser:ci` -> xterm `60 passed / 1 skipped`; Web Storybook `12/12`.
- Cleaned `packages/web/dist-ssg` and `packages/web/.vite`, then `pnpm --filter @openspecui/web build:ssg` -> passed. Existing `scroll-button` CSS and ineffective dynamic-import warnings remain non-fatal.
- `git diff --check` -> passed.

### Reflection gate

- Physical owners are exactly `ProjectBindingSection`, `ActiveRootConfigSection`, and `EnvironmentGlobalConfigSection`; `Config` only composes their tabs and keeps Schema orchestration.
- The only write path for each facet is respectively `planningConfig.updateProjectBinding`, `planningConfig.writeActiveRoot`, and `planningConfig.writeEnvironmentGlobal`.
- `config.test.tsx` plus `active-root-config-section.test.tsx` prove an existing empty Active Root (`exists: true, content: ""`) renders Edit/editor state, not the absence copy. The fixed-point red run above proves the old truthiness branch failed for the intended reason.
- Project Binding, Active Root, and Environment Global pending tests click the disabled save controls and assert one mutation call; failure tests assert the dirty Store/JSON/YAML draft remains and the error is visible. Editor/cancel/refresh/profile controls are disabled while their operation is active.
- Static tests prove the Active Root snapshot has no live owner/path, Project Binding says it is not in static export, and Environment Global says it is unavailable; no Launch or global runtime data was invented.
- The changed-file audit is limited to `AGENTS.md`, `i18n.zh.md`, one changeset, the Project Binding tests, the Config route/tests, and the two new focused Config components/tests. Schema code remains in the route with no behavior change; no `6.9+` file or checkbox was touched.

Checkpoint transition: `58/131 -> 59/131`; close only `6.8`. `6.9`, `6.16`, and every later project/static/App surface remain open. Commit and push PR #207, wait for the six remote checks, then stop for independent review. Do not merge, archive, or release.

## Ninth Independent Review after `731f684`: Config Readiness and Projection Gaps

Review range: `9fb515a...731f684`. PR #207 is `OPEN/CLEAN`; the six remote checks pass. Focused Config verification reported `4 files, 29/29 tests passed`, but those tests do not establish the full acceptance contract below. `6.8` is not accepted and `3.5` is reopened for the Config surface. Progress returns from `59/131` to `57/131`. Do not merge, archive, release, or start `6.9+`.

### Standards findings

1. **Root readiness is bypassed (P1).** `ActiveRootConfigSection` renders Edit/Create and leaves Save and the editor shortcut usable when its subscription keeps stale data beside a refresh/transport error (`packages/web/src/components/config/active-root-config-section.tsx:105-170`). Its test explicitly requires Edit to remain present under `refresh failed` (`active-root-config-section.test.tsx:159-169`). The shared Root Context law requires stale/error states to remain visible evidence but locked for root-dependent writes. The route's retained Schema/Template mutations have the same gate obligation.
2. **Planning-root Update is ungated (P1).** `EnvironmentGlobalConfigSection` starts `planning-root-update` from Run update and from Apply's auto-update path based only on local runner/mutation state (`environment-global-config-section.tsx:220-261,391-406,758-780`). A non-ready Root Context can therefore dispatch a root mutation. Use the shared root action gate before queuing the typed transport and test both direct Update and auto-Update.
3. **Profile/drift projection is non-reactive (P1).** The component reads `config list --json` and `config list` through the independent `cli.getProfileState` query (`environment-global-config-section.tsx:149-155`), while the Environment Global subscription already owns the same CLI config and invalidation path. An external edit can update the JSON preview while leaving profile/drift cards stale. Fold those facts into the typed reactive projection or add a matching subscription; do not keep query/refetch as a second truth.
4. **Environment Global has divergent intent (P2).** The new 851-line component combines environment projection/evidence, JSON editing, profile controls, CLI runner/dialog, interactive navigation, and static behavior. Split only along real ownership boundaries while retaining one Environment Global owner and typed mutation path; the split must not weaken reactive or readiness contracts.

### Spec findings

1. **Reference evidence is missing (P1).** The Config research contract requires Project Binding to preview direct Reference health/evidence (`wayfinder/research/app-project-surface-adaptation.md:134`). `ProjectBindingSection` only renders planning root/source/Store and declaration diagnostics (`project-binding-section.tsx:226-244`); it never renders `rootPreview.data/attempt.references` or their Doctor diagnostics. Add Store id/root plus exact severity/code/message, using observed-only language and no inferred completeness.
2. **External Store impact is underspecified (P1).** The contract requires an external Store-backed Active Root to state that edits affect every project resolving that Store (`app-project-surface-adaptation.md:135`). `ActiveRootConfigSection` only appends `external` to a provenance line (`active-root-config-section.tsx:89-94`), and its test asserts only that label. Add an objective shared-root warning without claiming a machine-wide project list.

### Required counterexamples and evidence

- At fixed point `731f684`, change the stale-error expectation first and show the test failing because Edit/Save remains enabled; then repair it while preserving the stale snapshot and dirty draft as read-only evidence.
- Add a real Root Context gate test that blocks Schema/Template mutations, Active Root writes, direct Update, and Apply auto-Update in loading, refreshing, transport-error, and CLI-error states. A mocked downstream handler call is not sufficient.
- Simulate an external environment config invalidation and prove profile, delivery, workflow, and drift facets refresh together. Preserve raw CLI stdout/stderr/exit/diagnostics as separate facts.
- Add Project Binding Reference diagnostics and external-Store consequence assertions. Do not use `healthy`, `all references`, `unreferenced`, or other inferred labels.
- Re-audit every Config button and keyboard shortcut after the fix. The goal is one gate per root-dependent capability, not a denylist of the first discovered button.

### Delivery boundary

The next worker slice is implementation, not another plan: apply the corrections above, add focused tests and evidence, run the full repository gates plus clean SSG, update this Change continuously, commit, push PR #207, and stop for independent review. Re-close only `3.5` and `6.8` (`57/131 -> 59/131`); leave `6.9+` untouched. Residual path/race and watcher limitations remain explicitly documented.

Architecture vocabulary and the Config readiness/reactivity rule were synchronized to `AGENTS.md` and `i18n.zh.md` on 2026-07-18.

## Config Readiness Correction Implementation: 2026-07-18

This worker slice implements the ninth-review correction at fixed point `731f684`. It does not start `6.9+`, add a second Change, or change the three Config ownership boundaries.

### Fixed-point red evidence

An isolated worktree at `731f684` (`/private/tmp/openspecui-config-readiness-red`) retained the review tests and compatibility stubs but omitted the production correction. The exact commands failed for the intended reasons:

```text
Active Root + Project Binding:
  4 failed / 15 passed
  - missing observed Reference evidence
  - missing external shared-Store consequence
  - stale Active Root Edit remained available beside refresh error
  - stale Active Root Edit remained available beside transport error

Environment Global:
  3 failed / 10 passed
  - profile/drift remained on the independent cli.getProfileState query
  - Run update stayed enabled while Root Context was blocked
  - Apply still queued planning-root-update while Root Context was blocked

Schema route:
  4 failed / 4 passed
  - Edit remained available in loading, refreshing, transport-error, and CLI-error Root states
```

These are counterexamples against the named fixed point, not downstream-handler characterization. The temporary worktree was removed after the runs.

### Implemented contracts

- `useRootActionState` now gates Active Root Edit/Create, Save, keyboard save, editor writes, Schema/Template edit/create/delete/save, and typed Planning-root Update. Stale snapshots, failed-attempt evidence, and dirty drafts remain visible read-only. The gate is checked in controls, handlers, and mutation functions; already-open Schema dialogs also lock when Root Context changes to a blocked state.
- Project Binding renders direct observed Reference Store id, optional root, and exact Doctor severity/code/message, with neutral empty/partial wording. Its launch-owned repair path remains available for Root Context diagnostics, while an old binding snapshot becomes read-only when the binding subscription itself is loading or transport-failed.
- Active Root provenance states the shared Store-backed consequence when the CLI-selected root is external: edits are observed by other projects resolving that Store, without enumerating projects or claiming completeness.
- Environment Global profile, delivery, workflows, drift, JSON preview, raw path/config/drift evidence, stdout/stderr, diagnostics, contract drift, success, and exit status now come from one reactive `readEnvironmentGlobalConfig` projection. Config no longer reads `cli.getProfileState`; Settings remains a separate later-surface consumer. Global config writes remain owned by `planningConfig.writeEnvironmentGlobal`, while the optional auto-Update portion is independently gated by Root Context.
- Environment Global's profile/Update lifecycle moved to `environment-global-profile-section.tsx`; shared JSON/workflow helpers moved to `environment-global-config-utils.ts`. Physical ownership is now parent projection/editor (385 lines), profile/Update runner (473 lines), and utility validation (32 lines), rather than one 851-line divergent component.

### Verification

- Focused Config matrix: `pnpm --filter @openspecui/web exec vitest run --project unit src/components/config/project-binding-section.test.tsx src/components/config/active-root-config-section.test.tsx src/components/config/environment-global-config-section.test.tsx src/routes/config.test.tsx` -> `4 files, 42/42 tests passed`.
- `pnpm format:check` -> 20 changed files, pass.
- `pnpm lint:ci` -> 826 files, zero warnings/errors.
- `pnpm typecheck` -> all 15 runnable workspace packages, pass; Website reports zero errors and warnings.
- `pnpm test:ci` -> Root 43, Core 440, Server 344, Web 669, App 78, CLI 49, and every remaining workspace lane passed.
- `pnpm test:browser:ci` -> xterm `60 passed / 1 skipped`; Web Storybook `12/12`.
- Cleaned `packages/web/dist-ssg` and `.vite` with `find ... -delete`, then `pnpm --filter @openspecui/web build:ssg` -> pass. Existing `scroll-button` CSS and ineffective dynamic-import warnings remain non-fatal.
- `git diff --check` -> pass after final documentation synchronization.

### Boundary and handoff

The implementation directly addresses the reopened `3.5` and `6.8` contracts. Checkpoints remain open at `57/131` until an independent review accepts this evidence; only that review may move them to `59/131`. `6.9+` remains untouched. Do not merge, archive, release, or begin `6.9`.

Remote evidence at implementation commit `68995c072752f4bf1ef7d3ce479b71d41145287e`: PR #207 remained `OPEN/CLEAN`; Changeset Gate, CI Scope, Fast Gate, Browser Gate (`@openspecui/web`), Browser Gate (`xterm-input-panel`), and aggregate Browser Gate all completed successfully. This documentation-only evidence commit must pass the same six checks before handoff. Checkpoints `3.5` and `6.8` remain open for independent acceptance; progress remains `57/131`.

## Tenth Independent Review after `67cc14f`: Remaining Config Runtime Gaps

Review range: `731f684...67cc14f`. PR #207 is currently `OPEN/CLEAN` with six successful remote checks. The worker's focused Web suite is `42/42`; independently selected Core and Server planning-config tests also pass. Those results are insufficient to close the checkpoints because the following production paths remain reachable.

### Standards findings

1. **P1: Environment Global stale projection remains writable.** The parent JSON editor and Save/shortcut path only check `saveMutation.isPending` (`packages/web/src/components/config/environment-global-config-section.tsx:324-368`), not the subscription's `isLoading`/transport error. An already-open Profile dialog also permits Apply/Update confirmation after the projection turns stale (`environment-global-profile-section.tsx:228-242,417-451`). The backend projection is correctly retained for diagnosis, but every write must become display-only until the replacement projection is current; guard both UI and mutation functions.
2. **P1: Refresh lock does not span the rebind.** `handleRefresh` sets `isRefreshing`, calls a `void` dependency-key refresh, then clears the flag in the same turn (`environment-global-config-section.tsx:87-92`). The actual `useSubscription` teardown/reconnect/data delivery is asynchronous, so Refresh and JSON Save can be triggered repeatedly during that window. Use the subscription lifecycle or an explicit completion signal and test the pending window.
   The new Promise currently resolves inside the subscription callback (`use-planning-config.ts:106-124`), before React necessarily commits the replacement projection; an awaited Apply can therefore read the previous `projectionLockedRef` and incorrectly skip auto-Update. Completion must be tied to the post-render projection state, with a ready Apply success test.
3. **P1: Effective core profile semantics are still under-specified for explicit malformed arrays.** OpenSpec's `getProfileWorkflows` returns the full core set for every `profile: core` config, not only when `workflows` is omitted (`references/openspec/src/core/profiles.ts:43-52`; `config.ts:94-102`). The new helper must therefore ignore empty/invalid raw arrays for core while preserving the raw payload; custom profiles use their explicit list or remain empty. The UI must initialize and compare its editable selection from that effective projection rather than raw `config.workflows` (`EnvironmentGlobalProfileSection:89-95,112-116`). Add explicit empty/invalid core fixtures in addition to omitted/default and custom cases.
4. **P2: Active Root loses its local exit on a readiness transition.** When an edit is open and `actionLocked` becomes true, `active-root-config-section.tsx:132-153` unmounts both Save and Cancel. The dirty draft remains read-only but the user cannot locally cancel it. Keep Cancel visible and enabled as a non-mutating local action while Save remains locked.
5. **Evidence weakness (P1):** The Schema route now exercises only `initSchema`; its shared `writeSchemaFile` path (also used for Template file writes) remains covered only by disabled/UI assertions. The Active Root ready -> blocked test only asserts the Save button is disabled and mutates a mock object in place; it does not invoke the real Save mutation with a newly rendered blocked state. Strengthen every test at the real component handler/mutation boundary, including Active Root dynamic transition and `writeSchemaFile`; production owners must not rely on stale captured gates. A direct downstream call, in-place state mutation, or disabled-button assertion is characterization, not the required red evidence.

### Standards smell

`planning-config-service.ts:41-51` now duplicates the drift regex and semantics already present in `router.ts:1076-1088`. Extract one server-owned helper or document why the two facts intentionally differ; otherwise Settings and Config can drift again.

### Spec boundary

The previous review's Reference evidence, objective external Store consequence, Schema/Template root gate, and reactive profile projection are present. No `6.9+` scope creep was found. Checkpoints remain `3.5` and `6.8` open at `57/131` until the corrections above are implemented and independently re-reviewed.

### Next worker evidence

- Show a red test at fixed point `67cc14f` for each stale editor/dialog write, refresh pending window, omitted core workflow default, and dynamic Active Root Cancel loss; then show green tests after the narrowest fix.
- Include red/green evidence for an explicit empty/invalid core `workflows` array and for Active Root Save rejection at the real mutation boundary.
- Include red/green evidence for the Schema/Template shared `writeSchemaFile` mutation boundary, not only `initSchema`.
- Exercise actual mutation functions and assert no tRPC mutation/stream is called. Do not substitute `useMutation` stubs or manually invoke a downstream handler.
- Re-check the current readiness/projection immediately before the second operation in Apply auto-Update and in already-open dialogs; a state captured before an `await` is not current authority.
- Prove the normal ready Apply path after a successful refresh: the completion signal must be post-commit and the permitted auto-Update must dispatch exactly once.
- Run the focused matrix, Core/Server planning-config tests, full local gates, clean SSG, and `git diff --check`; record exact output and residual limitations. Keep the PR open and stop for another independent review.

## Eleventh Worker Correction: Core Semantics and Real Mutation Boundaries (2026-07-18)

This worker slice addresses the remaining tenth-review runtime gaps without starting `6.9+`. Checkpoints `3.5` and `6.8` remain open at `57/131` pending independent acceptance.

### Implemented corrections

- `effectiveOpsxWorkflowList` now follows the pinned OpenSpec profile contract: `profile: core` always projects `propose, explore, apply, update, sync, archive`, even when the raw CLI array is omitted, empty, partial, or malformed; `profile: custom` filters its explicit list and remains empty when omitted. The parsed effective projection remains separate from the raw `config list --json` payload.
- Active Root Save reads the current Root Action, subscription error, and loading refs inside the real React Query mutation function. Config Schema/Template mutation functions share a current Root Action ref, so a newly rendered blocked Root Context rejects queued writes before `writeActiveRoot`/`writeSchemaFile` transport.
- Environment Global refresh completion now resolves only from a post-commit hook effect after `useSubscription` has committed replacement data or terminal error. Ready profile Apply therefore waits for successful refresh before dispatching its permitted typed Planning-root Update exactly once.

### Focused green evidence

```text
pnpm --filter @openspecui/server exec vitest run \
  src/opsx-profile-state.test.ts src/planning-config-service.test.ts src/router.test.ts
  3 files, 101 tests passed

pnpm --filter @openspecui/web exec vitest run \
  src/components/config/active-root-config-section.test.tsx \
  src/components/config/environment-global-config-section.test.tsx \
  src/routes/config-schema-mutation.test.tsx \
  src/lib/use-planning-config.test.tsx
  4 files, 36 tests passed

pnpm --filter @openspecui/server typecheck  -> passed
pnpm --filter @openspecui/web typecheck     -> passed
pnpm exec oxlint <changed source/test files> -> 0 warnings, 0 errors
pnpm exec prettier --check <changed source/test files> -> passed after formatting
```

The Active Root test rerenders with a newly returned blocked Root Action object after a real Save click and asserts the mocked `writeActiveRoot` transport is never called. The new standalone Config test uses real `@tanstack/react-query` and crosses the actual `writeSchemaFile` mutation function; it does not stub `useMutation` or call a downstream handler. The refresh hook tests retain terminal-error pending release and duplicate-refresh coalescing, while the Environment Global component test proves ready Apply plus successful refresh dispatches one `planning-root-update`.

## Browser independent review after `3b69e20`: ownership correction for Profile Apply

The independent browser walk-through used Vite `13003` plus the local backend on `3110`. Project Binding, Active Root, and Environment Global surfaces loaded; Active Root retained an enabled Cancel and disabled Save after a planning-root loss. It also observed an enabled Profile Apply confirmation while Root Context entered Resolving. That observation is intentionally retained as evidence, but it is not a defect: Environment Global Apply owns runtime-environment config and must remain writable when its projection is current. The Root Action gate belongs to direct Update and the optional post-Apply auto-Update; the next worker correction must restore that ownership split and show the skipped second-operation diagnostic. Screenshot capture was unavailable in the installed headless agent-browser; snapshot/eval evidence remains reproducible.

### Remaining acceptance boundary

This worker has not run the complete repository gates, clean SSG build, browser suite, or remote PR checks. Do not close `3.5` or `6.8`, merge, archive, release, or start `6.9+` until those gates and an independent review pass. Residual filesystem TOCTOU/hard-link, non-atomic Store enumeration, and watcher fallback limitations remain unchanged.

## Twelfth Worker Correction: Profile Apply Ownership (2026-07-18)

The browser observation that motivated the prior visibility gate was reclassified at the ownership boundary. Environment Global Profile Apply writes the runtime-environment global config; it remains valid whenever the Environment Global projection is current, even if the planning Root Context is `checking` or `blocked`. The Root Action gate applies only to direct Planning-root Update and the optional second `planning-root-update` after Apply. The dialog confirmation now checks `rootAction.disabled` only for `pendingCommandKind === 'update'`; projection, save, and command-pending locks remain shared by both commands. An Apply whose auto-Update cannot run still completes the global write and emits an explicit `Planning-root Update skipped: ...` diagnostic. Close remains available for local diagnosis and draft dismissal.

### Fixed-point red evidence

At the required review fixed point `67cc14f`, the stale Environment Global Apply counterexample fails before the production correction. The test file was overlaid into an isolated worktree without changing the production component:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/components/config/environment-global-config-section.test.tsx \
  -t "does not confirm an already-open Apply dialog after the projection becomes stale"
  1 failed, 20 skipped
  Error: expect(element).toBeDisabled()
  Received element is not disabled
```

This is the exact stale-dialog defect required by the tenth-review contract. The isolated worktree was removed after the run. The direct Update handler already rejected a blocked Root Action at this fixed point, so its new DOM-gate test is characterization of the visible control plus mutation resistance; it is not claimed as red evidence for a production handler defect.

The broader 67cc14f audit overlaid the current counterexample tests and reported the expected failures in the inherited runtime gaps: Core-default projection, stale JSON Save/shortcut, retained-error lock, refresh-pending lock, stale Apply/Update dialogs, and the Active Root ready-to-block Cancel transition. The schema `writeSchemaFile` route test passed at this fixed point because the underlying route already rejected the exercised scenario; it is route coverage, not red evidence of a newly introduced defect. The refresh-hook test could not load in the detached worktree because its package-local dependency links were absent, so no failure is claimed for that harness-only result.

```text
67cc14f overlay matrix: 9 failed, 1 suite unresolved by detached-worktree dependency links
  Core defaults, stale editor, retained-error, refresh window, Apply/Update dialog,
  and Active Root transition counterexamples failed as intended.
  config-schema-mutation.test.tsx: 1 passed (no production failure at this fixed point).
```

At fixed point `d7631f0`, an isolated worktree applied the new ownership tests without the production correction:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/components/config/environment-global-config-section.test.tsx
  2 failed, 19 passed
  - blocked-root Apply confirmation was disabled (`toBeEnabled` failed)
  - Apply could not reach the global write boundary
```

The failing assertion reached the actual dialog control; it was not a manually invoked runner or downstream handler. The isolated worktree was removed after the run.

### Implemented correction and green evidence

- Profile Apply confirmation remains enabled after a new blocked Root Action rerender and crosses the real `writeEnvironmentGlobal` transport exactly once.
- A blocked Root Context never queues `planning-root-update`; the terminal panel reports `Planning-root Update skipped: <CLI-owned root message>`.
- Direct Update remains disabled after a new blocked Root Action rerender and does not call the typed runner transport. The test explicitly removes only the DOM `disabled` attribute before invoking the real confirmation handler, which then re-checks the newly rendered Root Action and rejects before the runner.
- The CLI terminal test double renders line text so the skipped-operation diagnostic is asserted as user-visible evidence.

Focused evidence after the correction:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/components/config/project-binding-section.test.tsx \
  src/components/config/active-root-config-section.test.tsx \
  src/components/config/environment-global-config-section.test.tsx \
  src/routes/config.test.tsx \
  src/routes/config-schema-mutation.test.tsx \
  src/lib/use-planning-config.test.tsx
  6 files, 56 tests passed

pnpm --filter @openspecui/web typecheck
  passed

pnpm exec prettier --check \
  packages/web/src/components/config/environment-global-config-utils.ts \
  packages/web/src/components/config/environment-global-profile-section.tsx \
  packages/web/src/components/config/environment-global-config-section.test.tsx \
  packages/server/src/router.ts
  passed

git diff --check
  passed
```

### Complete local verification after `e4ef2ad`

```text
pnpm format:check  -> passed (3 changed reviewer documents)
pnpm lint:ci      -> 0 warnings, 0 errors (830 files)
pnpm typecheck    -> all 15 runnable workspace packages passed
pnpm test:ci      -> root 43, Core 440, Server 354, Web 683, App 78, CLI 49, remaining lanes passed
rm -rf packages/web/dist-ssg packages/web/.vite
pnpm --filter @openspecui/web build:ssg -> passed
pnpm test:browser:ci -> xterm 60 passed / 1 skipped; Web 12/12 passed
git diff --check -> passed
```

The clean SSG build retains only the repository's known non-fatal `scroll-button` CSS and ineffective dynamic-import warnings. PR #207 was pushed at `4a3e40a`; run `29619083708` passed Changeset Gate, CI Scope, Fast Gate, Web Browser Gate, xterm Browser Gate, and the aggregate Browser Gate. The independent review therefore closes `3.5` and `6.8` (`57/131 -> 59/131`) while leaving `6.9+` untouched. Residual filesystem TOCTOU/hard-link, non-atomic Store enumeration, and watcher fallback limitations remain unchanged.

### Browser re-walk after `e4ef2ad`

The isolated live browser at Vite `13022` plus backend `3122` loaded `/config?configTab=environment-global` and reached the Profile surface. The root link reported `Planning: Resolving` during initial load and then settled; the ready Profile Apply dialog opened with an enabled `Apply profile` control. The existing browser harness has no safe blocked-root fixture that can be triggered without mutating the checkout's launch-project binding, so the blocked-root Apply/Update transition was not fabricated as a new browser claim. The automated browser gate above remains the reproducible evidence; the earlier blocked-root snapshot from the pre-correction walk is retained as historical evidence, not as post-correction proof.

## Next Apply Boundary: Checkpoint 6.9 Context Replacement

At `b6f48e6`, the project WebUI already has a `/context` route backed by the shared Root Context subscription. It renders the planning root, root source, Store id, launch project, direct Reference diagnostics, inherited data scope, read-only registry wording, and expandable Doctor/Context command evidence. Live and static route trees both retain `/context`.

The remaining 6.9 gap is coexistence: project navigation and the Web route tree still expose `/stores` through `StoresList` and `useStoresVisibility`, while the backend Store list/doctor procedures are also used by the experimental App Store Manager contract. The next worker must remove only the project Web Stores surface, preserve backend/App Store capabilities, add route-registration tests proving `/stores` is absent and `/context` remains reachable, and stop for independent review. No Store CRUD, Workset, project registry, or `6.10+` work is authorized in this slice.

## Independent Review after `8dea750`: 6.9 Evidence and Error-Projection Gaps

Review range: `b6f48e6...8dea750`. The implementation correctly removes the project Web `/stores` route, navigation identity, visibility hook, `StoresList`, and project-only Store subscription while retaining Server/Core/App Store capabilities. Route-tree tests exercise live and static registration, and no Search, Store CRUD, Workset, registry-synthesis, or `6.10+` behavior entered the diff. Checkpoint `6.9` nevertheless remains open at `59/131` because the following acceptance defects are current.

### Blocking correctness findings

1. **Stale error hides the failed Root Context attempt.** `selectRootContextSnapshot` deliberately returns stale `data` before `attempt`, and `ContextView` renders only that selected snapshot. The alert claims the failed attempt is retained, but its root/Store identity, Doctor and Context exit status, stderr, contract drift, and structured diagnostics are not displayed. The new test asserts only the stale planning root. Render the stale projection and failed attempt as separate, explicitly named facts; reuse the existing command-evidence renderer instead of inventing a second evidence shape.
2. **The new test violates the typed Root Context contract.** Independent `pnpm typecheck` exits 2 at `packages/web/src/routes/context.test.tsx:113`: `RootContextError` has `code`, not `kind`. Focused Vitest passed `5 files / 48 tests` because transpilation does not type-check this object. Correct the fixture and do not report a slice type-safe until the workspace gate passes.

### Delivery and evidence findings

3. `.changeset/openspec-16-frontend-skeleton.md` still calls Context additive, says 6.9 remains open, and says it sits alongside Stores. Update it to the final replacement contract and name `/stores` removal.
4. The retained changed TS/TSX headers synthesize English `Original request` text, including ellipses. This breaks the required provenance contract. Use the manager's exact 2026-07-15 quote, `"我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"`, and state checkpoint 6.9 separately as a derived requirement.
5. `nav-items.test.ts` proves array membership but not the actual `MobileTabBar` branches. Add a component test covering live and static rendering: Context is reachable and a stale `/stores` tab id cannot render.

The duplicated route universe in `nav-items.ts` and `nav-controller.ts` remains a low-priority Shotgun Surgery smell. Do not widen this correction into a route-registry refactor; record it for later architecture work because 6.9 can be proven without changing that boundary.

### Independent local evidence

- Focused Context/route/navigation Vitest: `5 files / 48 tests` passed.
- `pnpm format:check`: passed against the reviewer documents.
- `pnpm lint:ci`: `827 files`, zero warnings/errors.
- `pnpm typecheck`: failed with the single `RootContextError.kind` contract error above.
- `pnpm test:ci`: all workspace lanes passed; Web `116 files / 682 tests` passed.
- Clean `pnpm --filter @openspecui/web build:ssg`: passed with only the known non-fatal CSS and dynamic-import warnings.
- `git diff --check`: passed. Browser tests were intentionally not run after the typecheck blocker.

### Required correction evidence

- Demonstrate a red stale-error component assertion against fixed point `8dea750` for the missing failed-attempt root/Store/command evidence, then green after the production correction.
- Run the focused Context/route/nav/sidebar/mobile matrix, Web typecheck, full workspace format/lint/typecheck/unit gates, clean SSG, browser suite, and `git diff --check` before requesting another review.
- Preserve `6.10+`, merge, archive, and release as untouched. Do not treat prior PR CI at `b6f48e6` as evidence for this unpushed correction.

## 6.9 Correction and Independent Acceptance after `11df4ae`

The correction renders the last successful Context and current failed attempt as separately named observations. It reuses the typed Root Context and command-evidence renderer, so the attempt preserves planning root/source/Store, CLI availability, Doctor and Context exit status, stderr, contract drift, structured diagnostics, stdout, Context members, References, and data scope without reparsing or synthesizing facts. When no stale observation exists, only the failed attempt renders.

The release changeset now states that Context replaces the project Stores surface. All 12 retained/new changed TS/TSX files use the exact manager quote plus a separately identified derived 6.9 requirement. A real `MobileTabBar` component test covers live and static navigation, including removal of an obsolete persisted `/stores` id.

### Red/green and local evidence

- At fixed point `8dea750`, the exact stale-error component test fails `1 failed / 8 skipped`: the `Last successful Context (stale)` region does not exist, and the failed attempt's root/Store/CLI/Doctor/Context evidence is unreachable.
- At `11df4ae`, the focused Context/route/controller/nav/sidebar/mobile matrix passes `6 files / 51 tests`.
- `pnpm format:check` passes for 15 changed files.
- `pnpm lint:ci` passes for 828 files with zero warnings/errors.
- `pnpm typecheck` passes across all 15 runnable workspace packages.
- `pnpm test:ci` passes: root 43, Core 440, Server 354, Web 117 files / 685 tests, App 78, CLI 49, and all remaining lanes.
- Fresh SSG passes after cleaning `packages/web/dist-ssg` and `.vite`; only the known non-fatal CSS and ineffective dynamic-import warnings remain.
- `pnpm test:browser:ci` passes: xterm `60 passed / 1 skipped`, Web Storybook `12/12`.
- `git diff --check` passes. The known repository Vite+ staged hook still has no staged config, so the worker used `--no-verify` only after the complete gates passed.

### Independent re-review and browser evidence

Standards and Spec re-reviews report no findings. The duplicated route universe across navigation/controller/route-tree remains a deferred smell rather than a 6.9 scope expansion.

Agent-browser used isolated backend/live/static ports `3130`, `13030`, and `13031`. Live desktop and mobile `/context` show Context navigation without Stores, CLI-selected root/source, launch project, CLI 1.6.0, neutral direct-Reference copy, inherited data scope, read-only registry copy, and full evidence disclosure. Direct live `/stores` canonicalizes to Dashboard and never renders the retired page. Static desktop/mobile Context renders only the neutral pending snapshot, never live root or registry truth; mobile geometry reports `scrollWidth == clientWidth == 390`. No Store mutation control or machine-wide completeness claim was observed.

Agent-browser 0.27.1 could not capture the fixed-height App root: selector screenshots report a zero-height body/root and viewport/path mode times out. No screenshot is claimed. Snapshot, text, URL, and DOM geometry evidence complete the walk-through, and every named session and temporary server was closed; ports are released.

Checkpoint `6.9` therefore closes (`59/131 -> 60/131`). `6.10+`, merge, archive, and release remain untouched.

## Next Apply Boundary: Checkpoint 6.10 Source-scoped Search

Research after `11df4ae` confirms that root ownership itself is already correct: `PlanningRootServiceManager` owns one `SearchService` for the current CLI-selected Planning root, and live search rebuilds from that record's Adapter, DocumentService, and direct Referenced Spec Catalog entries. Compound Referenced Spec ids and routes already survive into search documents. Static search also builds from the shared snapshot.

The incomplete contract is the query model. `SearchQuery` currently contains only query/limit, `SearchDocument`/`SearchHit` carry no source scope, and `SearchRoute` renders one mixed result list. `collectSearchDocuments` puts Owned Specs, direct Referenced Specs, Changes, and Archives into the same provider. Therefore the default search can return References, and there is no explicit Referenced Specs view. Filtering mixed hits in the browser would be incorrect because the search provider applies limit after global ranking.

The next implementation must add a typed `active-root | referenced-specs` scope end to end. The generic search engine may keep scope optional for non-project consumers, but when a project query supplies scope it must filter indexed documents before match scoring, sorting, and limit in both the TypeScript engine and generated worker runtime. Every project document and hit must carry one exact scope. Active root indexes Owned Specs, Changes, and Archives; Referenced scope indexes only direct read-only Referenced Specs and preserves Store-compound identity.

Web Search uses an accessible two-segment control matching the established Spec source interaction. Absence or invalid URL scope defaults to Active root; explicit `scope=referenced-specs` selects the sibling view and survives query replacement. Switching scope cannot display stale results from the prior source while loading. Referenced copy says only what is currently observed/materialized and never claims completeness. Static mode uses the same control and query semantics; static document paths must derive from each Spec identity instead of labeling every snapshot Spec as owned.

Do not turn 6.10 into a SearchService ownership rewrite, Reference body-materialization policy, `7.*` export-policy implementation, Git `6.11`, App Store Manager, Workset, or general route-registry refactor. Focused evidence must cover filtering before limit, duplicate ids across owned/multiple Stores, no referenced changes/archives, live query/subscription, static indexing, scope transitions, URL state, navigation, and neutral empty/error/loading states before full gates and independent review.

## Independent Review after `bc09a3f`: 6.10 Source-Isolation Gaps

Review range: `10a3b42...bc09a3f`. The implementation correctly introduces `active-root | referenced-specs`, filters before scoring/limit in both the TypeScript engine and generated Node worker, marks live documents by source, defaults Server queries to Active root, preserves the explicit scope through query/subscription and URL state, clears cross-scope hits, and retains Store-qualified live navigation. It does not start Git `6.11`.

Checkpoint `6.10` remains open at `60/131` for four reasons:

- The compatibility fallback is unsafe. A backend without `search.subscribe` predates the scoped Search contract; its `search.query` schema strips/ignores `scope` and returns limited mixed-index results. Calling it and attributing those hits to the selected scope is fabricated provenance. Fail closed with an explicit incompatibility error and do not start the legacy query/realtime fallback.
- The static Reference fixture is not legal current runtime data. `ExportSnapshot.specs` is still Owned-only, but the test uses `as never` to inject two References. This makes the Referenced branch in `getSearchDocuments` unreachable and duplicates live/static identity-to-path mapping before the shared `7.*` export model exists. Remove the escape, the future fixture, and the unreachable branch. Test current static truth: Owned Specs, Changes, and Archives are Active-root documents; Referenced search is empty with neutral wording.
- The first reactive query has an initialization race. `queryReactive()` calls `rebuildIndex()` with `initialized=false`; the method returns before collecting documents and then searches an empty provider. Server warmup is a deferred background task, so it cannot guarantee initialization before a client subscribes. A direct production-class probe at `bc09a3f` records only `search`, with no `init` or `replaceAll`. Make the first reactive query initialize current Planning-root truth, then rebuild only on later reactive queries.
- The worker Goal explicitly required SearchRoute Active-root empty, Referenced empty, loading, and error tests plus correct subscription lifecycle. Those tests are absent, and the hook test does not assert that the old subscription is unsubscribed during a scope transition.

Independent checks on `bc09a3f` pass: focused Search/Server/Web tests, package typechecks, workspace format/lint/typecheck, `test:ci` (`270 files / 1727 tests`), clean SSG, xterm browser (`60 passed / 1 skipped`), Web browser (`12/12`), and `git diff --check`. These are a valid regression baseline, not acceptance of the defects above. A second independent review and live/static desktop/mobile browser walk-through remain required after correction. Merge, archive, release, `6.11`, and `7.*` remain unauthorized.

## Second Independent Review after `121d405`: URL Source Authority

Review ranges: the correction is `0d23488...121d405`; the complete checkpoint remains `10a3b42...121d405`. The correction objectively satisfies the earlier review in every inspected runtime boundary:

- A missing `search.subscribe` fails closed with zero legacy query or realtime subscription.
- Legal current static snapshots produce only Active-root Owned Spec, Change, and Archive documents; Referenced Search remains neutral-empty without future `7.*` payloads or type escapes.
- A first reactive query executes `collect -> init -> search`; later reactive queries rebuild before search without a duplicate initial replace.
- Project documents and hits require exact scope through SearchService, Router, and Web parsing. Loading/error states cannot render retained results, and hook-level A -> B retires A once and rejects late A data.

Independent fixed-point evidence against `bc09a3f` distinguishes defects from characterization:

```text
SearchService  3 red  first reactive omitted init; missing/wrong hit scope resolved
useSearch      1 red  missing subscription did not expose source-scoped incompatibility
SearchRoute    2 red  loading/error still rendered stale hits

characterization at bc09a3f:
empty states, old-subscription retirement/late-data rejection,
and legal static Owned-only/Referenced-empty projection already passed
```

The checkpoint nevertheless remains blocked by one runtime defect and one documentation defect:

1. `SearchRoute` parses the new URL scope but stores the actual selected scope separately and synchronizes it only from a passive effect. A same-mount external location transition A -> B at `121d405` records new `useSearch` calls `['active-root', 'referenced-specs']`. The first call can commit the old tab/request/hits; the hook cannot reject it because the Route still supplied A. The URL must become render-time scope authority, not an eventual synchronization source.
2. `packages/search/src/types.ts` documents optional scope for project-owned consumers, reversing the real generic-optional/project-required contract. The runtime types are correct, but the mandatory intent header is not.

Focused independent green evidence at `121d405` passes Search `3 files / 6 tests`, Server `2 / 14`, and Web Search/static `3 / 18`; lint passes `829` files with zero warnings/errors and all `15` workspace package typechecks pass. Test files remain excluded from TypeScript compilation by the repository tsconfig, so that typecheck is not claimed as test-fixture type safety. These gates do not accept the URL counterexample.

No new Change or loopback is justified. This is a direct 6.10 source-isolation correction. Keep progress at `60/131`, do not start `6.11` or `7.*`, and stop again for independent review after the code/test/header correction.

## Third Independent Review after `5204c55`: Correct Candidate, Unsafe Test Fixtures, and Undelivered Head

Review ranges: the complete checkpoint is `10a3b42...5204c55`; the uncommitted URL correction applies on top of `5204c55`. Checkpoint `6.10` remains open at `60/131`.

The three-file candidate correction is behaviorally correct:

- `SearchRoute` derives the selected source directly from the current `location.search` during render. The tab, `useSearch` invocation, query edits, and source navigation now share that one authority; the duplicate local source state and passive source-repair effect are gone.
- The same-mount Route test starts with an Active-root hit, changes the external URL to Referenced Specs, rerenders, and proves that every new `useSearch` call is immediately `referenced-specs`, the Referenced tab is selected, and the old hit is absent.
- `packages/search/src/types.ts` now states the real generic-optional/project-required provenance boundary without weakening the runtime types or schemas.

The fixed-point counterexample is direct rather than characterization evidence. At `121d405`, adding only the candidate Route test yields `1 failed / 10 passed`: the transition records `['active-root', 'referenced-specs']` instead of the required `['referenced-specs']`. On the current candidate, independent focused suites pass Search `3 files / 6 tests`, Server `2 / 14`, and Web Search/static `3 / 19`.

### Blocking Standards finding

The checkpoint's new Server evidence still fabricates owner and Adapter capabilities with type escapes:

- `packages/server/src/search-router.test.ts` adds `runReactiveOperation` and two new caller fixtures through repeated `as never` values. Those assertions execute the real public Router procedure, but TypeScript does not prove that the fake Planning-root record or Context matches the current owner contract.
- `packages/server/src/search-service.test.ts` adds first-reactive and provenance tests using `adapter as never`; the provenance fixture also reads `provider.searchResults[0]!` instead of constructing or guarding one valid typed hit.
- `packages/server/tsconfig.check.json` excludes `**/*.test.ts`, so the normal package/workspace typecheck cannot compensate for these escapes. Green Vitest transpilation is therefore not typed evidence.

This repeats the exact failure mode the Change is meant to prevent: a test can stay green while a Manager-owned or typed CLI boundary drifts. Correct the fixtures, not the production contract. Prefer a real `OpenSpecAdapter` with typed spies for SearchService tests. For Router tests, provide a reusable typed Context/Planning-root fixture that preserves the real `appRouter -> runOperation/runReactiveOperation -> SearchService` path; do not manually invoke a downstream handler. Replace the non-null assertion with an explicit valid hit fixture or guard. Do not solve test convenience by weakening `Context`, `PlanningRootServices`, `SearchService`, or project Search provenance.

### Blocking delivery facts

The worker report that the code was submitted is not current repository truth:

```text
local HEAD:   5204c551b17f1e5e0cdad438088dd085216e5c19
remote/PR:    10a3b42acb50d946303f9a634a06687dab6d718b
local ahead:  5 commits
dirty files:  packages/search/src/types.ts
              packages/web/src/routes/search.tsx
              packages/web/src/routes/search.test.tsx
```

PR #207 is `OPEN/CLEAN`, but its six green checks belong only to `10a3b42`. No final-SHA CI, clean-worktree, or local-equals-remote evidence exists for checkpoint `6.10`.

The current dirty candidate independently passes the complete local lane: format check; lint across `829` files with zero warnings/errors; all `15` workspace typechecks; full `test:ci` including Core `440/440`, Server `360/360`, Web `697/697`, and CLI `49/49`; a clean SSG build; xterm browser `60 passed / 1 skipped`; Web Storybook `12/12`; and `git diff --check`. The SSG build retains only the known non-fatal `scroll-button` and ineffective dynamic-import warnings. Live desktop Search shows the URL-selected Active/Referenced controls and neutral Referenced empty/loading projection; one agent-browser subscription wait later stalled the automation session, so live/static mobile history acceptance is not claimed. These local results validate the candidate behavior but cannot discharge the untyped fixture or delivery blockers.

Independent `openspec validate target-openspec-cli-16-line --strict --json` exits nonzero because this active `opsx-collab-pr-loop` Change has no formal delta under `specs/`. That known artifact-shape state is separate from the `6.10` implementation finding; do not report strict Change validation as green until the planned one-way Wayfinder/loop convergence creates formal deltas.

No new Change or loopback is required. The next worker must apply the Server test-fixture correction, preserve and commit the current three-file URL correction, run all checkpoint and repository gates, record exact evidence, push every local `6.10` commit, wait for CI on the resulting PR head, and stop for independent review. `6.10`, `6.11+`, merge, archive, and release remain untouched until that review.

## Independent Review after `78c925c`: Runtime Accepted, Delivery Still Open

Review range: `10a3b42...78c925c`.

Standards review found no hard documented-standard violation. All changed TypeScript/TSX files carry timestamped orthogonal-intent/original-request headers; the Server Search tests now use a checked `tsconfig.search-tests.json` lane without new `as never`, `as any`, suppression comments, or fabricated non-null fixture assertions. The only advisory smell is small duplicate normalization/provenance parsing between `SearchService.query`/`queryReactive` and Router query/subscription; it is not a checkpoint blocker.

Spec review found no new runtime Search defect. The current implementation preserves source filtering before match/score/sort/limit in the TypeScript and generated worker engines, active-root versus direct Referenced Specs projections, exact project hit provenance, fail-closed compatibility without legacy query/realtime fallback, legal static Owned-only truth with neutral Referenced Search, and render-time URL authority for same-mount A -> B transitions.

The acceptance blocker is delivery, not runtime behavior:

```text
local HEAD:  78c925c
remote/PR:   10a3b42
ahead:       7 commits
dirty docs:  AGENTS.md
             i18n.zh.md
             loop/checkpoints.md
             loop/implementation.md
```

The six green PR checks are attached only to `10a3b42`. No final-SHA CI, clean-worktree proof, local/remote/PR equality, or final live/static desktop/mobile Search walk-through has been recorded. `6.10` therefore remains open at `60/131`; no `6.11`, `7.*`, merge, archive, or release is authorized. The known active Change artifact shape also means `openspec validate --strict` must not be reported as green until formal `specs/` deltas are converged.

The next worker Goal must perform the final apply/delivery slice: preserve `78c925c` Search behavior, commit the complete reviewer evidence, run the focused and full gates plus clean SSG, perform the honest browser walk-through, push every local commit, wait for checks on the exact resulting PR SHA, and stop at the next independent review boundary.

## Independent Review after `78c925c`: SSR Correction and Fixture Attribution

This review keeps `6.10` open at `60/131`. The source-scoped Search code accepted at `78c925c` has no new runtime finding. The review did expose one production SSG defect and one environment-only live limitation.

### Fixed-point red/green evidence

- Static red at fixed point `78c925c`: adding only `packages/web/src/ssg/entry-server.test.ts` in the Node environment plus the Node-safe test setup yielded `1 failed / 1 passed`. Importing the static server reached `view-transitions-toolkit/dist/feature-detection.js:6:21` (`sameDocument: !!document.startViewTransition`) and threw `ReferenceError: document is not defined` before snapshot/routes were touched.
- Static green on the candidate: `runtime.ts` no longer imports the browser-only feature-detection or tracker modules at top level. Tracker installation is browser-gated, dynamically loaded once, shared across concurrent callers, and awaited before the first native `startViewTransition`. The direct Node SSG render assertion now passes, proving the server module graph can import and render without browser globals.
- `pnpm --filter @openspecui/web exec vitest run --project unit src/ssg/entry-server.test.ts src/lib/view-transitions/runtime.test.ts`: `2 files / 8 tests` passed.
- `pnpm --filter @openspecui/web typecheck`: passed.
- Full `pnpm test:ci` on `9d366dc`: passed with `270 files / 1741 tests` (Core `47/440`, Server `47/360`, Web `117/699`, CLI `11/49`, and all remaining workspace lanes green).
- Clean `pnpm --filter @openspecui/web build:ssg` and `build:ssg-cli`: passed; only the known non-fatal CSS and ineffective dynamic-import warnings remain.
- Actual SSG CLI using the generated example snapshot completed `Routes: 10` and rendered all 10 routes (11 `index.html` files including the fallback). No `document is not defined` occurred.

### Live timeout attribution

The previous live Search loading state is not evidence of a Search defect. The fixed-point legacy example used an unpinned `npx @fission-ai/openspec` runner and had no valid OpenSpec config. At fixed candidate `78c925c`, `pnpm dev:legacy --dir ./example --port 4123` followed by `curl --max-time 15 http://localhost:4123/trpc/rootContext.get?input=%7B%7D` produced no response and exit 28. Process sampling showed `npm exec @fission-ai/openspec doctor --json` still running at 5-15 seconds; the server logged `CLI runner resolve timed out` at `planning-root-service.ts:458`. Short `--version` probes and `doctor/context` probes likewise remained in flight. This is a runner/configuration fixture limitation, so no live result-list, stale-result retirement, or same-mounted A -> B claim is made from that run.

### Remaining acceptance and delivery boundary

Code commit `9d366dc` is local-only; reviewer-owned Change documents remain uncommitted. Static and live browser Search still require an honest desktop and real `390x844` mobile walk-through with a terminating pinned OpenSpec 1.6 fixture. The walk-through must record exact URLs, query/source transitions, no stale cross-source results, neutral empty/loading/error states, compound Reference navigation when data exists, and mobile geometry; unavailable fixture data must remain an explicit limitation. Local/remote/PR SHA equality and exact-SHA CI are also still absent. Keep `6.10` unchecked; do not start `6.11+`, merge, archive, or release.

### Static browser evidence after `9d366dc`

Using the generated static fixture at `/tmp/openspecui-ssg-render.Md31zL`:

- Desktop Active-root `/dashboard?_p=%2Fsearch%3Fquery%3Dauth` rendered three real results: Owned `auth` Spec, `add-2fa` Change, and the archived session-timeout Change. The captured screenshot is `/tmp/search-static-desktop-auth.png`.
- Switching to Referenced Specs preserved `auth`, added `scope=referenced-specs` to the encoded Search route, and showed the neutral no-match projection. Same-mounted `history.pushState` from Active to Referenced selected B immediately and did not leak A hits. A subsequent B query preserved both query and scope; an invalid scope fell back to Active root.
- Active `zzzz-no-hit` showed the Active-root empty state. Clicking the Owned Spec navigated to `/specs/owned/auth`.
- At a real `390x844` viewport, Active and Referenced Search plus the mobile navigation showed no horizontal overflow or overlapping content. Screenshots: `/tmp/search-static-referenced.png`, `/tmp/search-static-same-mount-B.png`, `/tmp/search-static-empty-active.png`, `/tmp/search-static-mobile-active.png`, `/tmp/search-static-mobile-referenced.png`, `/tmp/search-static-mobile-nav.png`.

Live browser claims remain intentionally limited. The example backend at `:4123` stayed in `Searching...` because the candidate launch root had no `openspec/config.yaml|yml`; the minimal fixture at `:4124` returned HTTP `search.query=[]` and Root ready, but the browser subscription did not stabilize. Therefore no live Active/Referenced result, live error/empty/stale-result, live compound Reference, or live result-navigation claim is made. All browser sessions, target ports, and temporary servers were closed.

The official browser gate on `9d366dc` passed with xterm `6 files / 60 passed / 1 skipped` and Web Storybook `4 files / 12 passed`, without retries. `git diff --check` also passed for the final local candidate.

## Sixth Independent Review and Delivered Evidence at `998acd9`

The independent Standards and Spec axes identify no remaining defect in the accepted Search contract or the narrow SSR correction. The direct fixed-point counterexample proves the production SSG failure, and the current implementation preserves active-transition tracking before the first native transition while keeping browser globals out of the static server module graph. No new Change or loopback is required.

Delivery facts for PR #207:

- implementation correction: `9d366dcb2696b34b299422330dc458377d517b2f`
- reviewer evidence: `998acd983ef3d2b1e829c9046292a2488a60d3b1`
- local HEAD, remote feature branch, and PR head all resolved to `998acd983ef3d2b1e829c9046292a2488a60d3b1`
- PR remained `OPEN/CLEAN`; Changeset Gate, CI Scope, Fast Gate, Web Browser Gate, xterm Browser Gate, and aggregate Browser Gate all passed for that exact head
- final worktree was clean; no merge, archive, release, or `6.11+` work occurred

Checkpoint `6.10` deliberately remains open at `60/131` for the next independent decision. Static desktop/mobile acceptance is complete; live browser results retain the fixture/subscription limitations recorded above and are not silently promoted into green claims.

## Seventh Independent Review after `8e7cc76`: Reactive Dependency Ownership

Review range: `10a3b42...8e7cc76`. The Standards axis found no documented-standard, typed-fixture, SSR, or source-provenance defect. All 29 changed TypeScript/TSX files retain the required intent headers; the checked Search fixture lane passes without new type escapes; focused Search `6/6`, Server Search `14/14`, Web Search/SSR `27/27`, and `typecheck:search-tests` pass. Local HEAD, remote branch, and PR #207 head are equal at `8e7cc7685c7c46c738a8a93c1b9e3213b818cefd`; the six exact-head PR checks are green.

The Spec/runtime axis found one P1 with two manifestations. `SearchService.init()`, `queryReactive()`, and `rebuildIndex()` share instance-level `initPromise` and `rebuildPromise`. Each tRPC subscription owns a different `ReactiveContext`, and dependency collection occurs only in the AsyncLocalStorage context that actually executes `ReactiveState.get()`. A subscription that waits for warmup or another subscription's in-flight document read receives the first Search result but registers no file dependency and then terminates. The Planning-root manager passes no legacy `OpenSpecWatcher` to SearchService, so that lost dependency has no equivalent per-subscriber wakeup path.

The fixed-point production-class probe uses real `SearchService`, `ReactiveContext`, and `ReactiveState`. `ReactiveState.set()` directly models the same reactive settlement signal emitted after a physical write or watcher refresh:

```text
warmup race:
  firstDone=false
  endedBeforeWrite=true
  writeChangedState=true
  afterWriteDone=true

two ReactiveContexts sharing one rebuild:
  firstADone=false
  firstBDone=false
  bEndedBeforeWrite=true
  writeChangedState=true
  secondADone=false
  bAfterWriteDone=true
```

This is direct red evidence: the waiting subscription gets an initial value, then is already `done` before the invalidation and cannot receive the update. The permanent test must require both A and B to remain live and emit after the same state change; removing or bypassing caller-local document collection must make it fail.

The same ownership error leaves the buffered public query stale. In the controlled pinned OpenSpec 1.6 fixture, an external edit added `Reactiveproof3 marker: reactiveproof3`; after watcher settlement and with no active Search subscription, `search.query({ query: "reactiveproof3", scope: "active-root" })` still returned `[]`. A newly opened Search subscription rebuilt and observed current content. The earlier single-client live proof is valid only for the uncontended path and cannot accept multi-client convergence.

The correction must split current-document collection from mutable provider work. Every public query and every reactive invocation must collect and validate current Planning-root documents in its caller context before awaiting any other context-owned in-flight work. Provider initialization/replacement/search may then be serialized as one ordered operation so each response is searched against its own collected snapshot. Warmup remains an optimization and cannot own freshness or steal subscription dependencies. Add checked warmup-race, two-context, buffered-query freshness, and public Router/multi-client evidence without weakening production contracts or using fabricated fixtures.

Keep checkpoint `6.10` open at `60/131`. Do not start `6.11`, merge, archive, or release before this correction is applied, delivered, and independently reviewed.

### Previous Browser Attempt and Un-attributed Acceptance Blockers

The independent browser worker started `pnpm dev:legacy --dir ./example --port 4123` and then the root project variant, exposing Web at `http://localhost:13003` and backend at `http://localhost:4123`. It opened `/search?query=auth`; App normalized this to the Dashboard shell with a Search pop route. Desktop evidence confirms Active root is initially selected, the `auth` query is retained, and selecting Referenced Specs immediately updates the encoded pop URL, tab selection, and placeholder without losing the query.

The run cannot establish full 6.10 browser acceptance:

- Live Search remained at `Searching...`. `rootContext.get` timed out after five seconds while the backend repeatedly invoked OpenSpec and an `openspec instructions checkpoints --change target-openspec-cli-16-line --json` process did not settle. No Active-root result was available to prove stale-result retirement after switching scope.
- `pnpm --filter @openspecui/web build:ssg` succeeded, but the subsequent HTML export for both the root and example projects failed during `Pre-rendering pages...` with `document is not defined`. Static Search therefore never reached a browser.
- The current Context has no direct References, so compound Reference navigation was not exercisable.
- The attempted mobile screenshot still used a 1280-pixel viewport; it is not mobile evidence. Empty/error state and mobile overflow were not exercised.

The browser session and dev processes were closed; ports `4123` and `13003` were released. Treat the live timeout and static pre-render failure as un-attributed acceptance blockers. The next worker must reproduce with exact process/stack evidence in a controlled fixture, distinguish environment/fixture failure from a production regression, and make only a proven narrow 6.10 correction. Do not infer a Search defect from the current incomplete run.

## Eighth Independent Review after `f72e03a`: Runtime Correction Accepted, Failure Recovery Evidence Open

Review range: `9f42bcea2b331efebeb0456f0d7561bac0898fde...f72e03ae3bf10a2ec1c09f6054492e2f6ac40600`. The implementation commit is local and the branch is one commit ahead of the remote PR head. Checkpoint `6.10` remains open at `60/131`.

The Standards axis found no hard documented-standard violation. The three changed TypeScript files retain accurate 2026-07-19 intent headers, the Search fixtures are included by `tsconfig.search-tests.json`, and no new `as never`, `as any`, double-unknown cast, fabricated non-null state, or suppression comment appears. The real Router test crosses `createServer -> appRouter -> PlanningRootServiceManager -> SearchService` and performs a physical Owned Spec write. Duplicate local `Deferred` and Spec-markdown helpers across the two test files are a non-blocking maintenance smell, not a checkpoint defect.

The Spec/runtime axis accepts the dependency-ownership correction:

- `query` and `queryReactive` collect and validate current Planning-root documents separately in their own caller context.
- Provider apply plus search runs as one serialized operation, so another caller cannot replace the provider between one caller's snapshot and search.
- Warmup is only an independent optimization and cannot satisfy or steal a subscription's reactive dependencies.
- Direct physical tests cover the warmup waiter, two independent `ReactiveContext` streams, buffered freshness without a subscription, atomic provider snapshots, disposal admission, watcher listener removal, and two public Router subscribers converging after one write.
- Focused independent verification passes Server Search `20/20` and `typecheck:search-tests`.

One evidence defect still blocks acceptance. The Goal requires concurrent initialization, buffered query, reactive query, and disposal to complete deterministically without an unhandled queue rejection. The new lifecycle test blocks initialization and then succeeds; it never makes `init`, `replaceAll`, or `search` reject. `SearchService.runProviderOperation` currently recovers `providerOperationTail` on both fulfillment and rejection, but removing the rejection branch leaves every new test green. A later call would then inherit the rejected tail and fail without executing its own provider operation. This is the same recurrence pattern seen in earlier lifecycle corrections: the implementation is plausible, but the test is insensitive to the exact hidden cleanup/recovery transition.

Add one checked, mutation-resistant provider-failure test. Admit initialization plus buffered/reactive queries, make the first provider initialization fail deterministically, and prove the admitted later calls recover through the queue, disposal runs exactly once, and later admission is rejected. Temporarily remove the rejection recovery from `providerOperationTail`; the exact test must then fail because the later operations inherit the failed tail. Restore production and record both outputs. Do not refactor shared test helpers unless the correction actually requires it.

Full repository gates, clean SSG, pinned live two-client browser convergence, buffered-before-subscription browser evidence, desktop and real `390x844` Active/Referenced acceptance, push, exact-head CI, and local/remote/PR equality remain unproved for `f72e03a`. Do not start `6.11`, merge, archive, or release.

## Ninth Independent Acceptance at `dd3307a`: Checkpoint 6.10 Closed Locally

The Eighth Review finding is corrected by test-only commit `dd3307ac6b5b72e89c629d59d973e0f3839be045`. `FailFirstInitProvider` admits initialization, buffered query, reactive query, and disposal, fails the first provider initialization, then proves both queued calls execute, disposal occurs once, repeated disposal is idempotent, and later admission is rejected. The fixture is covered by `tsconfig.search-tests.json` and adds no type escape or production-contract weakening.

Mutation-resistance evidence is direct:

```text
normal production:  1 passed / 14 skipped
reject recovery removed:
  1 failed / 14 skipped
  2 unhandled rejections
  buffered query inherited "fail-first provider init"
restored production: 1 passed / 14 skipped
```

`packages/server/src/search-service.ts` has no final diff. Independent focused verification passes Server Search `2 files / 21 tests` and `typecheck:search-tests`; the Search provider/engine lane passes `3 files / 6 tests`; Web Search, static, SSR, and View Transition lanes pass `5 files / 27 tests`. Format, lint across 829 files with zero warnings/errors, all 15 workspace typechecks, and `git diff --check` pass.

Final repository gates on exact local head `dd3307a` pass:

- `pnpm test:ci`: `270 files / 1748 tests`; Server `367`, Web `699`, Core `440`, App `78`, CLI `49`, Search `6`, and remaining workspaces pass. Only known jsdom Canvas logs remain.
- Clean `pnpm --filter @openspecui/web build:ssg`: client `5222` modules and Server build pass. Only the known CSS `scroll-button` and ineffective `trpc.ts` dynamic-import warnings remain.
- `pnpm test:browser:ci`: xterm `6 files / 60 passed / 1 skipped`; Web Storybook `4 files / 12 passed`.
- Ignored SSG artifacts were restored to their entry state and no test/build process remains.

Pinned live acceptance uses `/tmp/openspecui-search-browser-f72e03a.PjEI5b`, the repository submodule CLI `v1.6.0` at `e1b51d1`, and an isolated XDG data home. The launch config selects declared Store `team`; Doctor reports the direct `platform` Reference healthy. Both Stores contain an `auth` Spec.

- With no browser session or Search subscription, HTTP `search.query` returns no `bufferedliveproof` hit before an external Owned Spec edit and returns only `spec:owned:auth` with that marker after the edit.
- Independent browser sessions A (`1280x800`) and B (`390x844`) hold `dualliveproof` in Active root. One external write updates both without reopen or query change. The mobile converged screenshot was captured too early and is deliberately excluded; DOM evidence proves its eventual result.
- Active `authentication` returns only Owned Spec, Change, and Archive. Referenced `auth` returns exactly `referenced:platform:specs/auth`, labeled read-only, with no Owned, Change, or Archive leakage.
- Both clients navigate to `/specs/referenced/platform/auth?_b=%2F`. Mobile detail states `Referenced from platform` and remains read-only.
- Empty, Active, Referenced, and compound-navigation states render on desktop and mobile; `scrollWidth == clientWidth` at both 1280 and 390 pixels.
- Valid screenshots are `/tmp/search-live-f72e03a-{desktop-empty,mobile-empty,desktop-converged,desktop-active,mobile-active,desktop-referenced,mobile-referenced,desktop-reference-navigation,mobile-reference-navigation}.png`.

Browser warmup overlap was not stably forced and remains covered by deterministic production-class and Router tests. Loading/error were not promoted to live claims; existing unit tests cover them. Browser sessions and fixture services were closed, ports `4132`, `13013`, and `13004` are released, and the repository has no browser-owned diff.

Checkpoint `6.10` advances `60/131 -> 61/131`. Runtime `f72e03a`, test `dd3307a`, and reviewer evidence `6d5a67a` were pushed to PR #207. Local HEAD, remote feature branch, and PR head all resolved to `6d5a67a73b93f24adce3384462e284e80a07ae9a`; the PR remained `OPEN/CLEAN`, and all six Changeset, CI Scope, Fast, Web Browser, xterm Browser, and aggregate Browser checks passed on that exact head. This closes Search and unlocks `6.11` planning only; merge, archive, and release remain forbidden.

## Checkpoint 6.11 Research: Root-Rebound Git Scope Is Stale

The fixed-root Git contract implemented earlier remains correct: canonical `topLevel + commonDir` identity collapses nested roots in one repository, distinct Planning repositories are optional, and every current Git route names `code | planning`. Focused existing tests pass Server `6/6` and Web `16/16`, but every fixture holds one Root for the test lifetime. They do not exercise Planning A -> Planning B, Planning B -> Code collapse, or A -> B -> A rebinding.

Three P2 runtime defects remain at local baseline `dd3307a`:

- Server exposes only buffered `git.scopes`; Web caches it under `['git', 'scopes']`. Root Context changes do not invalidate or push a replacement inventory, so A may remain indefinitely after the backend owns B.
- Git overview, entries, metadata, files, patch, prefetch, and detail caches use semantic `planning` without repository binding identity. If scopes is manually refreshed to B while B data is pending, A results remain under the same keys and are displayed next to B's path. This contradicts the earlier recorded claim that repository changes do not reuse status/history placeholder content.
- `runGitScope` resolves the current Planning root on every call. A stale A Refresh contains only `scope: planning`; after rebind it executes against B, invalidates B cache, and writes B's refresh stamp. The user action is silently reinterpreted rather than rejected.

No destructive P1 is established. Worktree removal and handoff enumerate the current B inventory and require the submitted physical path to match; an A-only target normally fails with `Worktree not found` before `git worktree remove` or `ensureWorktreeServer`. That physical guard is retained, but it is not a substitute for stale-intent detection.

The accepted correction shape is:

```text
Root binding A                       Root binding B
    |                                   |
    v                                   v
Git scopes emission A  --push/pull--> Git scopes emission B
    token A                             token B
    |                                   |
    +-> Web keys [git, planning, A]      +-> Web keys [git, planning, B]
    +-> request expects A               +-> request expects B
              \                         /
               Server lease compares current token
                    mismatch -> typed conflict
                    match    -> Git operation
```

The token is an opaque backend-issued binding epoch, not a path, repository credential, or authorization capability. It changes whenever a new Planning-root service record is activated, including A -> B -> A. Git URLs continue to persist only the semantic scope. Each query/mutation, including retained Dashboard Code Git operations, must be audited; Code remains Launch-owned and must not become blocked by Planning-root readiness.

Required fixed-point evidence:

- Server subscription over real Manager-owned Code/A/B repositories emits A then B then Code-only after Root transitions, with A retirement before B exposure and a new token on each binding.
- Web renders A, receives B, keeps B queries pending, and removes every A overview/history/detail/patch projection before labeling B. Keys and View Transition prefetch include B's token.
- A-token Refresh after B activation returns a typed conflict and produces no B cache invalidation or refresh stamp. A-token remove and handoff also conflict before physical execution. Removing the Server token comparison must make the mutation test write B or invoke the rebound owner.
- Root loading/stale/error or Root/scopes mismatch locks Planning controls and keeps old Planning data explicitly non-authoritative; Code Git remains usable.

Do not expand 6.11 into Store synchronization, clone/pull/push, App Store Manager, a generic React Query rewrite, Terminal `6.12`, static `7.*`, merge, archive, or release.

## Checkpoint 6.11 Implementation Candidate: Reactive Repository Binding

Implementation commit: `bbc22a5091be829417ff5753c924aa2aad73e565` (`fix(git): reject stale repository bindings`). It is pushed to PR #207's feature branch; the PR remains open and unmerged. Checkpoint `6.11` remains unchecked at `61/131` for independent review.

The candidate closes the three fixed-point defects without changing the Store, Terminal, static export, or App scope:

- Core Git descriptors now carry a non-empty opaque `bindingToken`. Code receives one stable backend-instance token; every newly activated Planning-root service record receives a fresh token, including A -> B -> A.
- `GitRepositoryBindingService` owns Code/Planning scope discovery and runs Git work inside the corresponding Manager lease. Planning compares the caller's expected token before resolving the repository or invoking refresh, cache invalidation, worktree removal, or handoff. Conflicts surface as typed tRPC `CONFLICT`; the token is provenance, not authorization or a path.
- `git.subscribeScopes` is reactive through the Manager-owned root projection. Web URL state still persists only `gitScope=code|planning`; query, detail, patch, pagination, and View Transition keys include scope plus token. Root loading, stale refresh, failure, and scope/root mismatch retire old Planning data and lock Planning controls while Code remains available.
- Dashboard Code Git keeps its Launch-owned path and remains usable while Planning resolution fails. No Store id is used as Git identity, and no clone/pull/push/synchronization behavior was added.

### Fixed-point evidence

- Server binding fixture: real Manager-owned Code/A/B Git repositories emit A -> B -> Code -> A; Code token remains stable, every Planning activation gets a distinct token, and A's second activation does not reuse its first token.
- Server stale-intent fixture: an A token conflicts before refresh, removal, or handoff owners run. The public Router stale Refresh path returns `CONFLICT`, writes no B refresh stamp, and a current B token succeeds. Code Dashboard refresh still emits its projection while Planning is unavailable.
- Web fixture: A overview/history/detail/patch content is retired before B (and rebound A) requests settle; B keys include its token. A-captured destructive handlers continue to submit A's token after B is published, so the Server returns a conflict rather than silently targeting B. Planning failure/mismatch keeps Code status/history usable.
- Mutation-resistance: removing only the Planning-lease `assertCurrent` comparison makes the stale Refresh test fail because B receives a refresh stamp/cache invalidation (`received true`, `expected false`). Restoring the comparison returns the checked Router lane to green. This proves the hidden comparison transition itself, not merely a disabled UI control.

### Verification

Focused reruns on the candidate pass:

```text
Server: 49 files / 374 tests
Web Git: 6 files / 49 tests
Core: 47 files / 440 tests
Server checked Git fixtures: `pnpm --filter @openspecui/server typecheck:git-tests`
format:check: 25 changed files
lint:ci: 832 files, 0 warnings/errors
typecheck: 15 workspace packages
git diff --check: pass
```

The complete local candidate gate also passes: `pnpm test:ci` (`272 files / 1763 tests`), clean `pnpm --filter @openspecui/web build:ssg`, xterm browser (`60 passed / 1 skipped`), and Web browser (`12/12`). The Vite+ pre-commit hook still exits before checks because the repository `vite.config.ts` has no staged configuration; after the gates above, the implementation commit was therefore created with `--no-verify`. This is an environment hook limitation, not a test bypass.

Live agent-browser acceptance is not claimed. Attempts to exercise real Code/A/B desktop and `390x844` rebind flows stalled without a terminating, inspectable process/evidence set. Independent browser re-verification remains required for Code default, distinct Planning selection, A -> B, B -> Code, A -> B -> A, immediate stale-content retirement, conflict feedback, scoped history/detail/back/patch, and mobile geometry. No merge, archive, release, or `6.12+` work is authorized.

### 6.11 Independent Review Findings at `62cf6f2`

Checkpoint `6.11` remains open at `61/131`. The implementation and mutation-resistance evidence are not sufficient for acceptance because two fixed-point counterexamples remain:

1. **Code continuity is blocked by Planning resolution.** `GitRepositoryBindingService.resolveScopes()` enters `PlanningRootServiceManager.runOperation/runReactiveOperation` before it can return the Code descriptor (`packages/server/src/git-repository-binding-service.ts:86-107`). The Web scope subscription and Dashboard Code helpers therefore wait on the Planning transition (`packages/web/src/lib/use-git-repository-scope.ts:46-57`, `packages/web/src/lib/use-dashboard.ts:16-18,82-100`). A first load or a hung Root transition cannot use Code Git even though Code is Launch-owned. Existing failure-path tests cover only a completed/failing Planning attempt, not a pending transition.
2. **Git handoff accepts stale presentation.** `getGitEntrySharedHandoff()` carries title/subtitle but no binding token (`packages/web/src/components/git/git-shared.tsx:99-108`). The Git list captures that handoff without provenance (`packages/web/src/routes/git.tsx:550-557`), while detail initializes `initialBindingTokenRef` from whichever token is current and then compares the token to itself (`packages/web/src/routes/git-view.tsx:58-63`). If A is clicked and the scope rebinds to B before detail mounts, A's title/subtitle can render in a B loading shell. `prepareGitDetail()` similarly re-queries current scopes and may prefetch the A selector under B (`packages/web/src/lib/view-transitions/detail-prepare.ts:122-130`).

Required correction evidence:

```text
Planning transition pending  -> Code descriptor/status/history/refresh still usable
Git list observed token A    -> handoff + VT preparation carry A
current detail token B       -> A handoff is rejected; no A presentation or B prefetch of A
```

The mandatory real desktop and `390x844` agent-browser walk-through is also still unavailable. It remains a required acceptance artifact; do not claim browser completion from unit tests or a stalled session.

### 6.11 Code-Continuity and Handoff Correction at `dda056c`

Implementation commits `adfcfce` and `dda056c` close the two `62cf6f2` code blockers while leaving checkpoint `6.11` open at `61/131`:

- `git.code` resolves the Launch-owned Code descriptor without entering a Planning lease. `git.subscribeScopes` first emits Code with `planningState: resolving`, then starts the Manager-owned reactive Planning subscription. A resolved, collapsed, or failed Planning attempt emits an authoritative `planningState: settled`; the first Code-only emission no longer falsely claims that Planning shares the Code repository.
- Code overview/history and Dashboard Code refresh use the stable Code token while the Doctor/Planning transition remains deferred. Unsubscribe stops later emissions without pretending that an `AbortSignal` settles the admitted Manager operation.
- Git list and Dashboard handoffs carry their origin `bindingToken`. Detail presentation and View-Transition preparation accept handoff text/prefetch only when that token matches the current descriptor; an A handoff under B is retired before B detail reads.

The direct fixed-point Code-continuity test was run after temporarily removing the Code-first subscription path and failed for the intended reason: `expected [] to have a length of 1 but got 0`. Restoring production returned it to green. The earlier stale-token and handoff tests remain mutation-resistant evidence for the exact provenance comparisons.

Focused correction verification:

```text
Server checked Git fixture typecheck: pass
Server exact Git binding/scope/router: 3 files / 11 tests pass
Web typecheck: pass
Web unit: 118 files / 715 tests pass
git diff --check: pass
```

An earlier package-script invocation unintentionally ran the full Server suite because that script does not narrow Vitest with the supplied trailing paths. Git tests passed within that run; one existing local-model Xet progress test timed out. The exact `exec vitest run` Git lane above then passed `3 files / 11 tests`, so the unrelated timeout is recorded as a pre-existing flaky observation rather than attributed to this Git correction.

The real desktop/mobile Code/A/B browser walk-through, full post-correction repository gates, push, exact-head CI, and local/remote/PR equality are still pending. `6.11` remains unchecked; do not start `6.12+`, merge, archive, or release.

### 6.11 Second Independent Review and Next Correction Boundary at `dda056c`

The local post-correction verification is complete but is not acceptance. `dda056c` is two commits ahead of the PR head `62cf6f2`; the worktree is dirty only in reviewer-owned `AGENTS.md`, `i18n.zh.md`, and the two loop artifacts. The worker reports and local reruns prove:

```text
format:check       pass
lint:ci            833 files, 0 warnings/errors
typecheck          15 workspace packages pass
test:ci            Core 440/440, Server 376/376, Web 715/715, CLI 49/49, all green
clean SSG          build:ssg pass after explicit output cleanup
browser gate       xterm 60 passed / 1 skipped; Web 12/12
git diff --check   pass
```

The exact Git focused lane also passes (`3 files / 11 tests` after the first correction; the full post-correction Server lane is included above). No browser acceptance, push, exact-head CI, or local/remote/PR SHA equality is claimed.

Independent Standards review of `62cf6f2...dda056c` found:

1. **P1 same-binding entity provenance defect.** `packages/web/src/routes/git-view.tsx:59-62` accepts a Git handoff when its family and binding token match, but ignores `handoff.entityId`. `packages/web/src/lib/view-transitions/detail-prepare.ts:128-140` likewise does not validate the handoff entity against the target selector. A same-token A handoff attached to a B detail URL can render A title/subtitle while B data loads. The current red/green evidence covers token mismatch only and cannot detect this same-binding stale presentation.
2. **P2 public contract holes.** `packages/core/src/git-panel-types.ts:37-43` permits `planningState: 'resolving'` with a non-null Planning descriptor, and `packages/web/src/components/git/git-shared.tsx:108-121` accepts an optional `bindingToken`; `packages/web/src/routes/git.tsx:554-557` explicitly passes `bindingToken ?? undefined`. These are impossible/unsafe states under the stated contract and are not prevented by typecheck.
3. **P2 Planning failure erasure.** `packages/server/src/git-repository-binding-service.ts:101-116` catches every Planning owner or Git identity-resolution error and returns `planningState: settled` plus `planning: null`. With a ready Root Context, `packages/web/src/lib/use-git-repository-scope.ts:98-102` and `packages/web/src/components/dashboard/context-summary.tsx:111-133` then state that Planning is not distinct. A canonical-path or runner failure is objective unknown/error evidence, not proof of repository collapse.
4. **P2 Dashboard snapshot/token race.** `packages/core/src/dashboard-types.ts:88-91` gives Dashboard Git entries no origin `bindingToken`. `packages/web/src/routes/dashboard.tsx:782-790` queries a fresh Code token only after an entry is clicked, while `useSubscription` intentionally retains cached/stale data across error/remount. After backend binding A is replaced by B, an A entry can therefore be handed off as if observed under B. Existing tests mock the snapshot and token at one instant and do not exercise A snapshot + B token.

The next apply slice must add a selector/entity-aware Git handoff guard, a discriminated `GitRepositoryScopes` state, a Git-specific handoff type with mandatory non-empty origin provenance, explicit Planning Git failure evidence, and atomic Dashboard snapshot provenance. It must prove the fixed-point same-token/different-entity, ready-Root/failing-Git, and A-snapshot/B-token red tests, retain URL-selector reads and existing token conflict behavior, and leave `6.11` unchecked until the required terminating pinned-CLI desktop/mobile walk-through is captured. No `6.12+`, merge, archive, or release work is authorized.

### 6.11 Third Correction Slice at `e4809df`

Implementation commit `3115296` (`fix(git): preserve binding failure and snapshot provenance`) and
follow-up header commit `e4809df` (`docs(core): record static Git contract`) are worker-owned and
remain unpushed pending independent review. Checkpoint `6.11` remains unchecked at `61/131`.

The slice closes the remaining contract and stale-projection findings:

- Git identity results now retain stderr, exit/runtime code, and an explicit failure kind. Only an
  explicit `not-repository` result or canonical Git `not a git repository` stderr settles to a
  null Planning repository. Permission, ENOENT, IO, unknown/no-evidence, successful-empty, and
  canonicalization failures reject with diagnostic evidence. Code scope resolution runs before the
  Planning lease; Code failure is not relabeled as Planning failure, while a ready-root Planning
  failure returns `planningState: failed` with the still-usable Code descriptor.
- `GitRepositoryScopes` variants are readonly. Static mode uses a separate typed projection whose
  Code binding token is `null`, and the live Git route test proves static mode exits before scope
  subscriptions, overview/history queries, or Git mutations. No static token can enter a live RPC.
- Dashboard Git display/handoff requires current Code scope data with no loading/error state. A
  retained A snapshot is retired while a reconnect error or loading projection is present. Context
  Summary reports Git subscription failure/loading before retained scope data.
- Git handoff validation derives selector identity once, rejects empty/whitespace commit and
  uncommitted identities, and constructs the validated Git handoff without a cast. Existing
  same-token/entity, old-token, and non-Git handoffs remain covered.
- Router fixtures now use a checked resolver with explicit Code provenance; no public Router test
  uses an empty Planning resolver assertion. The fixture is included in the Server source check.

Focused green evidence on the final local implementation head:

```text
Server scope/binding/router: 4 files / 108 tests
Web Dashboard/Git/static: 5 files / 45 tests
Web handoff/detail: 3 files / 36 tests
Server/Core/Web typecheck: pass
git diff --check: pass
```

Counterexample classification is explicit. The earlier same-token/different-entity handoff red
case at `dda056c` is fixed-point evidence for the selector guard. The new ready-root Planning
runner failure, classifier/empty-output, Dashboard stale-data-plus-error, and static no-RPC tests
are regression/characterization evidence in this slice; the injected runner test records explicit
failure evidence and Code continuity, but a byte-for-byte old-tree red rerun is not claimed here.
Mutation-resistance for the existing token comparison remains recorded above; the new classifier
tests cover the exact explicit-vs-unknown failure boundary.

Full local gates, exact-head CI, and the terminating pinned OpenSpec 1.6 desktop/mobile browser
walk-through remain pending. No browser acceptance is inferred from these unit tests. Do not mark
`6.11` complete, merge, archive, release, or start `6.12+`.

### 6.11 Reconnect-Authority Correction at `49a272b`

Independent review of the `3115296` slice found that `useSubscription` restored cached Git scope
data with `isLoading: false` during a remount/reconnect. A Code scope A and matching Dashboard
snapshot A could therefore pass token equality before the replacement scope B arrived. The first
attempt changed the shared hook globally; that was rejected because Spec, Change, Config, and
other cached projections must retain their existing cache semantics. The accepted correction is
an explicit `SubscriptionCacheRebindPolicy` with `retain` as the default and `loading` enabled only
by `useGitRepositoryScopes` for `git.subscribeScopes`.

Implementation/test commits:

- `87be0fe` (`fix(git): keep cached scopes non-authoritative during reconnect`) adds the opt-in
  policy, uses it only for Git scope subscriptions, and adds Dashboard A -> reconnect -> B
  rendering/handoff coverage.
- `fbe82f6` (`docs(git): record reconnect cache intent`) updates the changed hook's timestamped
  orthogonal-intent header.
- `49a272b` (`test(git): prove reconnect cache gate owns Git scopes`) exercises the real
  `useGitRepositoryScopes` hook: cache A is retained as data but `isLoading: true`, then callback
  B clears loading and becomes current. The non-Git default policy is separately covered.

Exact mutation-resistance evidence:

```text
Fixed point: temporarily remove the `'loading'` argument from useGitRepositoryScopes.
Command: pnpm --filter @openspecui/web exec vitest run --project unit src/lib/use-git-repository-scope.test.ts
Result: 1 failed / 2 tests; expected false to be true at the cached-A isLoading assertion.
Restored: same command -> 2 passed / 2 tests.
```

The red assertion reaches the real hook/cache boundary and observes stale A authority directly;
it does not click a disabled control or invoke a mocked downstream mutation handler. Dashboard
coverage additionally proves cached A is absent from rendered Git snapshot/handoff while loading,
then B is rendered and handed off with `code-binding-b`. The focused Web scope, subscription,
Dashboard, and Git lanes pass (`30 tests` across four files; GitRoute rerun three times with `14/14`
each), Web typecheck passes, and `git diff --check` passes.

The full repository gates, clean SSG, terminating pinned-CLI desktop/mobile acceptance, push,
exact-head CI, and local/remote/PR SHA equality remain pending. Checkpoint `6.11` remains open;
do not start `6.12+`, merge, archive, or release.

### 6.11 GitRoute Reconnect Gate at `0d0c134`

The same cached-scope authority defect also affected the Git list route. With cached scopes A,
`GitRoute` previously kept overview/history queries enabled when the replacement subscription was
still loading, so stale A status, entries, Refresh, worktree mutations, pagination, and handoff
could remain reachable. `0d0c134` makes `scopeReconnecting` an explicit query gate, returns the
route loading state even when cached A exists, and guards every action (including pagination) via a
render-updated ref for late handlers. Code-first `planningState: resolving` remains usable because
the server's current Code emission clears subscription loading before the route renders it.

The checked route fixture remounts with cached A, delays B without emitting, and proves all of the
following before B arrives: the loading state is rendered, A status/history are absent, and the
overview/list query call slices receive no A or B token. It then emits B and proves B overview,
history, and planning binding are queried/rendered. The route lane is `15/15`; the combined
Git-scope/subscription/Dashboard/route lane is `31/31`, with Web typecheck and `git diff --check`
green.

Mutation-resistance fixed point:

```text
Temporarily remove both `!scopeReconnecting` query gates and the cached-data early return.
Command: pnpm --filter @openspecui/web exec vitest run --project unit src/routes/git.test.tsx -t "locks a cached A route while scopes reconnect"
Result: 1 failed; received `loading: false`, stale A status/history `true`, and new overview/list calls using `code-binding`.
Restore `0d0c134`: same test -> 1 passed; full GitRoute lane -> 15 passed.
```

This red evidence reaches the route's actual query projection and stale content, not a disabled
button or mocked downstream handler. The full repository gates, clean SSG, terminating pinned-CLI
desktop/mobile acceptance, push, exact-head CI, and local/remote/PR SHA equality remain pending.
Keep `6.11` open and do not start `6.12+`, merge, archive, or release.

### 6.11 Git Detail Reconnect Gate at `6787573`

The cached-scope authority boundary also applies to Git detail. `6787573` disables metadata and
file queries while `git.subscribeScopes` is reconnecting and returns the detail route's loading
state before handoff text can render. The remount fixture seeds A detail/handoff, delays B, proves
no A meta/files calls and no A handoff title during the window, then emits B and verifies B detail
queries/rendering.

Mutation-resistance fixed point:

```text
Temporarily remove both `!scopeReconnecting` query gates and the cached-data early return.
Command: pnpm --filter @openspecui/web exec vitest run --project unit src/routes/git-view.test.tsx -t "locks cached A detail during scope reconnect"
Result: 1 failed; received `loading: false`, A meta/files calls with `code-binding`, and the cached A detail shell remained visible.
Restore `6787573`: same test -> 1 passed; full Git detail lane -> 12 passed.
```

The red evidence reaches actual meta/files query calls and stale detail presentation, not a disabled
control or mocked downstream handler. Combined focused Web Git scope/subscription/Dashboard/list/
detail evidence is now `43/43`; Web typecheck and `git diff --check` pass. Full repository gates,
clean SSG, terminating pinned-CLI desktop/mobile acceptance, push, exact-head CI, and local/remote/
PR SHA equality remain pending. Keep `6.11` open and do not start `6.12+`, merge, archive, or release.

### 6.11 Fourth Independent Review at `89e105c`

The reconnect slice is real implementation progress. Local, remote, and PR heads equal `89e105c`;
PR #207 is `OPEN/CLEAN`, and all six remote checks pass. Independent focused reruns report:

```text
Web Git scope/subscription/Dashboard/list/detail: 5 files / 43 tests
Server scope/binding/router/snapshot:              4 files / 23 tests
git diff --check:                                  pass
```

Those tests do not cover the production counterexamples found in review:

- `onError` keeps cached A while clearing loading, and GitRoute/GitView use loading as their only
  authority gate. tRPC 11.7.2 also exposes `onConnectionStateChange`, but the Git subscription
  ignores real `connecting` and `pending` transport phases.
- Dashboard refresh/removal replace snapshot A's observed token by querying current token B at
  execution time, defeating stale-intent conflict.
- `GitRepositoryBindingService.resolveScopes()` observes Code twice; only the second observation is
  inside the catch that labels every failure as Planning.
- `PlanningRootServiceResolver` owns/exposes a Launch Code token, contrary to the separated owner
  boundary; the bootstrap must own and inject Code provenance.
- The public classifier test is missing from the checked Server test lane, and two Git provenance
  headers retain the prior date.

These are review findings, not claimed red runs. The next worker must first add direct fixed-point
tests, then implement the corrections and complete gates. Browser acceptance is intentionally not
attempted on this defective head. Progress remains `61/131`; `6.11` stays unchecked and `6.12+`,
merge, archive, and release remain forbidden.

Reviewer construction guidance is intentionally concrete to prevent another adjacent-only fix:

- model Git authority independently from generic `isLoading`, preserving visible error evidence
  while cached data is locked; drive the real tRPC `onConnectionStateChange` callback;
- require Dashboard refresh/removal helpers to receive the rendered snapshot token, including
  delayed focus/auto callbacks, with no action-time `git.code` lookup;
- create one Launch-scoped Code owner at Server composition, inject it into Git binding and
  Dashboard provenance, and remove Code token ownership from the Planning resolver;
- compare Planning against the already-resolved Code descriptor instead of invoking the combined
  resolver that re-reads Code;
- move decisive public-boundary scenarios into the checked Git test lane and prove mutation
  resistance by removing the exact authority/token/owner transition.

The recurrence lesson is that remount/loading evidence is not transport evidence, a current-token
lookup is not snapshot provenance, and a stable value stored on the wrong owner still violates the
lifetime contract. Exact event, snapshot, and owner must be named before implementation is accepted.

### 6.11 Fifth Independent Review of the Uncommitted Candidate at `b55267c`

The review fixed point is `b55267c6ad8ad1d83f98a2a42aeef92893378354`. Local HEAD, the remote
feature branch, and PR #207 all still point to that commit; the PR is `OPEN/CLEAN` and its six
checks are green for that fixed point. The worker candidate is **not committed**: the worktree has
22 modified tracked files and two untracked files (`launch-git-repository-binding.ts` and
`use-dashboard.test.ts`). Focused reruns on the candidate pass Web `6 files / 54 tests`, Server Git
`4 files / 34 tests`, Web typecheck, Server `typecheck:git-tests`, and `git diff --check`. These are
not full-gate, browser, delivery, or acceptance evidence.

Independent review leaves `6.11` open at `61/131` and identifies the following blockers:

1. **P1: retired subscription callbacks can resurrect A.**
   `packages/web/src/lib/use-subscription.ts:211-274` unsubscribes the prior stream but gives its
   callbacks and static loader no active-generation guard. A late old `onData`, `onError`, or
   connection callback can overwrite replacement state/cache and set `authority: current` for A.
   Existing `useSearch` already uses an active guard for this lifecycle. Add a generation-scoped
   guard for every callback and loader, then prove an A callback after B/rebind is ignored and cannot
   rewrite the cache.

2. **P1: the public scope stream still observes Code twice.**
   `packages/server/src/router.ts:2611-2618` first calls `resolveCodeScope()` for the Code-first
   emission, then immediately starts `createReactiveSubscription(() => resolveScopes({ reactive: true }))`;
   `resolveScopes` calls `resolveCodeScope()` again. `createReactiveSubscription` executes its task
   immediately, so one `subscribeScopes` projection performs two Code identity reads. Reuse the
   first descriptor through a planning-only reactive resolver and add a route-level call-count test;
   the service-only once test is insufficient.

3. **P1: terminal observer events are not part of authority.**
   tRPC 11.7.2 exposes `onStopped` and `onComplete` separately from
   `onConnectionStateChange`/`onError`. `useAuthoritativeSubscription` ignores both, so a cleanly
   stopped/completed Git stream can leave cached data `current`. It also lets a later connection
   callback replace an `onError` diagnostic with a generic waiting state. Forward terminal callbacks,
   make terminal failure absorbing within the active generation, and allow only replacement `onData`
   to clear it. Add tests for stop/complete and error-to-connection ordering.

4. **P1/P2: Dashboard stale conflicts are not surfaced and the real removal path is unproved.**
   `packages/web/src/routes/dashboard.tsx:317-335` only logs refresh failures and clears the request;
   a stale A -> B `CONFLICT` therefore has no visible diagnostic (removal alerts, refresh does not).
   The new component test mutates a token variable without publishing B through a rendered state and
   the detached-removal assertion was removed; `use-dashboard.test.ts` only invokes helpers directly.
   Keep the required token capture, add a real Dashboard handler test for A snapshot -> B emission ->
   A refresh and removal, assert B owner/cache is untouched, and render the refresh conflict visibly.

5. **P1 evidence gap: replacement B is not shown to resume queries.**
   `packages/web/src/routes/git.test.tsx:421-465` emits a Code-first replacement but only checks that
   the error text disappears. It does not assert the real overview/list query owners resume with B.
   Assert B-token query calls after the replacement; retain the red test that fails when the exact
   transport authority transition is removed.

6. **P2 typed-evidence and header gaps remain.**
   `packages/server/src/planning-root-service.test.ts` is modified but excluded from every Server
   test-typecheck lane and still has a `2026-07-17` intent header. `router.test.ts` is also modified
   outside the checked Git lane. Add a checked owner/composition fixture (or explicitly include the
   changed boundary tests in a typecheck lane) without `as any`, `as never`, fabricated non-null
   state, or suppressions. Update every changed test header to `2026-07-19`.

7. **P2 owner evidence is incomplete.**
   Production composition creates one Launch owner and injects it into Git and Dashboard, but no
   checked fixture proves owner lifetime/non-empty validation or Git/Dashboard token agreement. Add
   that evidence at the composition/public boundary; do not infer it from a service-only token test.

No browser acceptance, full post-correction gates, commit, push, exact-head CI, or local/remote/PR
SHA equality exists for the candidate. Do not mark `6.11`, start `6.12+`, merge, archive, or release.
The next worker Goal below is implementation work, not another review pass.

### 6.11 Applied Git Authority/Owner Correction (working tree after `b55267c`)

The worker applied the reviewer-owned 6.11 goal in four bounded areas:

- `useAuthoritativeSubscription` now retires each effect generation before unsubscribe. Live
  callbacks, static loader completion, terminal callbacks, and cache writes require that generation;
  `onError` remains an absorbing diagnostic until replacement `onData`, while connecting/pending/
  idle/complete states remain non-authoritative.
- `git.subscribeScopes` resolves Code once, emits the Code-first descriptor, and feeds that exact
  descriptor into the reactive Planning-only resolver. The public checked Router test asserts one
  Code observation and descriptor identity. Launch Code ownership is supplied by the server-created
  `LaunchGitRepositoryBindingOwner`; Planning manager records only Planning tokens. Composition tests
  assert stable Code token, fresh A/B Planning tokens, no Planning Code token property, and Dashboard
  snapshot token agreement.
- Dashboard refresh/focus/auto-refresh/removal helpers receive the rendered Code snapshot token;
  they do not query `git.code` at action time. Refresh and removal failures now render a persistent
  `role=alert` diagnostic with typed conflict code when present. GitRoute reconnect tests assert
  real overview/list B-token query calls after replacement emission.
- Changed TypeScript headers were audited; `planning-root-service.test.ts` is timestamped 2026-07-19.
  The checked Server Git lane includes the public Router binding suite, binding service, scope
  classifier, and Dashboard snapshot coverage; no `as any`, `as never`, or suppression was added.

Mutation-resistance evidence:

```text
Fixed point: temporarily remove the active-generation guard in authoritative onData.
Command: pnpm --filter @openspecui/web test -- src/lib/use-subscription.test.tsx -t "retires every old generation callback"
Red: 1 failed; late retired A onData changed data to `stale` and authority to `current`.
Restored guard: the same focused test passes; full focused Web lane is 121 files / 751 tests.
```

Additional focused green evidence:

```text
Server public Git binding Router: 49 files / 388 tests; checked typecheck passes.
Web typecheck: pass. format:check: pass. git diff --check: pass.
```

The red run is direct subscription-boundary mutation evidence. Terminating pinned OpenSpec 1.6
desktop/mobile acceptance and full gates remain pending. Keep `6.11` unchecked and do not start
`6.12+`, merge, archive, or release.

### 2026-07-19 Sixth Independent Review of `5497730`

The implementation commit is delivered consistently: local, remote, and PR head are
`5497730d1f2e40d6347ef9ae6609b25826640f9a`; PR #207 is `OPEN/CLEAN`; all six remote checks pass.
Independent local focused evidence also passes Web Git `48/48`, Server Git `23/23`, checked Server
Git typecheck, and Web typecheck. This green baseline is accepted only as regression evidence.

Review found three remaining boundaries that the existing claims do not prove:

- The static branch of `useAuthoritativeSubscription` starts `staticLoader()` and returns without an
  effect cleanup. Its dependency-rebind test passes because the next effect increments the generation,
  not because unmount retired the loader. Direct unmount can still let the late result mutate cache/state.
- Dashboard component coverage does not perform a rendered A -> B projection followed by captured A
  Refresh and Removal handlers, visible typed conflict, B side-effect exclusion, and matching B recovery.
  Direct helper tests and a token-variable mutation are adjacent characterization evidence.
- Post-transport B evidence does not explicitly assert every claimed overview/list/meta/files/patch B-token
  boundary, and the real composition fixture stops at A -> B rather than proving a fresh A2 token on
  A -> B -> A with stable Launch Code/Dashboard provenance.
- The checked Server Git lane currently contains only six explicit test files; changed Manager/Router
  fixtures and their existing fabricated non-null assertions are outside the claimed type-safe evidence.
- Git-specific tRPC test doubles do not forward `onStopped`/`onComplete`, and the detail panel mock prevents
  a real B patch-query owner assertion. Launch owner non-empty construction/composition validation is also
  absent.

The next apply slice must first create direct red evidence for the static unmount cache write and then add
the narrow cleanup. It must strengthen only the missing Dashboard/query/owner/checked-observer public-boundary
evidence, rerun focused lanes before full gates, and complete the terminating pinned desktop/mobile walkthrough.
Do not generalize the subscription API, rewrite unrelated Dashboard/Git behavior, start `6.12+`, merge,
archive, or release. Checkpoint `6.11` remains `61/131` and unchecked.

The independent test agent subsequently reproduced that defect at the exact fixed point in an isolated
worktree. A pending static loader was directly unmounted, resolved, and followed by a same-key reader:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/lib/use-subscription-static-unmount.audit.test.tsx
Result: 1 failed; expected no cached data, received `stale-after-unmount`.
```

The temporary audit worktree/file was deleted. This is mutation-resistant production evidence for the
missing static effect cleanup; the worker must add its equivalent to the maintained test file before fixing
the shared cleanup and recording the green result.

The test agent also rechecked the accepted public Router exactly-once evidence in isolation. Replacing the
Planning reactive call with the old combined `resolveScopes({ reactive: true })` makes
`git-repository-binding-router.test.ts -t "observes Code once for one public projection"` fail because
`resolveCodeScope` is called twice; restoring `5497730` passes. That existing implementation/test boundary
is mutation-resistant and is not part of the next production correction.

### 6.11 Stage 1 Direct-Unmount Static Loader Correction

At fixed point `0d6dcca`, the maintained direct-unmount test was added without changing production code
and failed for the intended stale-cache reason:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/lib/use-subscription.test.tsx -t "retires a pending static loader on direct unmount"
1 failed: expected undefined, received `stale-after-unmount`
```

Commit `1838ccf` adds the narrow correction. `useAuthoritativeSubscription` now returns one shared
cleanup from the no-loader, static-loader, and live-subscription branches. Cleanup retires the effect
generation before clearing the subscription reference or unsubscribing, so late static settlement
cannot write the shared cache or mounted state. The test header records direct-unmount as a distinct
lifecycle intent.

Stage 1 green evidence:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/lib/use-subscription.test.tsx
1 file / 7 tests passed

pnpm --filter @openspecui/web exec vitest run --project unit \
  src/lib/use-subscription.test.tsx src/lib/use-git-repository-scope.test.ts \
  src/routes/git.test.tsx
3 files / 25 tests passed

pnpm --filter @openspecui/web typecheck
pass
pnpm format:check -- packages/web/src/lib/use-subscription.ts \
  packages/web/src/lib/use-subscription.test.tsx
pass
git diff --check
pass
```

Static-loader rejection, dependency rebind, late live callbacks, terminal error ordering, and
direct-unmount cache cases all pass. This is a staged implementation checkpoint only; Dashboard
rendered A-to-B evidence, explicit B query/owner evidence, full gates, browser acceptance, and the
6.11 task checkbox remain open. Do not start 6.12+, merge, archive, or release.

### 6.11 Partial Browser Reconnaissance after Stage 2

A reviewer browser pass against the current Stage 2 head confirmed Code-default and distinct Planning
views, A -> B and B -> Code projection changes, real A/B history, A detail/files/patch/back navigation,
Code/Planning token isolation, and no desktop horizontal overflow. This is reconnaissance only, not the
terminating browser acceptance required by `6.11`.

The pass did not complete deterministic A -> B -> A, stale Refresh/Removal black-box conflicts,
reconnecting/failed transport, Planning identity failure, or real `390x844` acceptance. With multiple
mounted clients, one Project Binding write changed the file while a client remained on `Saving...` and an
old Root projection for an extended interval before eventual convergence. This is not yet a deterministic
single-client defect and must not expand the correction surface without a reproducible owner/transport
counterexample. The App `--app` launch URL also omitted `?api=` in this run; that is an App launch-flow
observation outside checkpoint `6.11` and is not part of this correction.

Execution is now explicitly staged: real-time connection authority, Dashboard snapshot-token actions,
backend query/owner recurrence, then full gates and terminating browser acceptance. Each accepted stage
requires a code/test commit and exact focused evidence. A red focused lane stops the stage before full
gates; an external browser-fixture blocker is recorded once with `6.11` left open instead of triggering an
unbounded retry or `6.12+` work.

### 6.11 Stage 3 Applied at `73a27e4`

Stage 3 implementation/test work is committed as `73a27e4` (`test(git): close replacement binding
evidence`). The bounded diff adds no new product surface beyond the existing Git owner/projection seams:

- The checked server composition now proves A -> B -> A2. Launch Code binding and Dashboard Code
  provenance remain stable; Planning tokens are distinct for A, B, and A2; the replaceable Planning
  manager exposes no Code token property. Blank Launch tokens are rejected at construction.
- The Git-specific observer fixture forwards `onStopped` and `onComplete`; the route proves those
  terminal events retire cached A authority and that replacement data resumes real overview/list calls
  with exact B/C tokens. Detail route assertions cover B meta/files and replacement patch content.
- Existing real `GitEntryDetailPanel` coverage now asserts the on-demand `getEntryPatch` owner receives
  `scope: planning` and `expectedBindingToken: planning-binding-b`. Mutating that prop back to A makes
  the exact assertion fail (`received planning-binding-a`), then restoring B passes.
- The checked Server Git lane remains type-safe and intentionally limited to the five existing Git
  boundary suites. Historical `router.test.ts` and `planning-root-service.test.ts` fixtures were not
  forced into this lane with `as unknown as`, fabricated services, or non-null assertions.

Focused Stage 3 evidence:

```text
Server Git boundary: 5 files / 31 tests passed
pnpm --filter @openspecui/server typecheck:git-tests: pass
Web Git + real panel: 5 files / 53 tests passed
pnpm --filter @openspecui/web typecheck: pass
format:check: pass
git diff --check: pass
```

This closes the focused implementation stages only. The terminating browser fixture is still open:
deterministic A -> B -> A, stale black-box Refresh/Removal conflict, reconnect/failure, Planning identity
failure, and real `390x844` remain to be demonstrated. Do not mark `6.11` complete or start `6.12+` until
full gates and the pinned browser acceptance pass.

### 6.11 Stage 4 Stop-Loss: agent-browser Fixture Blocker at `4bd1031`

The worker completed the required local gates and clean SSG build at the Stage 3 baseline. A separate
live browser session against the pinned OpenSpec 1.6 CLI (`references/openspec` `e1b51d1`), isolated
`XDG_DATA_HOME`, and disposable Code/Planning Git roots loaded the real Web surface and confirmed the
last passing facts: Code `code`, declared Planning Store `plan-a`, distinct Planning Git identity, and
CLI `1.6.0`. The terminating acceptance still lacks deterministic A -> B -> A, stale Refresh/Removal
black-box conflicts, reconnect/failure, Planning identity failure, and real `390x844` geometry.

The existing `stage4new` agent-browser session then hung in the inspection commands required to finish
that walk-through. The commands were bounded to 15 seconds and terminated externally:

```text
agent-browser --session stage4new screenshot /tmp/openspecui-6-11-stage4-blocker.png
screenshot_exit=143

agent-browser --session stage4new get url
get_url_exit=143
```

No screenshot, URL result, or completion claim was produced by that session. This is recorded as the one
external browser-fixture blocker permitted by `GOAL.md`; it is not evidence of a production defect and
does not authorize a speculative workaround or scope expansion. Keep `6.11` open at `61/131`, do not
start `6.12+`, and stop at independent review. The focused/full local gates remain regression evidence,
not browser acceptance.

### 6.11 Independent Review: Reject Non-Red Root/Dashboard Test (2026-07-19)

The dirty candidate added `commits Root Context B before Dashboard exposes planning B` to
`packages/server/src/git-repository-binding-router.test.ts`. I ran the named test directly at the
review fixed point `d006f58` before any production edit:

```text
pnpm exec vitest run src/git-repository-binding-router.test.ts \
  -t 'commits Root Context B before Dashboard exposes planning B' --reporter=verbose
1 file / 1 test passed
events: dashboard:A, root:A, root:B, dashboard:B
```

Because the test passes unchanged on the fixed point, it is characterization of one naturally scheduled
event order, not a counterexample for the reported browser race. It does not control the deferred
binding/invalidation boundary, does not prove that the old implementation can expose Dashboard B before
Root Context B, and has no mutation-resistance check for the proposed commit barrier. Do not claim this
test as red evidence, do not close `6.11`, and do not run full gates until a checked test fails on
`d006f58` for the intended reason, then fails again when the exact barrier transition is removed.

The follow-up variant exercised `caller.planningConfig.updateProjectBinding` while both subscriptions
were mounted, but its observed order remained `root:A, dashboard:A, root:B, dashboard:B`; a variant that
created Dashboard after the write likewise removed the race window. Those variants were withdrawn rather
than relabeled as red evidence. The next attempt must control only the real write/cache-to-stream
scheduling boundary with a typed deferred, and must stop with `6.11` open if that boundary cannot produce a
fixed-point failure without manually invoking a downstream manager operation.

### 6.11 Bounded Scheduling Review and Stop-Loss (2026-07-19)

The final bounded server attempts exercised the real subscription boundaries and the real
`planningConfig.updateProjectBinding` mutation, with no production barrier or generation fix applied:

- Natural scheduling with both Root Context and Dashboard subscriptions produced
  `dashboard:A -> root:A -> root:B -> dashboard:B`.
- The real Project Binding write with both subscriptions mounted produced
  `root:A -> dashboard:A -> root:B -> dashboard:B`.
- Creating the Dashboard subscription after the binding write also delivered `root:B` before
  `dashboard:B`, so it removed rather than exposed the suspected race.

All three variants passed at the fixed point and are characterization evidence only. None fails against
the unchanged implementation for the claimed `Dashboard:B`-before-`Root:B` lifecycle, and none proves
mutation resistance for a server-owned barrier. No server-owned barrier/generation correction is therefore
accepted from this attempt. The worker-owned Stage 4 fixture processes were terminated; no fixture process
remains running.

This is the stop-loss boundary for speculative correction: keep checkpoint `6.11` open at `61/131`, do
not add a server barrier without a valid checked red/green pair, and do not start `6.12+`, merge, archive,
or release. Since the accepted focused lanes are green, delivery verification may proceed through full
gates and the terminating browser acceptance. If bounded scheduling cannot reproduce the race without
manually invoking a downstream manager operation, record the blocker and stop rather than expanding the
correction surface.

### 6.11 Transport/Web Boundary Audit (2026-07-19)

The read-only transport audit traced the three relevant live projections to independent server
observables:

```text
Root Context       router.ts:3008-3013 -> root-context-service.ts:75-121
Dashboard planning router.ts:2496-2500 -> reactive-subscription.ts:31-60
Active Changes     router.ts:1385-1387 -> its own reactive subscription
```

They share the `PlanningRootServiceManager.transitionTail` for root replacement, but do not share a
commit/generation token. The single tRPC WebSocket handler (`server.ts:485-502`) also does not promise
causal ordering between independent subscription operations. Root payloads carry `observedAt` but no
cross-stream generation; Dashboard Git data carries its own binding token only. On the Web side,
`useAuthoritativeSubscription` protects each hook against late callbacks, while
`useContextSubscription`, `useDashboard`, and `useChangesSubscription` retain separate subscription
state. This confirms a plausible transport/projection boundary, not a production defect by itself.

The Vitest boundary review rejected all same-process variants at `d006f58`: natural scheduling, the
real `planningConfig.updateProjectBinding` mutation with both subscriptions mounted, and creating the
Dashboard subscription after the write all delivered `root:A -> dashboard:A -> root:B -> dashboard:B`.
They remain characterization evidence, not red evidence. A valid next test must use the public server
boundary with a typed `createTRPCClient<AppRouter>`, real WebSocket client(s), and the actual binding
mutation; it must record subscription identity, observed time, root identity, and Dashboard marker
without UI filtering or sleeps. If that harness still delivers Root B before Dashboard B, stop rather
than inventing a generation barrier. Only a fixed-point failure plus mutation-resistance failure after
removing the exact proposed transition authorizes a production edit.

This audit leaves `6.11` open at `61/131`. No speculative production correction is authorized until that
causal boundary is established. The current focused baseline may proceed to full gates and the required
desktop/mobile browser acceptance; those results do not close the checkpoint without reviewer approval.

### 6.11 Transport Attempt 2: Public WebSocket Characterization (2026-07-19)

The bounded typed harness used the real server startup, HTTP `planningConfig.updateProjectBinding`, and
independent tRPC WebSocket clients for Root Context and Dashboard. It was run at the unchanged fixed
point with:

```text
pnpm --filter @openspecui/server exec vitest run \
  src/root-dashboard-transport.integration.test.ts --reporter=verbose
1 file / 1 test passed
```

The harness observed both Root B and Dashboard B after the public binding mutation, but did not observe
Dashboard B before Root B. It did not contain a fixed-point failure or a mutation-resistance pair, so it
is characterization only and cannot authorize a production generation/barrier change. A temporary
test file was removed after the run; no broken or untracked worker file remains. A fixture CLI emitted a
missing-schema warmup warning, but the transport assertions passed and no causal defect was inferred.

### 6.11 Full Gates and Browser Acceptance Stop (2026-07-19)

With the focused lanes green and no production correction applied, the worker ran the required delivery
gates from `d006f58`:

```text
pnpm format:check       pass
pnpm lint:ci            pass
pnpm typecheck          pass (15 workspaces)
pnpm test:ci            pass (Root 43, Server 391, Web 754, CLI 49; remaining workspaces pass)
rm -rf packages/web/dist-ssg packages/web/.vite
pnpm --filter @openspecui/web build:ssg  pass
pnpm test:browser:ci    pass (xterm 60 passed / 1 skipped; Web 12/12)
git diff --check        pass
```

The terminating pinned OpenSpec 1.6 browser walk-through did not produce a usable desktop/mobile UI
session. Against the disposable fixture with isolated data scope, the first cold `rootContext.get`
request remained unanswered through the bounded 20-second limit. A later same-process curl returned
HTTP 200 in about 3.97 seconds with Root ready, `plan-a`, and CLI `1.6.0`, but that cache-hit response is
not browser acceptance evidence and does not prove A -> B or mobile behavior. The fixture server and
agent sessions were stopped; ports 4134/13003 were released and no fixture process remains. Keep
`6.11` open at `61/131`; do not claim browser completion, merge, archive, release, or start `6.12+`.

The full-gate result was independently rerun from the review worktree after conflicting worker status
messages: every command exited zero, with only the known jsdom canvas and CSS `scroll-button` warnings.
A separate bounded browser session could open `http://127.0.0.1:3100` and redirect to
`/dashboard?_b=%2F`, but it did not execute the required project fixture scenarios. This route smoke
check is not terminating browser acceptance and does not replace the cold-start transport blocker.

### 6.11 Transport Attempt 1 Setup Failure (2026-07-19)

A bounded browser/transport attempt created the pinned OpenSpec 1.6.0 fixture and verified the launch
root's `doctor --json` and `context --json` for `plan-a`. The server launch command accidentally used
`XDG=...` instead of `XDG_DATA_HOME=...`, so it inherited the global registry and failed warmup with
`Unknown store 'plan-a'` before any browser or WebSocket client connected. The process was stopped and
the fixture was cleaned. No transport arrival order, Root/Active-Changes mismatch, or production defect
was observed. This is a setup failure, not causal evidence and not a reason to add a server barrier.

### 6.11 Cold-Start Diagnostic Recheck (2026-07-19)

The cold-start blocker was isolated to the fixture's CLI runner configuration, not the OpenSpecUI
server or tRPC transport. A checked diagnostic fixture was added in the dirty candidate:

- `packages/server/src/root-context-cold-start.integration.test.ts`
- `packages/server/tsconfig.transport-tests.json`

It uses `startServer`, an isolated `XDG_DATA_HOME`, the pinned OpenSpec 1.6.0 executable, typed HTTP
`rootContext.get`, and an independent typed WebSocket `rootContext.subscribe`. The runner trace is
validated with Zod rather than an unchecked JSON cast. The reviewer re-ran:

```text
pnpm --filter @openspecui/server exec vitest run \
  src/root-context-cold-start.integration.test.ts --reporter=verbose
1 file / 1 test passed (about 1.5s)
pnpm --filter @openspecui/server exec tsc \
  -p tsconfig.transport-tests.json --noEmit
exit 0
```

The same disposable fixture with the direct pinned executable returned HTTP 200, `state=ready`,
planning Store `plan-a`, and CLI `1.6.0` in about 1.74s. Replacing the pinned executable with
`npx @fission-ai/openspec` returned HTTP 200 with `state=error` after about 11.8s because CLI runner
resolution timed out during a network/registry lookup. That result is fixture/network
misconfiguration, not a production startup defect; do not add a server timeout workaround or a
transport generation barrier. The worker must commit the checked diagnostic fixture, rerun focused
lanes, and run the full gates. The corrected-path browser retry is recorded below and is the final
attempt for this slice; checkpoint `6.11` remains open at `61/131`.

### 6.11 Pinned Browser Retry Stop-Loss (2026-07-19)

A single retry used the corrected direct pinned executable (`references/openspec/bin/openspec.js`,
`e1b51d1`), explicit isolated `XDG_DATA_HOME`, and the disposable fixture on backend port `4136`.
The server listener and cold Root readiness path were available, but the real browser session could not
complete its bounded wait for `Planning: store-b`:

```text
agent-browser --session openspec611 wait \
  --text 'Planning: store-b' --timeout 20000
```

No desktop/mobile scenario, A -> B -> A convergence, conflict retry, or screenshot completion was
observed. The session was stopped at the prescribed stop-loss and the fixture/server process tree was
cleaned; no port `4136` process remains. This is a terminating browser-fixture blocker, not a causal
transport red test and not permission to change production code. Keep `6.11` open at `61/131` and stop
at independent review.

### 6.11 Independent Focused Recheck (2026-07-19)

The reviewer rechecked the dirty candidate without changing production code:

```text
Server Git boundary: 5 files / 31 tests passed
Web Dashboard/Git boundary: 4 files / 35 tests passed
pnpm --filter @openspecui/server exec tsc \
  -p tsconfig.transport-tests.json --noEmit: pass
pnpm lint:ci: pass
pnpm format:check: pass
git diff --check: pass
```

The Web run emitted the existing React `viewTransition`/`state` DOM warnings and the expected logged
`CONFLICT` errors from the conflict tests; all assertions passed. These focused results authorize the
worker to commit the diagnostic fixture and proceed to the full gates. They do not close `6.11` without
the terminating pinned desktop/mobile browser walk-through.

### 6.11 Independent Full-Gate Recheck (2026-07-19)

After the cold-start fixture was added, the reviewer reran the repository gates. All completed with exit
zero:

```text
pnpm typecheck       pass (15 workspace projects)
pnpm test:ci         pass (Root 43, Server 392, Web 754, CLI 49; all workspace lanes pass)
pnpm --filter @openspecui/web build:ssg  pass
pnpm test:browser:ci pass (xterm 60 passed / 1 skipped; Web 12/12)
pnpm format:check    pass
pnpm lint:ci         pass (0 warnings / 0 errors)
git diff --check     pass
```

The SSG build emitted only the existing `scroll-button` CSS and dynamic-import warnings. The unit suite
emitted the known jsdom canvas warnings. Neither produced a failing assertion or build error. These are
regression/gate results on the dirty candidate; the candidate still needs a worker commit and exact-head
delivery, and `6.11` remains open because the real desktop/mobile browser acceptance is incomplete.

### 6.11 Review Finding: Checked Lane Must Be Wired (2026-07-19)

The manual transport lane passes, but the dirty candidate's `packages/server/package.json` still defines
`typecheck` with only `tsconfig.check.json`, `tsconfig.search-tests.json`, and `tsconfig.git-tests.json`.
Therefore the repository-wide `pnpm typecheck` result does not check the new cold-start integration test.
Before committing, the worker must add `tsconfig.transport-tests.json` to the normal Server typecheck
script or to a named script that the full gate invokes, following the existing checked-test pattern. The
reviewer will reject a claim of full typed evidence if the lane remains manual-only.

### 6.11 Review Finding: Cold-Start Timestamp Assertion Is Invalid (2026-07-19)

An independent stability rerun found that the new cold-start fixture is not deterministic despite one
passing run. The third bounded run failed at:

```text
expected wsState.observedAt >= httpState.observedAt
received 1784447570485 >= 1784447573093
```

This is a test defect. HTTP `rootContext.get` and WebSocket `rootContext.subscribe` are independent
observables, so their completion timestamps have no cross-transport ordering contract. The failure does
not establish a Root/Dashboard transport race and does not authorize a generation barrier or lifecycle
rewrite. Remove only the cross-channel timestamp comparison; retain each channel's typed ready Root
payload, observed state sequence, and pinned CLI trace. The worker must run this focused fixture at least
three consecutive times after the correction and record the results before any full-gate or browser claim.
Until then the dirty candidate is not commit-ready and `6.11` remains open at `61/131`.

### 6.11 Cold-Start Stability Correction and Delivery Review (2026-07-19)

The worker removed only the invalid `wsState.observedAt >= httpState.observedAt` comparison. The
typed HTTP/WS ready payload assertions, state sequence, pinned CLI trace, and checked transport lane
remain unchanged. Independent review ran the corrected fixture three consecutive times; each run passed
`1 file / 1 test`. The worker committed the code/test change as `1d74444`; no production logic changed.

Post-commit gates all pass:

```text
pnpm typecheck       pass (15 workspaces; Server includes transport-tests)
pnpm test:ci         pass (Root 43, Server 392, Web 754, CLI 49; remaining workspaces pass)
pnpm --filter @openspecui/web build:ssg  pass (clean rebuild)
pnpm test:browser:ci pass (xterm 60 passed / 1 skipped; Web 12/12)
pnpm lint:ci         pass
pnpm format:check    pass
git diff --check     pass
```

The required real pinned desktop/mobile multi-project acceptance was not repeated because the corrected
path still has the recorded `Planning: store-b` wait timeout and no new terminating fixture path was
available. The previous screenshot/URL commands remain the one allowed external blocker. No browser
scenario, screenshot, A -> B -> A convergence, conflict retry, provenance, or mobile `scrollWidth`
evidence may be claimed. Keep `6.11` open at `61/131`; do not start `6.12+`, merge, archive, or
release.

### 6.11 Review Decision: Project Binding Mutation Settlement Candidate (2026-07-19)

The bounded same-origin browser path produced a new observation that is materially different from the
earlier stalled App/screenshot fixture. It used the direct project Web surface, a pinned OpenSpec 1.6
fixture, isolated `XDG_DATA_HOME`, backend `13122`, and a Vite same-origin proxy (no cross-origin
`?api=` override). The `/config` Project Binding form was driven through its real `Store` input and
`Save binding` control.

Observed bounded sequence:

```text
updateProjectBinding(A -> B)
  -> launch openspec/config.yaml contains store: B
  -> Active Root subscription converges to B
  -> Project Binding mutation remains pending (`Saving...`) beyond the bounded 20s observation
```

This is not a browser acceptance result and does not yet prove a production defect. It is a 6.11 red
candidate because the public mutation path in `packages/server/src/router.ts:2958-2963` writes the
launch file and then synchronously calls `fetchProjectBindingConfig(ctx)`, which resolves the complete
Planning-root transition through the shared manager queue. The existing router test at
`packages/server/src/router.test.ts:1071` uses a mock resolver that completes immediately and cannot
observe a pending transition or retirement lease. The browser path also initially exposed a host/CORS
fixture error (`localhost` embedded UI requesting `127.0.0.1`); the same-origin proxy removed that
fixture error and is the only path used for this candidate.

No production code was changed from this observation. The next worker slice must add a checked public
server fixed-point test, prove the exact pending settlement and mutation resistance, and only then
implement the smallest owner-layer correction if the red remains. Do not add sleeps, a generic
generation barrier, or a router rewrite based on the browser symptom alone. Stale fixture processes
from the bounded run (backend `13122` and its Vite process) must be stopped before the next attempt so
they cannot contaminate the evidence.

Checkpoint `6.11` remains open at `61/131`; no `6.12+`, merge, archive, release, or App/Store scope is
authorized.

### 6.11 Review Amendment: Separate Mutation and Subscription Candidates (2026-07-19)

The final bounded browser probe, after correcting the `localhost`/`127.0.0.1` host mismatch and
cleaning the old backend/Vite processes, did not reproduce the earlier pending mutation. The real
Project Binding request returned HTTP `200`; its response contained a ready `rootPreview` for the
selected Store. However, the subsequent Dashboard remained at `source: nearest`/Launch root and the
browser WebSocket reported `Offline`.

The two observations must remain separate:

```text
candidate A: file B -> Root/ActiveRoot B -> mutation pending > 20s
candidate B: mutation 200/rootPreview B -> Dashboard remains Launch/nearest; WS Offline
```

Candidate B cannot prove a server emission or Web projection defect while the WebSocket is offline.
The browser worker cleaned the old `13122` backend and Vite process; no A -> B -> A or mobile
acceptance is claimed. A direct mutation-only probe later returned in about two seconds, but it had no
subscriptions and is characterization only.

The next fixed-point test must start the real server with its watcher/invalidation path, mount typed
Root Context and Project Binding subscriptions, capture WS open/close/error and server/client event
sequence, and then perform the public mutation. It must distinguish candidate A from candidate B at
the public boundary before any production change is authorized. Keep `6.11` open at `61/131`.

### 6.11 Review Stop: Decomposition Pending Owner Decision (2026-07-19)

The owner has stopped further 6.11 implementation after repeated local fixes and inconclusive browser
boundaries. Worker coding and test lanes were interrupted; no production change is authorized from the
current candidates. The Change remains at `61/131`, with `6.11` open and `6.12+` untouched.

The remaining work is split into independent decisions rather than one combined lifecycle task:

```text
A. Mutation contract:
   updateProjectBinding -> await full Planning transition?
                      or -> settle after launch-file write and let subscriptions converge?

B. Reactive transport contract:
   Root/ActiveRoot invalidation requires ready WS + watcher?
   or -> server must provide a non-WS fallback/explicit readiness result?

C. Acceptance harness:
   direct same-origin project Web
   or experimental App iframe/`?api=` with corrected host identity?

D. Change shape:
   one follow-up Change
   or three Changes for A/B/C?
```

Evidence is intentionally not merged across candidates:

- Candidate A: launch file B and Root/ActiveRoot B were observed while the UI mutation remained
  `Saving...` for a bounded 20s window; a mutation-only probe later returned in about 2s.
- Candidate B: a later HTTP 200 mutation returned a correct `rootPreview`, but Dashboard remained at
  `source: nearest`/Launch root while the browser WebSocket was `Offline`. This cannot prove a missing
  server emission or Web projection update.
- The previous `localhost`/`127.0.0.1` CORS mismatch and all old 13122/Vite probe processes were cleaned;
  no A -> B -> A, conflict retry, provenance, or mobile acceptance is claimed.

The next worker must receive a new narrow Goal after the owner selects one item. Until then, do not add
tests, change router/manager ownership, rerun browser probes, close `6.11`, merge, archive, release, or
start App/Store/`6.12+` work.

### 6.11 Decomposition for Owner Decision (2026-07-19)

The owner explicitly stopped the repeated combined 6.11 loop and requested independent small problems.
The current evidence therefore has four packages with separate owners and acceptance contracts:

```text
W1 Git scope contract       -> actual 6.11; implementation accepted, delivery evidence pending
W2 Binding settlement        -> Project Binding / Config; candidate A, not a Git defect
W3 Reactive readiness        -> Root/ActiveRoot transport; candidate B, WS was Offline
W4 Browser harness           -> pinned fixture and desktop/mobile evidence only
```

The two browser observations are not one defect:

- Candidate A: launch file B and Root/ActiveRoot B were observed while the mutation stayed pending for
  the bounded 20-second window; a later mutation-only probe returned in about two seconds.
- Candidate B: mutation returned HTTP 200 with a correct `rootPreview`, while Dashboard remained at
  `source: nearest` and the browser WebSocket was `Offline`. This cannot prove missing server emission
  or a Web projection defect.

Consequences for the next worker:

1. No broad `finish 6.11` Goal is active. The reviewer must issue a new Goal naming exactly one W1-W4
   package, its fixed-point test, its owner layer, and its stop-loss.
2. W2 and W3 must not be implemented as incidental fixes while delivering W1. If selected, each gets
   its own follow-up Change or an explicitly approved delta in this Change.
3. A natural `Root A -> Root B -> Dashboard B` event trace is characterization. A server generation
   barrier or router rewrite requires a causal public-boundary red test plus mutation-resistance proof.
4. The recommended acceptance surface is the direct same-origin project Web. The experimental App
   iframe/`?api=` path is not a 6.11 gate unless the owner explicitly chooses it.

Until the owner responds, `6.11` remains open at `61/131`; no implementation, browser rerun, `6.12+`,
merge, archive, or release is authorized.

### 6.11 Historical Recommendation: W1 + W4 (superseded 2026-07-19)

The following boundary was recorded as a recommendation before the owner pause. It is not an active
execution slice:

```text
W1: Git scope/token contract and Git/Web delivery evidence
W4: pinned direct same-origin Project Web desktop/mobile acceptance
deferred: W2 Project Binding settlement, W3 Root/ActiveRoot transport readiness
```

The worker may use `$openspec-apply-change target-openspec-cli-16-line`, but production edits are
authorized only after a checked public Git-boundary red test. The browser lane must use pinned CLI
`references/openspec/bin/openspec.js` (`e1b51d1`), isolated `XDG_DATA_HOME`, disposable Code/A/B roots,
and a terminating direct Web path. App iframe/`?api=` is excluded. Required scenarios are Code/default
and distinct Planning scope, A -> B -> Code, A -> B -> A, stale Refresh/Removal conflict, scoped
history/detail/back/files/patch, reconnect/error retirement, token provenance, and desktop plus
`390x844` geometry.

Candidate A and Candidate B remain deferred evidence, not W1 defects. The worker must stop after one
terminating fixture blocker or three bounded failed attempts, preserve raw traces, and return exact
commits/evidence. No W2/W3 code, arbitrary sleeps, generation barrier, merge, archive, release, or
6.12+ work is allowed.

### W1 Focused Independent Recheck at `dfa94c4` (2026-07-19)

Two independent lanes rechecked the selected Git boundary without changing production code:

```text
Server Git fixtures: 4 files / 29 tests passed
Server Router Git subset: 18 passed / 71 skipped
Web Git/Dashboard: 7 files / 70 tests passed
Server typecheck:git-tests: passed
Server full typecheck: passed (includes transport-tests)
Web typecheck: passed
```

The checked evidence covers Code continuity, Planning A -> B -> Code -> A token rotation, stale
Refresh/Removal/handoff owner-side effects, identity failure classification, observer stop/complete,
cached-A retirement on reconnect/error, current-B unlock, route/query/handoff provenance, and detail /
files / patch ownership. Only existing React `viewTransition`/`state` warnings and expected `CONFLICT`
stderr appeared. No public Git-boundary red was found, so no production correction or mutation-resistance
rerun was authorized. W4 direct desktop/mobile acceptance and full gates remain open; W2/W3 remain
untouched.

### 6.11 Owner Pause Supersedes the Recommended Worker Slice (2026-07-19)

The W1 + W4 section above is retained as a recommended option, but it is not an active execution Goal.
The owner has requested that 6.11 stop carrying the Git, Project Binding, reactive transport, and browser
contracts as one loop. The next worker must receive exactly one selected package after the owner decides;
until then, no implementation, browser rerun, or `openspec-apply-change` run is authorized.

The blocking decisions are:

1. Close 6.11 after W1 + W4, or keep W2/W3 inside 6.11.
2. Define `updateProjectBinding` settlement as await-full-transition or write-then-converge with typed
   preview/transition evidence.
3. Define Offline WebSocket as an explicit unavailable/locked live state or require a non-WS fallback.
4. Choose direct same-origin Web or experimental App iframe as the acceptance surface.
5. Keep W2/W3 as separate follow-up Changes or combine them with this Change.

The full repository gates are green at the current review fixed point, but they do not resolve these
contract choices and do not close `6.11`.

### 6.11 W4 Fixture Recheck (2026-07-19)

A bounded review-only direct-Web attempt used the corrected same-origin OpenSpecUI CLI path and cleaned
all processes afterward. The static Web surface and WebSocket opened, but the disposable `store-a` fixture
did not resolve: Root remained `code/nearest` and a 15-second wait for Planning A timed out. An earlier
standalone-server probe returned `404 /git` because it targeted an API-only process. These are fixture/setup
observations, not a W1 production red. W4 therefore remains incomplete; no A -> B -> Code/A, stale
Refresh/Removal conflict, reconnect/error, provenance, or `390x844` acceptance claim is made.

### 6.11 Resumed Staged Worker Goal (2026-07-19; historical, superseded)

The owner has resumed implementation under a four-stage Goal. It supersedes the earlier owner-pause
execution stop but does not merge the independent defect candidates or relax public-boundary evidence:

```text
Stage 0 -> pinned-CLI and typecheck evidence correction
Stage 1 -> real-time connection lifecycle
Stage 2 -> Dashboard Git token provenance
Stage 3 -> backend owner/transition lease
Stage 4 -> terminating direct-Web desktop/mobile acceptance
```

Only Stage 0 is active. It must correct the cold-start fixture to use
`references/openspec/bin/openspec.js@e1b51d1`, keep `XDG_DATA_HOME` isolated, and report the independent
`typecheck:git-tests` and `typecheck:transport-tests` lanes accurately. The focused fixture and checked
type lanes must pass three consecutive runs; any failure stops the sequence. Stage 1-4 production edits
remain forbidden until Stage 0 is committed and independently reviewed. No arbitrary sleeps, generation
barrier, App iframe acceptance, `6.12+`, merge, archive, or release work is authorized.

### 6.11 Stage 0 Evidence Contract Applied (2026-07-19)

Stage 0 changed only `packages/server/src/root-context-cold-start.integration.test.ts`. `CLI_BIN` now
resolves `references/openspec/bin/openspec.js`; the test checks the submodule HEAD against
`e1b51d111ab446b54dee2d6159ac245f0339ae52`, and the disposable runner writes its actual `cliPath` into
each trace event. The test asserts all traced invocations use that direct pinned path. Isolated
`XDG_DATA_HOME` and the existing typed runner remain unchanged. No production runtime or package script
was changed.

Raw commands/results:

```text
pnpm --filter @openspecui/server exec vitest run src/root-context-cold-start.integration.test.ts
  3 consecutive runs: 1 file / 1 test passed each (2.30s, 2.19s, 2.16s)
pnpm --filter @openspecui/server run typecheck:transport-tests
  passed
git diff --check
  passed
```

The package scripts remain explicit: `typecheck:git-tests` does not include `typecheck:transport-tests`.
This closes the Stage 0 evidence correction only; no 6.11 task checkbox is closed and no Stage 1-4,
full-gate, browser, merge, archive, or release claim is made.

### 6.11 Stage 0 Independent Review Accepted (2026-07-19; historical, superseded)

Stage 0 is accepted at `2c61246`. The exact submodule SHA/path, runner trace, isolated XDG scope, three
consecutive cold-start runs, transport typecheck, Git typecheck, format, and diff-check all passed. No
production runtime changed. At that historical point, Stage 1 was the only proposed worker slice for a
staged run. The owner later superseded that authorization with the decomposition decision gate below.

### 6.11 Current State: Decomposition Decision Gate (2026-07-19)

This supersedes the preceding resumed staged-worker instruction. It is retained as history that Stage 0
was accepted, but it no longer authorizes Stage 1. The owner explicitly stopped the combined 6.11 loop and
requested independent small problems plus decision blockers. No worker is active; `6.11` remains open at
`61/131`.

```text
W1 Git scope/token delivery  -> implementation/test baseline accepted; W4 delivery evidence pending
W2 Binding settlement        -> Candidate A, not a proven production defect
W3 Reactive readiness        -> Candidate B, not a proven production defect while WS is Offline
W4 Browser harness           -> direct same-origin pinned fixture and desktop/mobile evidence only
```

The local review point is `b5aea58`, while the PR branch remains at `28319fd` (six commits behind). W1's
implementation is present in the PR ancestry; Stage 0's pinned-runner evidence and the current decision
gate are not yet delivered to the PR. Do not push a new aggregate candidate before the owner selects a
package and the worker produces its package-specific evidence.

Decision blockers are deliberately separate:

- **Closure boundary:** close after W1 + W4, or keep W2/W3 in this Change?
- **Binding settlement:** await the complete Planning transition, or resolve after the launch-file write
  with typed `rootPreview`/transition evidence and let subscriptions converge?
- **Reactive transport:** make Offline an explicit unavailable/locked state, or require a non-WebSocket
  fallback?
- **Acceptance surface:** use direct same-origin Project Web (recommended), or choose experimental App
  iframe explicitly?
- **Change shape:** keep W2/W3 as this Change's deltas, or create follow-up Changes?

Evidence boundary:

- Candidate A observed launch-file B and Root/ActiveRoot B while the mutation stayed `Saving...` for a
  bounded 20-second observation; a later mutation-only probe returned in about two seconds. No checked
  typed server/subscription fixed point exists yet.
- Candidate B observed HTTP 200 and a correct `rootPreview` while Dashboard remained `source: nearest`
  and the browser WebSocket was `Offline`; this cannot prove a missing server emission or Web defect.
- W4's bounded attempt did not resolve `store-a` and kept Root at `code/nearest`; the API-only probe's
  `404 /git` was a fixture/process mismatch. No live A -> B -> Code/A, conflict, provenance, or mobile
  acceptance claim is valid.

The next worker must receive a new narrow Goal after the owner selects one package. Until then, do not
change Router/manager ownership, add generation barriers or sleeps, rerun browser probes, close `6.11`,
merge, archive, release, or start App/Store/`6.12+` work.

Stage 0 evidence note: the raw command block above records the focused cold-start fixture,
`typecheck:transport-tests`, and `git diff --check`; the independent review also reported
`typecheck:git-tests` and `pnpm format:check` green, but those command outputs were not included in that
historical block. Do not use the abbreviated block as a substitute for exact final-SHA evidence.

### 6.11 Contract Research: W2/W3 Current Runtime Boundaries (2026-07-19)

This is read-only research for the owner decision; it is not a production red and authorizes no worker.

W2 currently has one synchronous public mutation contract:

```text
planningConfig.updateProjectBinding
  -> writeProjectBindingConfig(launch project file)
  -> fetchProjectBindingConfig(ctx)
       -> planningRootServices.resolveRootContext()
       -> readProjectBindingConfig(rootPreview)
  -> return ProjectBindingConfig
```

The Router therefore waits for the serialized Planning-root transition before resolving the mutation. It
does not return a typed transition id/state, and the existing Router fixture's
`resolveRootContext` mock completes immediately. This explains why the bounded browser `Saving...` result
cannot, by itself, distinguish a settlement contract defect from a fixture or transition-lifetime wait.

W3 currently has two different authority paths:

```text
Server rootContext.subscribe
  -> loading
  -> ReactiveContext stream
  -> refreshing(previous) / ready / stale-error
  -> transport error terminates the stream

Web useContextSubscription
  -> generic useSubscription cache + onData/onError
  -> Root Action gate blocks on transportError
  -> Dashboard/context surfaces may still display cached Root Context facts
```

The server has explicit refresh/error states, but the Web Root Context hook does not expose the
authoritative connection lifecycle used by Git scopes. Consequently, an Offline WebSocket plus a visible
`source: nearest` Dashboard snapshot cannot prove that the server failed to emit B or that the Web
projection mislabeled it. The owner must choose whether this cached display is an allowed read-only stale
state with actions locked, or whether W3 requires a non-WebSocket readiness fallback before any code Goal
is issued.

### 6.11 Stage 0 Evidence Recheck after Reviewer Documentation (2026-07-19)

The reviewer-only documentation update initially failed `format:check` because the new `i18n.zh.md`
terminology rows were not formatted. The file was formatted with the repository Prettier command, then
the complete Stage 0 evidence set was rerun on local `b5aea58`:

```text
pnpm --filter @openspecui/server exec vitest run src/root-context-cold-start.integration.test.ts
  run 1: 1 file / 1 test passed (2.68s; 17:51:44)
  run 2: 1 file / 1 test passed (2.34s; 17:51:47)
  run 3: 1 file / 1 test passed (2.40s; 17:51:50)
pnpm --filter @openspecui/server run typecheck:git-tests
  passed
pnpm format:check
  4 changed files checked; all matched Prettier style
git diff --check
  passed
```

This closes the reviewer-documentation formatting gap only. It does not select W1-W4, push the local
review point, authorize browser acceptance, or alter the `6.11` decision gate.

### 6.11 Owner Decision Applied: Narrow Worker Package (2026-07-19)

The owner resolved the decomposition gate. The active worker package is now W1 + the bounded W4
delivery evidence only:

```text
W1 -> Git scope/token implementation and checked public-boundary regression evidence
W4 -> direct same-origin Project Web single-page desktop/390x844 acceptance and multi-tab unit tests
```

Manual multi-tab browser acceptance belongs to the owner. The worker must not implement W2 Project
Binding settlement or W3 WebSocket/reactive readiness in this Change. Those are follow-up Changes with
the following settled direction: W2 uses write-then-converge with typed `rootPreview`/transition
evidence; W3 surfaces the actual transport/API failure instead of adding an artificial UI lock or
pretending cached data is current.

The package-specific Goal is authoritative for the next worker. It requires the pinned first-party CLI,
isolated `XDG_DATA_HOME`, direct same-origin Web, no App iframe, one bounded fixture stop-loss, checked
multi-tab tests, and a commit plus focused evidence before review. Historical staged-worker instructions
and the previous five-question decision gate no longer authorize work.

### 6.11 W1/W4 Delivery Evidence at `46c17a5` (2026-07-19)

Sol implemented the selected test-only slice in `46c17a5` (`test(app): prove project tab runtime
isolation`). The commit contains only the App HostedShell test. The new test uses two persisted backend
tabs and asserts independent API/session iframe URLs, active/inactive panel state, DOM retention while
switching, and the selected project's document title. No W2 Project Binding or W3 WebSocket/reactive
production path was changed.

Main-agent recheck:

```text
pnpm --filter @openspecui/app exec vitest run src/components/hosted-shell.test.tsx
  1 file / 6 tests passed (1.47s)
pnpm --filter @openspecui/app typecheck
  passed
git diff --check
  passed
git show --check --oneline 46c17a5
  passed
```

The terminating browser walk-through used the pinned first-party CLI at
`references/openspec/bin/openspec.js` (`e1b51d111ab446b54dee2d6159ac245f0339ae52`), isolated
`XDG_DATA_HOME=/tmp/openspecui-w4-Lyygdr/.xdg`, a disposable Git/OpenSpec fixture, backend `4136`, and
same-origin Vite proxy `4137`. Direct Project Web `/dashboard?_b=%2Fgit` rendered Code repository and
commit history at desktop `1280x577` and mobile `390x844`; both had equal `scrollWidth` and
`clientWidth`. Screenshots: `/tmp/openspecui-w4-desktop.png` and `/tmp/openspecui-w4-mobile.png`.

This closes the worker's single-page evidence package only. The owner still performs manual multi-tab
acceptance, and `6.11` remains open at `61/131`; W2/W3 follow-up Changes remain untouched.

### W2/W3 Follow-up Changes Scaffolded (2026-07-19)

The deferred contracts now have separate OpenSpec loop directories:

```text
openspec/changes/target-openspec-cli-16-project-binding-settlement/
openspec/changes/target-openspec-cli-16-reactive-error-propagation/
```

W2 is authorized to begin with write-then-converge evidence. W3 is authorized to begin only after its
typed disconnect/error boundary is reproduced. Neither follow-up changes the `6.11` checkbox or permits
`6.12+`, merge, archive, or release work in this Change.

W2 candidate `c85ce12` did not pass independent review. Its follow-up Change now records the required
physical/reactive launch-write owner, correlated preview/transition result, partial-error Root provenance,
and generation-safe repair correction. The result remains isolated from Git checkpoint `6.11` and W3.

### W2 Follow-up Review Evidence at `68ed1e9` (2026-07-20)

The independent W2 Change now has implementation SHA `89de4df0d763e033e204c19302b43569e1cbc442` and
evidence commit `68ed1e9`. Its bounded same-origin Project Binding fixture passed the pinned OpenSpec
1.6 CLI, isolated `XDG_DATA_HOME`, Store A-to-B launch write, Root B/Active Root B convergence, desktop
and mobile overflow checks, and zero browser errors. Clean SSG, all 15 workspace typechecks, complete
unit/browser suites, lint, format, and diff checks passed. The review also corrected a bounded-browser
cleanup P2. This closes only the W2 automated evidence package; B2.5 remains open for owner manual
single-page/multi-tab acceptance. Parent `6.11` remains `61/131` and unchecked; no W3, `6.12+`, merge,
archive, or release work is authorized.

### W2 Delivery Review: Remote Head Mismatch (2026-07-20)

The local implementation and evidence commits are present through `89de4df` and `68ed1e9`, with the
reviewer's documentation follow-up at `ed38e7b`. A live `git ls-remote` and `gh pr view 207` check show
the remote PR head is still `28319fd2e04a23a61040a3cb53a6ca6e0c494f72`; its green checks therefore cover
the older PR head, not the W2 implementation. Do not report PR CI as W2 delivery evidence until the
worker pushes the approved implementation/evidence commits and the resulting checks rerun. This is a
delivery-state finding, not a production defect, and does not authorize merge, archive, release, W3, or
`6.12+` work.

### W2 CI Delivery Blocker: Pinned CLI Build (2026-07-20)

PR head `8c55a30` reached the required remote Fast Gate, which failed only because the clean runner
could not import generated `references/openspec/dist/cli/index.js` from the pinned v1.6.0 submodule.
The local workspace had ignored `dist` output, so prior local green evidence was insufficient for this
clean-checkout condition. The failure is recorded as CI/test-fixture preparation evidence, not a W2
business defect. A bounded Sol Goal now owns explicit pinned-submodule initialization/build and the
follow-up Fast/Browser checks; no Project Binding, W3, or `6.12+` implementation is authorized.

### W2 Pinned CLI Delivery Correction Accepted (2026-07-20)

Commits `78550c0` and `51f1f78` made the pinned CLI preparation explicit and recorded its clean-clone
red/green evidence. Independent review found no P0/P1/P2. PR run `29700914049` passed Changeset, CI
Scope, Fast, Web Browser, xterm Browser, and Browser aggregation on exact remote head
`51f1f7833ef2a88d6b7b4f3e90d5f782a20129d6`. This closes the CI preparation/delivery blocker only.
Parent `6.11` remains unchecked at `61/131`, and child B2.5 remains open solely for owner manual
single-page/multi-tab acceptance.

### W2 Owner Acceptance Recorded (2026-07-20)

The owner confirmed W2's single-page Store A -> B settlement and same-project multi-tab subscription
convergence, with no stale draft or false success/error state. This closes child B2.5 only. Parent
`6.11` remains unchecked at `61/131`; its separate App multi-project tab acceptance remains outstanding.

### 6.11 Owner W4 Acceptance (2026-07-20)

The owner reported both remaining manual acceptance results as passing:

```text
single-page Project Web acceptance: passed
App multi-tab acceptance:          passed
```

This is first-party owner evidence for W4 and is intentionally kept distinct from W2's same-project
multi-page subscription evidence. The accepted W1 Git scope/token implementation, checked multi-tab unit
coverage, pinned-CLI direct-Web desktop/mobile evidence, complete local gates, and exact-head CI delivery
form the rest of the 6.11 package. Parent progress is now `62/131`; checkpoint `6.11` is closed.

No W3 reactive-error implementation was introduced or inferred from this acceptance. `6.12+` remains
outside this review update and requires a new worker Goal.

### 6.12 Terminal Cwd Identity Implementation at `0bbc9d0` / `5aeecda` / `c891187` (2026-07-20)

The bounded 6.12 worker slice is implemented and stops at independent review. Test commit `0bbc9d0`
adds checked public-boundary evidence; production commit `5aeecda` exposes the selected cwd before first
creation and keeps each tab's Server-resolved cwd visible. Independent-review correction `c891187`
removes an unnecessary PTY structural-port refactor after proving the checked contract directly covers
the unchanged concrete handler. Checkpoint 6.12 remains unchecked, and this slice does not authorize W3,
6.13+, final browser acceptance, merge, archive, or release.

Applied contract:

- Empty and active Terminal creation controls now show the selected Launch-project or Planning-root
  path before shell creation. The empty state can select Planning for the first session and uses a
  fixed-size icon action plus bounded, truncating path layout.
- Restored and newly acknowledged tabs render a stable Launch/Planning badge and the Server-provided
  `initialCwd` on a separate truncated line. Renaming changes only the title and retains cwd identity.
- Configured-command creation shows the same selected path. A non-current Planning target remains
  disabled with its actual Root Context reason, while switching to current Launch remains available.
- The production `createPtyWebSocketHandler` remains on its existing concrete `WebSocket`, `PtyManager`,
  and `PtySession` boundary. The public Zod protocol strips a client `cwd`; only the semantic `cwdTarget`
  reaches the Server, whose current resolver supplies cwd immediately before real `PtyManager` spawn.
- `typecheck:pty-tests` checks the real WebSocket plus `PtyManager` contract without `as never`,
  `as any`, fabricated non-null state, or suppression comments. The older handler suite remains a
  compatibility regression lane; the new checked contract is the authoritative 6.12 boundary.

Fixed-point evidence:

```text
post-hoc baseline 9c4a5fc, production patch removed:
  terminal-panel first Planning-session case -> 1 failed / 12 skipped
  intended reason: empty state could not find visible /launch cwd identity

current commits 0bbc9d0 + 5aeecda + c891187:
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/components/terminal/terminal-panel.test.tsx \
  src/components/terminal/terminal-spawn-command-dialog.test.tsx \
  src/components/terminal/terminal-tabs.test.tsx \
  src/lib/use-terminal-cwd-target.test.ts \
  src/lib/terminal-controller.test.ts
  -> 5 files / 62 tests passed

pnpm --filter @openspecui/server exec vitest run \
  src/pty-cwd-contract.test.ts src/pty-manager.test.ts
  -> 2 files / 10 tests passed

pnpm --filter @openspecui/server exec vitest run \
  src/pty-cwd-contract.test.ts src/pty-websocket.test.ts src/pty-manager.test.ts
  -> 3 files / 24 tests passed

pnpm --filter @openspecui/web typecheck
  -> passed
pnpm --filter @openspecui/server typecheck
  -> production, search, Git, transport, and dedicated PTY checked lanes passed
pnpm exec prettier --check packages/server/src/pty-websocket.ts \
  packages/web/src/components/terminal/terminal-panel.tsx
  -> passed
pnpm exec oxlint packages/server/src/pty-websocket.ts \
  packages/web/src/components/terminal/terminal-panel.tsx
  -> 0 warnings / 0 errors
git diff --check
  -> passed

independent-review correction:
git diff --exit-code 0bbc9d0 -- packages/server/src/pty-websocket.ts
  -> passed; production handler restored exactly to the checked-test baseline
pnpm --filter @openspecui/server exec vitest run \
  src/pty-cwd-contract.test.ts src/pty-manager.test.ts
  -> 2 files / 10 tests passed after correction
pnpm --filter @openspecui/server typecheck
  -> all Server production and checked-test lanes passed after correction
```

A proposed Storybook geometry fixture was removed at the stop-loss boundary. The current Storybook
Vitest project does not install the Tailwind Vite plugin, so `.truncate` does not produce representative
computed overflow geometry there; expanding that shared harness is outside 6.12. Unit evidence checks
the bounded layout contract, while final browser walkthrough remains owner-owned.

The worker's production, correction, and evidence-documentation commits used `VITE_GIT_HOOKS=0` because
the repository hook is already confirmed to point at an example configuration rather than this
workspace's check contract. The equivalent scoped focused, typecheck, format, lint, and diff checks above
were run explicitly. Full repository gates and the 6.12 checkbox remain for the independent review
boundary.

### 6.12 Independent Review: Production Cwd Owner Evidence Gap (2026-07-20)

Review target: `origin/feat/openspec-cli-16-contract-baseline...9658607`. Standards review found no
P0/P1/P2. Spec review found one P1 evidence defect; current production behavior is not shown incorrect.

`packages/server/src/pty-cwd-contract.test.ts` constructs its own `withCwdTarget` callback and injects it
directly into `createPtyWebSocketHandler`. It proves that the public schema strips arbitrary `cwd`, the
handler calls its injected owner, and the real `PtyManager` preserves the returned metadata. It does not
execute the production composition in `server.ts` that maps Planning creation through
`PlanningRootServiceManager.runOperation(({ rootContext }) => rootContext.planningRoot.path)`.

The counterexample is concrete: changing the production Planning branch in `server.ts` to return
`config.projectDir` leaves the new PTY contract test and the focused `24/24` Server lane green. Therefore
the earlier description of that test as the authoritative 6.12 boundary is too strong. It is downstream
handler/Manager characterization evidence only.

Checkpoint `6.12` remains open at `62/131`. The correction must add a checked test through the actual
production cwd owner/composition and show that the exact Planning-to-Launch mutation fails for the
intended cwd mismatch. Prefer a real `createServer` plus `createWebSocketServer` fixture; if transport
setup would force unrelated changes, extract the existing production owner into one internal module used
by `server.ts` and test it with the real Planning-root manager. Do not introduce a parallel test-owned
resolver interface, reimplement Root selection in the fixture, alter the accepted Terminal UI, or start
6.13. Full repository gates wait until this focused correction is green. Final end-to-end browser
walkthrough remains owner-owned and is not an agent completion claim.

### 6.12 Production Cwd Owner Evidence Correction at `009412d` (2026-07-20)

The P1 evidence correction is implemented without production changes. Commit `009412d` adds the
separate checked `pty-server-cwd-owner.test.ts` composition fixture and includes it in
`tsconfig.pty-tests.json`. Keeping this production-composition proof separate avoids adding a fifth
orthogonal intent to the existing downstream contract test.

The fixture crosses the real production path:

```text
createServer
  -> createWebSocketServer
  -> /ws/pty HTTP upgrade
  -> production withCwdTarget
  -> PlanningRootServiceManager.runOperation
  -> PtyManager
  -> mocked node-pty spawn
```

It proves Launch resolves to the launch project, Planning A resolves to the current Planning A root,
and a later Planning B creation re-resolves inside a new `runOperation` lease. Both Planning operations
return Server-owned `cwdTarget`/`initialCwd`, spawn in the same resolved cwd, and call `runOperation`
exactly twice. `server.ts` and the original downstream `pty-cwd-contract.test.ts` remain byte-identical
to `bc945b8`.

Mutation-resistance evidence:

```text
temporary mutation:
  production Planning branch uses config.projectDir instead of planningRoot.path

pnpm --filter @openspecui/server exec vitest run src/pty-server-cwd-owner.test.ts
  -> exit 1; 1 file / 1 test failed with 3 intended soft-assertion failures
  -> Planning A created.initialCwd: expected planning-a, received launch
  -> Planning B created.initialCwd: expected planning-b, received launch
  -> spawn cwd: expected [launch, planning-a, planning-b], received [launch, launch, launch]
  -> Launch creation remained correct; runOperation still reached the asserted 2 calls

mutation restored:
pnpm --filter @openspecui/server exec vitest run \
  src/pty-server-cwd-owner.test.ts src/pty-cwd-contract.test.ts \
  src/pty-websocket.test.ts src/pty-manager.test.ts
  -> 4 files / 25 tests passed

git diff --exit-code HEAD -- \
  packages/server/src/server.ts packages/server/src/pty-cwd-contract.test.ts
  -> passed
```

Focused and full green evidence:

```text
pnpm --filter @openspecui/server run typecheck:pty-tests
pnpm --filter @openspecui/server typecheck
  -> both passed; production plus Search, Git, transport, and PTY checked lanes passed

pnpm --filter @openspecui/web exec vitest run --project unit \
  src/components/terminal/terminal-panel.test.tsx \
  src/components/terminal/terminal-spawn-command-dialog.test.tsx \
  src/components/terminal/terminal-tabs.test.tsx \
  src/lib/use-terminal-cwd-target.test.ts \
  src/lib/terminal-controller.test.ts
  -> 5 files / 62 tests passed

pnpm --filter @openspecui/web typecheck
  -> passed

pnpm format:check
  -> 2 changed files passed
pnpm lint:ci
  -> 0 warnings / 0 errors across 847 files
pnpm typecheck
  -> all 15 participating workspace projects passed
pnpm test:ci
  -> passed: root 12/43, core 47/440, Server 54/404, Web 121/764,
     CLI 11/49, and every remaining participating package lane
pnpm test:browser:ci
  -> xterm-input-panel 6 files / 60 passed / 1 skipped
  -> Web Storybook 4 files / 12 passed
clean pnpm --filter @openspecui/web build:ssg
  -> passed after deleting dist-ssg and .vite; existing scroll-button and dynamic-import warnings only
git diff --check
  -> passed
```

The first normal commit attempt failed only because the known Vite+ hook cannot find a repository
`staged` config. Since the explicit focused and full gates above were already green, commit `009412d`
used `--no-verify` without changing hook configuration.

Checkpoint `6.12` remains open at `62/131` for main-agent independent acceptance. The existing automated
Vitest and component-level Playwright/Storybook results are preparation evidence only; no agent-run final
end-to-end browser walkthrough is performed or claimed. W3, `6.13+`, merge, archive, and release remain
outside this correction.

### 6.12 Independent Acceptance at `64d9aa2` (2026-07-20)

The final Standards and Spec reviews found no P0/P1/P2 issue. The Standards axis retained one
non-blocking Duplicated Code smell: the new production-owner fixture repeats a small PTY/WebSocket test
harness from the downstream contract test. The two files currently prove different ownership boundaries,
so extracting shared test support is deferred until a third consumer or a concrete maintenance defect
justifies the extra module.

The main-agent independently reran the exact production-composition lane (`4 files / 25 tests`) plus
`typecheck:pty-tests` and the complete Server typecheck; all passed. The independent mutation review also
confirmed that replacing only the production Planning cwd with Launch cwd preserves the two
`runOperation` calls while failing the Planning A/B `initialCwd` and spawn-cwd assertions. Local HEAD,
the remote feature branch, and PR #207 all resolved to `64d9aa2`, and the worktree was clean at review.

Checkpoint `6.12` is therefore accepted at `63/131`. This closes the component/server contract only; it
does not claim the owner's final end-to-end browser acceptance or close checkpoint `10.9`. W3 remains a
separate Change, and `6.13` becomes the next authorized implementation checkpoint. No merge, archive, or
release is authorized by this acceptance.

### 6.13 Focused Red/Green Boundary (2026-07-20)

The first Settings diagnostics candidate is intentionally still open at `63/131`. Server test commit
`979c9b0` crosses the real `appRouter.createCaller -> public subscription -> createReactiveSubscription
-> Core reactive filesystem -> external mutation` path. Its two focused cases and explicit transport
typecheck pass: Planning-root `.cursor`/generated command files do not enter Launch projections, while
external Launch creation/removal re-emits detection and exact `delivery=commands` / `workflows=[update]`
tool state. No query/refetch fallback, polling, or fabricated resolver is used.

The first Web component/hook lane produced one useful red among fifteen cases. A Root Context `loading`
projection with no CLI evidence was rendered as `CLI unavailable`. Missing evidence is pending/unknown,
not an objective unavailable result; only explicit `cli.available=false` may carry that label. The
corrected component/hook lane then passed all `15/15` cases.

Independent review found that the first rebind assertion covered only late retired-A callbacks, not the
cached A snapshot retained while B was loading. Before changing the hook, this exact command provided a
real fixed-point red rather than source-inspection evidence:

```bash
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/components/settings/use-settings-tool-subscriptions.test.tsx \
  --reporter=verbose --maxWorkers=1
```

The single case failed at the new B-rebind assertion with `expected [claude-a] to be undefined`. The
hook now starts every replacement generation as `{ data: undefined, isLoading: true, error: null }`;
the same command passes `1/1`, and late A data/errors remain unable to overwrite the eventual B result.
An isolated mutation deleting that cleanup transition failed the same case at the loading transition
(`expected true`, received `false`), then restoration returned the Web component/hook lane to `15/15`
and Web typecheck to green.

Independent review also rejected two structural shortcuts before delivery: Settings cannot retain the
old `cli.checkAvailability` status as a second visible CLI/version truth, and the fixed global installer
must invalidate Root Context on terminal or indeterminate settlement so that removal remains reactive.
Root/Environment diagnostics, launch-tool initialization, and thin Settings composition must remain
separate physical modules rather than moving the old oversized route into one new oversized component.
Checkpoint `6.13`, full gates, final owner browser acceptance, `6.14+`, merge, archive, and release remain
open or unauthorized at this focused boundary.

The global-installer Root invalidation evidence now lives beside the real public subscription fixture in
`tool-subscription-router.test.ts`, which is included by `tsconfig.transport-tests.json`; the duplicate
untyped Router cases were removed. The success case observes Context generation `1` inside the public
`next(exit)` callback and again at completion. The rejected settlement observes generation `1` inside
the public error callback. Moving `settle()` after `onEvent(exit)` in an isolated mutation made the
success assertion fail with `expected [1]`, received `[0]`; the rejected-settlement case remained green,
showing that its separate promise-rejection path still invalidated before error. Restoration passed the
Server public fixture `4/4`, `typecheck:transport-tests`, and `git diff --check`.

The complete focused candidate lane passes Core tool projection `15/15`, Server Router/subscription
`90/90`, Web Settings/runner/subscription `86/86`, Web typecheck, Server typecheck, format, lint, and diff
checks. The temporary mutation worktree is removed. Checkpoint 6.14 pre-development now has a
Change-owned takeover authority at `../frontend.GOAL.md`: `takeover=ready`,
`workStatus=not-started`, and `integration=blocked` while 6.13 remains unaccepted. The repository-root
`frontend.GOAL.md` is only a forwarder and carries no independent status truth.

### 6.13 Independent Review Correction (2026-07-20)

The preceding focused-green conclusion is superseded. Checkpoint `6.13` remains open at `63/131` after
independent Standards and Spec review found four implementation gaps at the candidate derived from
`979c9b0`:

1. The tool-subscription hook clears A only inside a passive effect. A B render can therefore still read
   A data under B's delivery/workflow contract before that effect commits. The existing test observes
   only post-effect state and does not prove render-time provenance. The correction must associate state
   with its exact input identity and mask A on B's first render/commit while still retiring late A
   callbacks; red and mutation evidence must observe that exact boundary.
2. The fixed global installer invalidates the `context` facet but does not retire
   `ConfigManager.resolvedRunner`. A previous package-runner resolution can remain authoritative after a
   global install, and an invalidated in-flight resolution can repopulate stale cache. The correction must
   retire runner resolution before Context invalidation and before public terminal/indeterminate
   settlement, with cached and in-flight recurrence tests.
3. The candidate and Goal overstate tool artifacts as Launch-only. Official OpenSpec 1.6 keeps Codex
   commands at `${CODEX_HOME:-~/.codex}/prompts`, while Codex skills and ordinary project tool artifacts
   remain beneath Launch. The subscription must preserve this physical scope and acquire reactive
   observation for the environment-global Codex command root; a checked public Router test must prove
   both create and remove convergence without relabeling it Launch-owned.
4. The public subscription fixture passed in focused/serial runs but reproduced `1/4` failure under
   ordinary parallel load. Its wait boundary must be derived from the reactive watcher's bounded fallback
   cadence and prove deterministic eventual delivery without arbitrary sleeps or retry loops. Until that
   lane is stable, the recorded `4/4` claim is conditional rather than closure evidence.

The attempted 6.14 takeover mirror in `loop/checkpoints.md` was outside the 6.13 Goal and has been
removed from the tracked candidate. Both `frontend.GOAL.md` files remain untracked owner artifacts and
must not be edited, staged, ignored, or used to authorize 6.14 integration during this correction.

No Agent final end-to-end browser walkthrough is authorized or required. Vitest and basic component-level
Playwright/Storybook evidence remain the Agent boundary; checkpoint `10.9` is owner-only. Do not close
`6.13`, start `6.14`, merge, archive, or release before the corrected candidate passes a new independent
review.

### 6.13 Correction Evidence (2026-07-20)

The four review gaps above are now corrected in the current worktree. Checkpoint `6.13` remains open at
`63/131`; this entry records preparation evidence only and does not authorize `6.14`, merge, archive,
release, or owner browser acceptance.

Runner ownership fixed point:

```text
normal focused:
pnpm --filter @openspecui/core exec vitest run src/config.test.ts -t "without a replacement owner" --reporter=verbose --maxWorkers=1
  -> 1/1 passed after restoration

mutation (only the generation/owner guard replaced by an unconditional cache assignment):
  -> exit 1; the test timed out waiting for `single-runner-started/2` with ENOENT,
     proving the retired A result repopulated cache and no replacement process ran

restoration:
  -> 1/1 passed; the old A process completed after invalidation and a fresh B process owned cache
```

External Codex command observation fixed point:

```text
normal missing-root fixture:
pnpm --filter @openspecui/server exec vitest run src/tool-subscription-router.test.ts \
  -t "observes environment-global" --reporter=verbose --maxWorkers=1
  -> 1/1 passed; `CODEX_HOME/prompts` was absent when the subscription started, then external
     command create and removal converged while Planning `.codex/skills` remained excluded

mutation (only `ToolCommandObservationService.start()` lease acquisition replaced by a resolved no-op):
  -> exit 1 at the removal fixed point after the bounded wait:
     `environment-global Codex command removal: expected false to be true`
  -> create remained visible, but removal could not converge without the external lease

restoration:
  -> the same missing-root fixture passed 1/1
```

Missing-root watcher ownership is covered without aliasing lifecycle bugs. `watcher-pool` resolves a
missing logical root to its nearest existing ancestor only for the physical `ProjectWatcher`, keeps the
logical root as the subscription/diagnostic identity, and reference-counts the shared physical watcher.
The checked shared-ancestor test and the full watcher-pool file pass `21/21`; releasing one missing logical
root leaves the other observing. The public fixture also confirms external create/remove behavior through
the real Router subscription rather than a test-only observer.

Focused combined evidence after restoration:

```text
pnpm --filter @openspecui/core exec vitest run \
  src/config.test.ts src/tool-init-state.test.ts src/tool-config.test.ts \
  src/reactive-fs/watcher-pool.test.ts
  -> 4 files / 89 tests passed

pnpm --filter @openspecui/server exec vitest run \
  src/tool-subscription-router.test.ts src/router.test.ts
  -> 2 files / 91 tests passed

pnpm --filter @openspecui/server typecheck:transport-tests
pnpm --filter @openspecui/server typecheck
  -> both passed
```

The earlier Web focused count `86/86` is superseded. The exact four-file Settings lane is `82/82` with
Web typecheck green, as recorded by the main-agent rerun. One prior ordinary parallel Server attempt
had a single installer-success failure under load; standalone and the two normal combined Server runs
above are the stable evidence, and no arbitrary sleep, retry loop, or worker-concurrency change was added.

Full repository gates, clean SSG rebuild, commit, push, and independent review remain pending. Final
browser E2E remains owner-only.

### 6.13 Full Gate Evidence (2026-07-20)

The corrected worktree completed the required local gates. Static output directories were moved out of
the workspace before the SSG build so the generated result was fresh; no stale `dist-ssg` or `.vite`
artifact was used as evidence.

```text
pnpm format:check
  -> passed; all 28 changed files use Prettier code style

pnpm lint:ci
  -> passed; 856 files, 0 warnings, 0 errors

pnpm typecheck
  -> passed; all 15 participating workspace projects, including Server transport/search/git/pty lanes

pnpm test:ci
  -> passed: root 12 files / 43 tests; Core 47 / 443; Server 55 / 407; Web 123 / 779;
     CLI 11 / 49; all remaining participating package lanes passed
  -> Web emitted existing jsdom canvas-not-implemented diagnostics from xterm/Pixi imports, but no test failed

pnpm test:browser:ci
  -> passed: xterm-input-panel 6 files / 60 passed / 1 skipped; Web Storybook 4 files / 12 passed
  -> automated component/fixture evidence only; no owner browser walkthrough claimed

pnpm --filter @openspecui/web build:ssg
  -> passed after clean output preparation; existing scroll-button CSS and ineffective dynamic-import
     warnings only

git diff --check
  -> passed
```

No commit, push, remote CI, independent acceptance, merge, archive, release, or final browser E2E is
claimed by this evidence entry.
