<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Track live implementation state, review rounds, and evidence for OpenSpecUI 12.
2. Record the subagent topology and the integrator-owned shared-file rule.
3. Keep the header law visible to every implementation agent.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

# OpenSpecUI 12 implementation state

## Current state

- CP0 done: worktree + submodule pin (`e062b9572be933564ba3899d059377dfa1393e32`) + pin guards + evidence
  report + change artifacts, committed on `target-openspec-cli-112-line`.
- CP1..CP4 done and CP5 gates recorded below; see checkpoints.md and the dispositions in this file.

## Evidence recording rule

Every implementation round records: the slice, the production owner file(s), the precise red case as it
failed (or the honest statement that a red case could not be captured and why), the focused green command and
its result, and the commit. A claim without its command output is not evidence.

## Subagent topology

- Batches follow the slice order in `research-plan.md`; each subagent touches only its slice's file set.
- Shared files (`packages/core/package.json` devDeps, lockfile, cross-package copy, AGENTS.md, README files,
  `.changeset/`) are integrator-owned: subagents report required changes; ZCode lands them.
- Subagents never `git commit`/`git push`, never operate shared resources (dev server, herdr), and must
  report difficulties encountered plus how they resolved them.

## Header law reminder

Every changed TypeScript/TSX physical file, including tests, carries an accurate timestamped
orthogonal-intent/original-request header. This change's original request line is dated 2026-09-03.

## Review rounds

(round dispositions recorded here as reviews complete)

## Round-A review disposition (herdr v12-change-reviewer, gpt-5.6-terra xhigh, 2026-09-03) — 6/10

Worked 1h 28m. Verdict: strong version decision and mostly reliable research, but five pre-implementation
blockers. Disposition of every finding:

Blocking (all adopted):
1. Slice 1 missed `scripts/diagnose-cli-runner.mjs` (+ test) `OPENSPEC_CLI_TARGET_SERIES = '1.11'` mirror →
   added to the current-state inventory, Slice 1 owners, red/green cases.
2. Missing MODIFIED `OPSX Command Mapping` delta → added, complete with all 11 scenarios preserved and 1.12
   semantics (capability-gated availability wording).
3. Missing MODIFIED `Kernel-First OPSX Read Model` / `Explicit Planning Completion Projection` /
   `MODIFIED Delta Diff Evidence Surface` deltas → added, scenario-preserving, capability wording.
4. Slice 4 red case ("a hand-authored payload proves a 1.12 behavior") was not executable → replaced with the
   honest absence red plus a post-implementation mutation red (bins-map -> 111 alias fails the `--version`
   identity assertion).
5. Report promised "findings JSON (below)" without the payload → the executed populated findings document is
   now embedded verbatim.

Non-blocking (all adopted): exact already-reported filter documented (ERROR paths + missing-header +
empty-section; WARNING excluded); 11+11 count qualified as a fixture fact with init config stated; `.gitkeep`
anchors distinguished from the store-created-path ledger (init passes an empty ledger); Slice 6 names the
`cli.validate` router boundary and server integration tests; Slice 7 names the fixed changesets group and a
`11.1.0 -> 12.0.0` dry run; `README-zh-*.md` narrowed to the current `README-zh.md`; `AgentProvenanceCliSeries`
historical union retention recorded in decision 5; scenario-title preservation note added to decision 9;
"byte-compatible" softened to "envelope/schema-compatible".

Pending: Round-B re-review after these corrections.

## Round-B review disposition (herdr v12-change-reviewer, gpt-5.6-terra xhigh, 2026-09-03) — 8/10 (up from 6)

Worked 38m. Verdict: all five Round-A blockers materially addressed; strict validation passes; scenario
preservation verified (OPSX Mapping 11/11, kernel 4/4, planning 1/1, diff 2/2, Agent inventory + SourceCraft,
static evidence + findings). BLOCKING: none. All eight non-blocking suggestions adopted:

1. 11+11 artifact count was not reproducible: an isolated default-profile run generates 6 skills + 6
   commands (verified independently by ZCode with isolated `XDG_CONFIG_HOME`/`XDG_DATA_HOME`; the original
   observation was contaminated by a machine-global custom profile). Report and plan now state the
   profile-dependent count with the isolated 6+6 default fact; fixtures must pin the profile context.
2. Plan "byte-compatible" -> envelope/schema-compatible.
3. Plan no longer claims init anchors join the created-path ledger (init passes an empty ledger).
4. CP6 narrowed to `README-zh.md` and now carries the fixed-group + `11.1.0 -> 12.0.0` dry-run requirement.
5. Slice 6 names the focused server `cli.validate` integration-test command.
6. `cli-health-gate.tsx` copy ownership clarified (Slice 1 owns content; Slice 6 only re-verifies); Slice 4's
   devDep edit marked integrator-owned.
7. Report sources now include `src/commands/change.ts`.
8. Report full-report row softened to shape-compatible.

Change review is closed at 8/10 with no blockers; implementation batches may start.

## Batch A disposition (2026-09-04, commit 9e0b0383)

Four parallel subagents, non-overlapping file sets, all integrator-verified (diffs cross-checked; focused
gates independently rerun): A1 compat gate + mirrors + UI copy (10 files; executed red via temporary
pre-change restore); A2 Agent registry/staleness (6 files; 40-tool 1.12 inventory, provenance union kept,
baseline-subset methodology); A3 v12 fixture helper (152 lines, v11-parity exports, both-XDG isolation
rationale); A4 findings contracts + argv (schema beside full report, unknown-param guard, stash-based red).

## Batch B disposition (2026-09-04, commit d782c98e)

B1 fixture matrix: 8 new suites / 24 tests, 5 v11 suites deleted, mutation red executed (bins-map ->
111 alias fails identity assert). B2 kernel: readValidationFindingsProjection behind the findingsReport
capability gate (mutation red: without the gate the retired 1.11 fixture received --report argv); 5 stale
kernel tests rebased; schemas-root fixtures re-pointed to the pinned 1.12 bin. B3 server+web: cli.validate
findings union member + server capability gate + 4 router tests; 12 in-set server reds fixed; new
validation-findings-evidence web surface (10 tests) + evidence-workspace section; evidence-component windows
rotated. B3's three out-of-set core additions (compat subpath re-exports, barrel types, widened guard param)
were integrator-reviewed and accepted.

Integrator follow-ups landed with Batch B: typed-lane tsconfig rewiring; rotation-caused server anchors
(router archived-validation fixture, tool-subscription install-stream/generatedBy, cold-start 1.12
expectations); change-diff-evidence-service stale comments.

## Broad gates (2026-09-04)

- format:check PASS; lint:ci PASS (2 pre-existing warnings); typecheck PASS (all packages + scripts).
- core: 746/747 — sole failure is the pre-existing macOS `/var` vs `/private/var` path-realpath
  environmental failure (fails identically on clean main).
- server: all v12-domain suites green; remaining failures fluctuate (9-17 across runs) exclusively inside
  the git-subprocess/shutdown timing family (server-startup, router git/dashboard-stamp,
  git-repository-binding-*) that fails with shifting membership identically on clean main (11 there);
  zero failures in validate/findings/agent/cold-start domains.
- web 1194/1194; app 384/384; search/website/translators/ai-provider all green; cli and
  xterm-input-panel have no unit-test script (browser lanes cover xterm).
- test:browser:ci: PASS (exit 0) — xterm/app/web browser lanes: 63 passed +1 skipped, 10, 18, 12.

## Code review round 1 (herdr v12-code-reviewer, gpt-5.6-terra xhigh, 2026-09-04) — 5/10

Worked 2h 37m. Seven blockers (all verified by Codex direct probes and re-verified by ZCode before repair):

1. w2-project-binding-playwright.ts version assertion still `1.11.0` -> deterministic gate failure. FIXED
   (integrator): assertion now `1.12.0`. Gate rerun: the version probe passes and the fixture reaches the
   app; the remaining `#project-binding-store` 20s wait timeout reproduces IDENTICALLY on clean main
   (pre-existing environmental Playwright failure on this machine, documented for PR notes), so the
   rotation-caused portion of blocker 1 is closed.
2. CliValidateFindingsSchema accepted `returnedItems > totalItems` and empty `itemFindings[].issues`.
   FIXED (C1): schema refinements + adversarial tests.
3. isCliValidateFindings classified by `'report' in result` alone (stray-key misclassification). FIXED
   (C1): discriminator-validating guard + negative test.
4. Executor emitted `--report findings` with no capability check (argv owner unenforced). FIXED (C1):
   gated `validateFindings` surface mirroring workflowStatusAll's capabilities-pick refusal, cascade to
   kernel + router.
5. official-cli-v11-workflow-fixtures.test.ts remained a positive suite in the accepted typed lane.
   FIXED (C3): coverage ported to official-cli-v12-workflow-fixtures.test.ts on the pinned 1.12.0
   executable; v11 file deleted (boundary negatives already live in the v12 boundary suite).
6. AGENTS.md pinned clean-build law still named v1.7.0/4e16790d (third stale statement). FIXED
   (integrator): law now follows the newest report's pin.
7. Release docs: AGENTS release-law "(v9 today)", cli README v11 identity, "both admitted lines".
   FIXED (integrator): v12 single-series wording everywhere.

Non-blocking adopted: barrel runtime exports of findings schemas/guard (C1); typed mock replacing
`as unknown as never` (integrator); stale v11 headers refreshed (integrator + C1); marker-symlink
pinned anchor case (C3); implementation.md CP1 contradiction (integrator).

Pending: round-2 re-review after C1/C3 land.

## Code review round 2 (herdr v12-code-reviewer, 2026-09-04) — 9.0/10 (+4.0)

Worked 6m (reviewer re-ran the focused evidence itself: core 78/78, server findings router 4/4,
core/server/web typechecks). BLOCKING: none. All seven round-1 blockers confirmed closed, including the
fixture-role disposition (positive workflow coverage on pinned 1.12; only the v11 --report boundary fixture
retained, accepted under the single-series decision). W2 note: the reviewer's own run cleared the corrected
version assertion and reached server launch, then hit workstation EMFILE before the known pre-existing
Playwright timeout; the rotation-caused portion is closed.

Both round-2 non-blocking suggestions adopted (integrator): packages/cli/README.md header intent line now
v12 (the earlier fix had silently missed — prefix mismatch); the change-diff mock is now a genuinely typed
vi.fn wrapping a precisely-typed async function (no double assertion).

Review loop closed at 9.0/10 with zero blockers.
