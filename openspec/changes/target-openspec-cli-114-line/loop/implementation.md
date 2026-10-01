<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Track live implementation state, review rounds, and evidence for OpenSpecUI 14.
2. Record subagent topology and the integrator-owned shared-file rule.
3. Keep the header law visible to every implementation agent.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 implementation state

## Current state

- CP0: worktree `openspecui-114` @ `target-openspec-cli-114-line` (off main `4d8c0072`); submodule pinned
  `v1.14.0` (`94ca9c1e`); dependencies installed; evidence report + change artifacts written; review rounds
  pending.

## Evidence recording rule

Every round records: slice, production owners, the precise red as it failed (or the honest statement why a
red could not be captured), the focused green command + result, and the commit. Claims without command
output are not evidence.

## Subagent topology

Batches follow the slice order; each subagent touches only its slice's files. Shared files (package.json
devDeps, lockfile, AGENTS.md, READMEs, `.changeset/`) are integrator-owned. Subagents never commit/push, run
focused tests via `pnpm --filter <pkg> exec vitest run <file>` (never `test --`), report difficulties
(feedback protocol), and reclaim any process they start.

## Review rounds

### Round-A review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 6.2/10, REVISE

Worked 16m 37s. Seven blockers, all verified against source and adopted:

1. **B1 show names missing** → report/intake recount to six surfaces; Slice 2 owns
   `CliSpecRequirementSchema` + scenario `name` through the Spec Catalog chain; new "Spec Requirement Names
   Contract" delta; show-name fixture evidence assigned to the widened `show` suite (both surfaces).
2. **B2 status warnings lost at the kernel rebuild** → `opsx-kernel.ts` `projectWorkflowStatus` (the
   explicit `ChangeStatusSchema.parse({...})` copy used by BOTH single and batch paths) added to Slice 2
   owners; red driven from a real 1.14 payload through the kernel to the Server-visible output, verbatim.
3. **B3 edit-roots lacked normative coverage** → new "Status Action Context Edit Roots Contract" (both
   branches) + executable two-branch fixtures in the `default-store` counterpart beside the non-store
   control; report documents both branches.
4. **B4 boundary executable contradiction** → unified everywhere: the just-retired **1.13.2**
   (`openspec-cli-113` alias) becomes the v14 boundary line; v12 boundary suite + `openspec-cli-112` alias +
   v12 helper retire; compat unit tests still cover 1.13.0/1.13.2 rejection directly.
5. **B5 matrix counts unresolvable** → file-level matrix: 11 migrate (apply-readiness keeps 1132 tracking
   cases as regression + gains sourcePath/line), 2 new, boundary per B4; checkpoints match (13 files).
6. **B6 contradictory inherited scenario titles** → recorded as known legacy in Spec hygiene with a
   proposed separate spec-hygiene change (verified rename process on an isolated copy; Owner decision);
   new scenarios never carry contradicting titles.
7. **B7 "verbatim" warning was truncated** → complete raw string re-captured from the disposable fixture
   (including the `skip_design is not a supported key; only skip_specs exists...` tail) and embedded in the
   report as the fixture contract string.

Non-blocking corrections adopted: `nested`/list-`warnings` reclassified as 1.13.1 regression items (the one
new list member is `archived`); 1132 baseline verified accurate by the reviewer (no overlap).

Pending: Round-B re-review.

### Round-B review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 7.4/10, REVISE

Worked 12m 27s. Round-A B2/B3/B7 confirmed closed; four residual blockers, all documentation-consistency
class, adopted:

1. **B1 boundary text self-contradiction** — the "v13-only fields absent" assertion was semantically wrong
   (1.13.2 IS a v13 CLI and legitimately emits taskTrackingConfigured etc.). Rewritten everywhere: the
   boundary asserts 1.13.2 identity + unsupported classification + **1.14-only members absent** (task
   sourcePath/line, list archived, show names, status warnings), never v13-era absence. Residual 1.13.0
   wordings in intake/report synced to 1.13.2.
2. **B2 v12 alias has live consumers** — `tool-init-state.test.ts` and `agent-command-content.test.ts`
   resolve `openspec-cli-112` as historical generator evidence. Retirement narrowed to the v12 boundary
   suite + v12 helper; the npm alias stays; pre-delete rg check named in the plan.
3. **B3 spec-hygiene disposition honesty** — the Round-A note overstated ("verified" nothing). This change
   adds a REQUIREMENT-LEVEL identity note in the delta spec intro (titles name historical admission eras;
   bodies are the normative text and already state retired/blocked for every affected scenario); the
   inherited scenario bodies themselves are unchanged. The rename-mechanism verification stays a separate
   Owner-gated proposal and is NOT a precondition of this change; the Owner may veto.
4. **B4 report/intake count drift** — owner map gains the show-names row; list row says "the one new member
   archived (nested/warnings are 1.13.1 regression fixtures)"; intake decision 1 "five"→"six"; decision 2
   rewritten to name this line's new members vs migrated ones.

### Round-C review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 7.8/10, REVISE

Worked 6m 15s. Boundary/alias/count fixes confirmed closed; two residuals, both factual-record corrections,
adopted:

1. **C1** — the Round-B disposition log claimed per-scenario body annotations that were never made (the
   actual change was the requirement-level identity note). Disposition text corrected to describe the real
   diff; inherited bodies unchanged; rename mechanism stays Owner-gated and non-blocking.
2. **C2** — report drift: the Protocol delta tree still listed `nested`/list-`warnings` as 1.14 additions
   and the fixture owner map still said the `openspec-cli-112` alias retires. Both rewritten to the
   single source of truth (archived is the one new list member; alias retained for its two historical
   consumers); the broken parallel sentence at the list section fixed; residual audit re-run.

### Round-D review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 8.1/10, REVISE

Worked 3m 57s (narrow). C1 confirmed closed. C2 partially closed — and the reviewer caught a real
integration error on our side: the Round-C correction script aborted on a later assertion before its
`write()`, so the protocol-tree carry-forward line and the list-sentence rewrite never landed even though
the Round-C disposition claimed them (batch-edit write-after-all-assertions failure; lesson already in the
global correction log). Re-applied with write-first verification (protocol tree gains the carry-forward
line, the stale `list --json` tree row is gone, the list paragraph reads as a complete sentence); the
fixture owner-map alias fix from Round-C had landed and is confirmed.

### Round-E review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 9.1/10, GO

Worked 1m 27s (narrow). Both re-applied fixes verified in the actual `bc633fb9` diff (not the disposition's
self-description): the stale tree row is gone, the carry-forward line is unique, the list paragraph is a
complete sentence, and the Round-D record matches the real changes. No blockers, no new non-blocking notes.
**Verdict: GO — implementation may start under the CP/slice evidence rules.**

Review arc: Round-A 6.2 REVISE (7 blockers) → B 7.4 (4) → C 7.8 (2) → D 8.1 (1, caught our lost write) →
E 9.1 GO.

## Batch A implementation record (2026-10-02)

### Slice 1 — Compat window and mirrors (CP1)

Production: `packages/core/src/openspec-compat.ts` (MAJOR 14, series `'1.14'`, `>=1.14.0 <1.15.0`,
NEXT_SERIES `'1.15.0'`, tag `'v1.14.*'`), `scripts/diagnose-cli-runner.mjs` + `scripts/setup-example.ts`
mirrors rotated with their tests. Red evidence was recorded by the slice agent before the constant flip
(6 failure sites: compat classification, boundary labels, mirror series assertions). Green:
`openspec-compat.test.ts` inside the core run below; scripts mirror inside `pnpm test:root`
(20 files / 75 passed | 12 skipped, includes `diagnose-cli-runner.test.mjs` parity cases).

### Slice 2 — CLI contract chain and kernel warnings (CP1)

Production: `cli-contracts/workflow.ts` (`CliApplyTaskSchema` + `sourcePath`/`line`;
`CliSpecRequirementSchema` + scenario `name`; `CliWorkflowStatusFieldsSchema` `warnings` shared by
single and batch entry shapes, batch stays entry-level only; change-list entry `archived`; new
`CliVersionSchema`), `cli-contracts/executor.ts`, `opsx-types.ts`, and the Round-A B2 owner fix in
`opsx-kernel.ts`: `projectWorkflowStatus` now carries
`...(data.warnings !== undefined ? { warnings: data.warnings } : {})` through its explicit
`ChangeStatusSchema.parse({...})` rebuild — decode `.passthrough()` is stripped at that rebuild, so the
copy is required on BOTH the single and the shared batch path. Red evidence: new
`opsx-kernel-status-warnings.test.ts` captured the warnings loss through the real kernel rebuild before
the fix (verbatim single + batch payloads). Green: core focused run —
`pnpm --filter @openspecui/core exec vitest run src/openspec-compat.test.ts src/cli-contracts/workflow.test.ts src/opsx-types.test.ts src/opsx-kernel-status-warnings.test.ts src/planning-cli-projection.test.ts src/agent-command-content.test.ts`
→ 6 files / 114 passed; `pnpm --filter @openspecui/core exec tsc --noEmit` → 0 errors.

### Slice 3 — Agent registry rotation (CP2)

Production: `agent-delivery-registry.ts` (series `'1.14'`, +10 entries: amp, atomcode, codestudio, dsh,
easycode, gigacode, grok, veai, warp, IBM Bob; gsd shares the `.agents` root with amp), `tool-init-state.ts`
+ tests. Integrator decision on the slice agent's escalation: `SHARED_AGENTS_SKILLS_OWNER_CANDIDATES`
widens from three to five values `['codex','zed','agents','amp','gsd']` — upstream 1.14 arbitration pool
counts five `.agents` skills writers and the reviewed spec delta already says so; antigravity stays
commands-only (adapter-backed). The slice agent had conservatively kept the three-valued tuple and
deferred; the registry + its test were updated together in the integrator pass. Green:
`vitest run src/agent-delivery-registry.test.ts src/tool-init-state.test.ts src/agent-command-content.test.ts`
→ 93 passed.

### Batch A integrator pass (2026-10-02)

- Fixed one stale assertion the slice rotation missed: `packages/server/src/tool-subscription-router.test.ts`
  global install expectation `@fission-ai/openspec@1.13` → `@fission-ai/openspec@1.14` (production constant
  had already rotated; the assertion failed once, then passed: file 5/5).
- Server focused suites: `agent-delivery-projection-service` + `agent-integrations-router` + `tool-subscription-router`
  → 22 + 5 passed across two runs (the split is the fixed assertion file re-run).
- `pnpm --filter @openspecui/server run typecheck` (10 tsconfig lanes) → 0 errors.
- Note for future rounds: multi-package `pnpm --filter A --filter B exec tsc` produces spurious TS6059
  rootDir errors in this repo; per-package invocations are authoritative.

## Batch B implementation record (2026-10-02)

### Slice 4 — Status warnings Web direct plane (CP3)

Production: `packages/web/src/routes/change-view.tsx` (statusRegion mounts the notice;
`hasDirectStatus` includes warnings presence). New owners:
`components/status-warnings-notice.tsx` (collapsed summary row `⚠ N status warning(s) — reported by
openspec status`, `role="status"`, amber advisory tone, in-place verbatim expansion, zero synthesis when
absent, never gates actions) + component test + route-level test in the dedicated
`routes/change-view-status-warnings.test.tsx` (change-view.test.tsx untouched by this slice to avoid
parallel-write overlap). Parallel implementation reusing the v13 apply-progress summary-row pattern was
chosen over extracting a shared component (the v13 notice is a compound surface; extraction would
re-verify its 12 assertions for a thin disclosure shell). Red: pre-render route test failed with the
status region absent. Green: 3 files / 17 tests + web typecheck.

### Slice 5 — Pin guards + v14 fixture matrix (CP3)

Pin guards rotated with a real red (`upstream-contract-regression` expected the v1.13.2 commit while the
submodule sat at `94ca9c1e`): `scripts/prepare-openspec-reference.mjs`,
`upstream-contract-regression.test.ts`, `packages/web/scripts/w2-project-binding-playwright.ts` (pin +
`--version` 1.13.2→1.14.0). Alias: `openspec-cli-114: npm:@fission-ai/openspec@1.14.0` added
(shim `--version` = 1.14.0 verified; lockfile +23 lines exactly); **`openspec-cli-112` retained** for its
two historical consumers. Matrix: new `__tests__/official-cli-v14-fixtures.ts` helper; 11 suites migrated
with git mv (apply-readiness keeps the 1132 tracking regressions and adds sourcePath/line assertions;
default-store adds the store edit-roots both-branches scenarios; show suite adds spec
requirement/scenario names; workflow mixed-tasks strict equality updated to real 1.14 output);
2 new suites (version-report envelope without network probing; change-list-inventory with
`--archived`/`--all`/default tri-state); boundary suite `official-cli-v13-boundary-fixtures.test.ts`
proves the just-retired 1.13.2: identity, unsupported classification, and 1.14-only members absent
(never asserting v13-era members absent). Retired: v13/v12 helpers + v12 boundary suite with rg orphan
scan clean. Mutation red recorded (helper bins pointed at 113 → version provenance assertion failed →
restored, zero residue). Two unplanned but evidenced fixes: `opsx-kernel-schemas-root.fixtures.test.ts`
migrated off the deleted v13 helper, and Batch A's `workflow.test.ts`/`opsx-types.test.ts` typed-fact
annotations corrected to optional members so the workflow-contract typecheck lane compiles (both files
were byte-identical to HEAD, proving pre-existing lane debt outside base `tsc --noEmit` scope).
Green: 15 files / 52 tests (heavy files also run split); core typecheck incl. all lanes.

Real 1.14-vs-1.13 behavior deltas recorded in the slice report (apply source locations; show names;
status verbatim warning incl. the full known-keys list; store edit-roots two branches with exact
constraint strings — declaring-project `[implementationRoot, storeRoot]`, no-declaring `[storeRoot]` +
ask-user; list archived member; version envelope with pnpm install location).

### Slice 6 — Cross-package alignment (CP4)

Four owner groups, red-first where a real literal rotation happened, "constant-follow" recorded where
shared constants already carry the window: web compat copy (cli-health-gate suite 9-failed red → 87
passed across 4 files), server evidence (change-diff 6-failed red → 9/9; findings-router 4-failed → 4/4;
router admitted fixture → 107/107; cold-start integration pin+version → 1/1), web evidence (19-failed
red across three files → 49/49), CLI/scripts (worktree-instance-manager 22/22 constant-follow;
setup-example consumer verified via static mirror equality). `tool-subscription-router.test.ts` needed
zero changes (Batch A integrator pass had rotated it). 12 files, +94/−82, production untouched;
"OpenSpec 1.13/1.13.2" prose kept only as upstream provenance in feature-origin notes.

### Batch B integrator verification (2026-10-02)

Cross-slice check after three parallel agents shared one worktree: core 18 files / 91 tests green
(matrix + boundary + regression + schemas-root + Batch A suites), web 6 files / 65 tests green —
including the cross-slice fixpoint: Slice 4's reported `change-view.test.tsx` 24/25 failure (admitted
fixture 1.13.0 rejected by the rotated window) is closed by Slice 6's literal rotation, now 25/25 —
server 4 files green, core+web typecheck clean, no orphan references, lockfile scoped to the new alias.

### Slice 7 delivery prep + full-gate residue (2026-10-02)

Delivery docs: `.changeset/openspec-114-line-adaptation.md` (major ×4); repository README en/zh v14
rows + v13 archived snapshots (`README-1.13.0.md` / `README-zh-1.13.0.md`) + 1.14 feature prose +
`@1.14` upgrade command; CLI package README scoped to the v14 line (release README law); CLAUDE.md
session pointer to `openspec-1.14.0-report.md`; AGENTS.md v14 architecture decision + submodule pin
line (v14 `94ca9c1e`, v1.13.2 `db23097` into historical pins).

Full-gate residue caught by `pnpm test:ci`: `opsx-kernel-cli-projection.test.ts` was outside every
slice list (hand-written fake CLI, not the pinned fixture matrix). Its admitted/retired fixture
versions still modeled the v13 window (`'1.12.0' | '1.13.0'`), so the rotated compat gate derived
all-false batch/findings capabilities and the batch status transport fell back to per-change serial
spawns — 7 real failures (exactly the gate-leak the file promises to fail loudly). Rotated to
`'1.13.0' | '1.14.0'` (types, call sites, fake guards `startsWith('1.14')`, prose, header); file
green 85/85. Lesson recorded: capability-gated tests with hand-written version fixtures rotate with
the window even when they consume no pinned alias; `test:ci`'s `pnpm -r` recursion stops at the
first failing package, so a core failure masks server/web — full re-run required after any fix.

### Full-gate final state (2026-10-02)

- `pnpm format:check` — pass. `pnpm lint:ci` — 0 errors (6 pre-existing warnings).
- `pnpm typecheck` — all packages pass.
- `pnpm test:ci` — green after the two hand-written-fixture rotations (root scripts 20+2 skipped,
  cli 2, core 84+1 skipped, server 100+2 skipped, web 195, app 68, xterm 7).
- `pnpm test:browser:ci` — run 2 hit a load-sensitive xterm storybook flake
  (`virtual-trackpad-tab` Pixi canvas null on a parallel browser run); isolated rerun of that file
  passed, and run 3 of the full browser gate passed clean (exit 0, all suites). Pre-existing
  flake disclosed, not papered over.
- SSG static minimal set (`entry-client-static` + `static-data-provider.opsx`) — pass (no
  static-surface changes in this line beyond shared projections).

### Round-F implementation review disposition + fixes (2026-10-02)

Codex Round-F (herdr v14-change-reviewer, report /tmp/v14-implementation-review.md): **7.8/10 REVISE**,
three blockers — all accepted and fixed in the worktree:

- **F-B1 `archived` lost at the Planning projection boundary (real bug, independently reproduced by
  the reviewer).** The `opsx-change-list` entry schema in `planning-cli-projection.ts` listed only
  five members, so `PlanningCliProjectionDataSchema.parse` stripped the CLI-contract `archived` fact.
  Fixed by adding `archived: z.boolean().optional()` with the absent-when-default law documented,
  plus three projection assertions (true from `--archived`, mixed false/true from `--all`, absent
  and unsynthesized on the default active-only list). The Server service reuses the same core schema
  (no independent mirror), so the boundary parse now retains the member; the Round-F B2 transport
  suite below exercises the real Server parse path.
- **F-B2 Server-visible status-warnings transport evidence missing.** research-plan Slice 2 promised
  real-payload → kernel → Server-visible output on single AND batch paths, but only Core kernel and
  Web component tests existed. Added a real-kernel describe in
  `planning-cli-projection-service.test.ts`: fake 1.14 executable → real `CliExecutor` → real
  `OpsxKernel` (`projectWorkflowStatus` included) → real `PlanningCliProjectionService` — asserting
  the verbatim executed `skip_design` warning on single `opsx-status` and batch `opsx-status-list`
  Server reads, and absent-without-synthesis on clean entries. Mutation red proven: removing the
  kernel `warnings` copy fails the two warning-presence tests (2 failed | 1 passed — the absent case
  legitimately passes without the copy); restored, all green.
- **F-B3 governance drift.** Release README law "(v12 today…)" → v14 window; Pinned CLI clean-build
  law current pin → v14 `v1.14.0` / full SHA `94ca9c1eb15d1b49c06c988419b75c3d95f8b2b5`; research-plan
  README row `@^13` → `@^14`. rg audit: no `v12 today` / current-line `v13: v1.13.2` remains in
  active governance text.

Non-blocking notes taken for record (not blocking delivery): schema refinements for `line`/
`sourcePath`, spec title "three-valued" wording in the config-center delta heading, a Server
`spec.document` show-name forward test, and `StatusWarningsNotice` key stability under duplicate
warning strings. The Owner walkthrough boundary is unchanged.

Verification: projection suite + kernel warnings suite + service suite green; core tsc clean;
kernel mutation fully restored (`git diff` empty on opsx-kernel.ts).

### Round-G narrow re-check (herdr v14-change-reviewer, 2026-10-02, commit e133e58a) — 9.2/10, APPROVE

F-B1 closed (shared PlanningCliProjectionDataSchema retains `entries[].archived` with the three-state
law; Server reuses the same schema — no second mirror; reviewer independently re-ran the projection +
kernel suites). F-B2 closed (real-kernel transport suite proves the verbatim warning on single and
batch Server outputs; mutation-red record consistent; no kernel residue). F-B3 closed (governance
current-line facts rotated; rg audit clean; Core tsc independently green). No blockers; disposition
APPROVE — deliverable. Report appended to /tmp/v14-implementation-review.md (Round-G section).

Review arc: planning A-E 6.2 → 7.4 → 7.8 → 8.1 → 9.1 GO; implementation F 7.8 REVISE → G 9.2 APPROVE.
