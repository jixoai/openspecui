<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Report implementation state without converting planning work into false code progress.
2. Preserve approved architecture decisions as implementation constraints.
3. Record actual divergences from the approved plan.
4. Define conditions that require returning to intake and research-plan.

Original request (2026-07-14): "我们最终使用openspec来管理 wayfinder 产出的文档。"
Original request (2026-07-15): "解决方案可能没你想的那么简单，这点我们后续再说。"
-->

## Implementation State

Status: **Section 2 CLI contract baseline in progress; frontend skeleton drafted ahead of kernel data sources**.

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
