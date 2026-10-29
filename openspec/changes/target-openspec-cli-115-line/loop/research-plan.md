<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Convert the intake into an executable five-phase plan backed by verified research facts.
2. Keep every contract claim anchored to the evidence report or executed-CLI evidence.
3. State risks with concrete mitigations from the historical line precedents.
-->

## Research Findings

Full evidence: `references/openspec-1.15.0-report.md` (this branch). Sources:
three parallel read-only investigations of the upstream diff
(`v1.14.1..v1.14.2`, `v1.14.2..v1.14.3`, `v1.14.3..v1.15.0`), a read-only map
of the current OpenSpecUI 14 rotation surface, and executed-CLI evidence
against fresh npm installs of 1.15.0 and 1.14.3.

F1. **1.14.2 + 1.14.3 (in-window) have zero JSON shape changes.** All deltas
are behavior fixes inside already-typed passthrough surfaces (`warnings:
string[]`, plain-Error failures). No schema projections owed; only fixture
warning-string expectations may need refresh.

F2. **1.15.0 adds exactly one new typed JSON contract**: `update --dry-run
--json` → `UpdatePlan {changes, notes, failures}`, three keys always arrays;
`action ∈ {add, update, delete}` (no rename — moves are delete+add pairs);
`notes` closed enum `legacy-tool-directories | legacy-artifacts`; changes
sorted by `path.localeCompare`; `path` has three display forms
(project-relative POSIX / `~/…` / absolute); `tool` open string with the
reserved value `'openspec'`. Failure envelope: plan keys empty + `status:
[{severity, code: 'update_error', message}]`, exit 1. `--json` without
`--dry-run`: empty stdout, stderr text, exit 1. **Non-empty `failures` keeps
exit 0** (failures are data; the plan stops where the real update would
throw).

F3. **Standalone distribution does not touch the npm consumption shape.**
`InstallScope` gains `'standalone'`; `CliVersionSchema.install.scope` (typed,
fixture-only consumer today) must accept the new member. The once-per-machine
tip writes `standaloneTipSeen` into the global config only on a TTY real
`update` — OpenSpecUI's piped spawns are silent and all structured readers
already tolerate unknown keys. Upstream `package.json` (`bin`, `engines`,
`exports`) is unchanged.

F4. **Zero Agent-tool delta** (`src/core/config.ts` byte-unchanged): the
registry rotation is constants-only (series `'1.15'`, provenance union, order
map, series parser). Staleness baseline rotates to `1.15.0` with no logic
change.

F5. **Rotation surface map** (file:line inventory in the investigation):
compat constants `packages/core/src/openspec-compat.ts` L19/L36–44/L70–92;
mirrored constants `packages/core/src/config.ts` L36/L113 and
`scripts/setup-example.ts` L240–247; registry
`packages/core/src/agent-delivery-registry.ts` L117/L127/L145–160/L242–247;
staleness `packages/core/src/tool-init-state.ts` L57; fixtures
`packages/core/package.json` L249–259 aliases +
`packages/core/src/__tests__/official-cli-v14-fixtures.ts` + 14 positive-matrix
test files + `official-cli-v13-boundary-fixtures.test.ts`; pin guards
`scripts/prepare-openspec-reference.mjs` L41,
`packages/core/src/upstream-contract-regression.test.ts` L106,
`packages/server/src/root-context-cold-start.integration.test.ts` L45–47,
`packages/web/scripts/w2-project-binding-playwright.ts` L45;
`update` consumption `packages/server/src/router.ts` L2486–2586
(`agentIntegrationsRouter.updateStream`/`repairStream`) with web runners
`packages/web/src/lib/use-cli-runner.tsx` L184–209 and page
`packages/web/src/routes/config-agents.tsx`; docs (README L23–96,
README-zh, `packages/cli/README.md`, AGENTS.md L121/L489/L568).
**Known defect to fix in-passing**: `scripts/check-openspec-reference.mjs`
still asserts a `v1.9.*` describe pattern — a stale fake green gate wired into
`ci-fast-gate.mjs`.

F6. Historical precedents to reuse verbatim: the v14 line change
(`loop/` four-artifact structure, batch topology, fixture helper pattern) and
the 1.14.1 patch rotation ("zero registry change is a legal conclusion";
gitlink must land in the same PR as the pin guards).

## Decision & Plan (For Approval)

D1. **Admission**: new major line OpenSpecUI 15, window `>=1.15.0 <1.16.0`,
single series, `1.15` not pre-claimed beyond this verified report. One-hop
rotation from the 1.14.1 pin; no separate 1.14.2/1.14.3 releases (vetoable).

D2. **Capability naming**: `updateDryRun` joins `OpenSpecCliCapabilities`,
target-series gated like `batchStatus`/`findingsReport`.

D3. **Update preview landing**: `agentIntegrationsRouter` gains a dry-run
preview step ahead of `updateStream` execution — same stream family, typed
`UpdatePlan` evidence persisted in the mutation ledger; `config-agents.tsx`
renders the plan (readable paths, wrap, move-pair display, notes by code,
inline per-tool failures) before the user confirms the real update.
Capability-absent ⇒ preview unavailable with the standard Tooltip reason; the
real update path itself is unchanged.

D4. **Phases** (serial where noted):

- **P0 pin barrier**: gitlink (already staged) + `EXPECTED_COMMIT` + three pin
  guards + repair/retire `check-openspec-reference.mjs`; build the submodule
  dist locally for fixture runs (CI does this via prepare script).
- **P1 core contracts**: compat constants + tests; `updateDryRun` capability;
  typed `UpdatePlan` schema + executor method (buffered execute, typed
  envelope, exit/status discipline); `CliVersionSchema.install.scope` +
  `'standalone'`; mirrored constants.
- **P2 registry**: series constants, provenance union, order map, series
  parser, staleness baseline, header comments (no content changes).
- **P3 fixtures**: `openspec-cli-115` alias (1.15.0), rotate `openspec-cli-114`
  alias to 1.14.3; new `official-cli-v15-fixtures.ts` helper; migrate the 14
  positive-matrix files; new `official-cli-v14-boundary-fixtures.test.ts`;
  retire the v13 boundary suite; re-derive upstream source anchors.
- **P4 server/web/cli + docs**: dry-run preview (D3); constants-driven
  surfaces auto-rotate; README ×2 + CLI README + AGENTS.md decision + pin
  bullet; changeset.

Batch topology: P0 serial → P1+P2 parallelizable (same package, different
files) → P3 after P1 (helpers import compat constants) → P4 last. The evidence
report and change docs are already on disk.

## Capability Impact

### New or Expanded Behavior

- `update --dry-run --json` projected as typed evidence with an
  `updateDryRun` capability gate; Agents config Update flow gains a plan
  preview before the real update.
- `install.scope` typed union accepts `'standalone'`.

### Modified Behavior

- Admitted CLI window becomes `>=1.15.0 <1.16.0`; every other version
  (including the whole 1.14 window and the new `install`-only standalone
  binaries' reported version) classifies per the same law as before.
- Agent registry admitted series rotates to `'1.15'`; generator staleness
  baseline becomes `1.15.0`; existing artifacts generated by 1.14.x report
  stale against the new baseline (expected refresh flow, `openspec-verify`
  drift is an upstream template change).

## Risks and Mitigations

R1. Positive-matrix migration breadth (14 test files) — mitigated by the
helper-first pattern from the v14 line: migrate the helper, keep per-file
assertions, translate member-presence claims (never assert v14-era members
absent on 1.15).

R2. `failures` exit-0 semantics could be misread as an error path — encoded
directly in the typed schema tests (exit 0 + non-empty failures = success
evidence class) and in the preview UI (inline per-tool failure rows, not an
error banner).

R3. Stale `check-openspec-reference.mjs` green gate could mask a future
gitlink revert — repaired to the v15 assertion in the same PR (P0), verified
by running the fast gate locally.

R4. Windows fixture stability (native watcher / forks pool laws) — no new
fixture topology; the v15 helper reuses `pinnedFixtureEnv`/`runPinnedOpenspec`
unchanged; per-test timeouts follow the existing 30s CLI / explicit
testTimeout pattern.

R5. Release ordering: this PR carries a major changeset but does not publish;
Manager Mode gates the release after merge.

## Verification Strategy

1. Focused: `pnpm --filter @openspecui/core exec vitest run
src/openspec-compat.test.ts src/upstream-contract-regression.test.ts` and
   each migrated fixture file individually (`exec` passthrough, no `--`
   forwarding).
2. Full scoped: `pnpm --filter @openspecui/core test`, then
   `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, and the scoped
   `test:ci` subset justified in the PR notes.
3. Gate scripts: `node scripts/prepare-openspec-reference.mjs` (clean worktree
   build of the pinned submodule) and the repaired
   `check-openspec-reference.mjs`.
4. Executed evidence: the temp-prefix 1.15.0 executable runs recorded in the
   evidence report (empty plan, corrupt/delete-file plans, failure envelope,
   boundary rejection) re-proven by the fixture matrix against the installed
   `openspec-cli-115` alias.
5. Docs: grep gates for the old window strings (`1.14.0 <1.15.0`, `v1.14.*`,
   `87c3595`) outside archive/legacy files.
