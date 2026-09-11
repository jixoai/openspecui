<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Track live implementation state, review rounds, and evidence for OpenSpecUI 13.
2. Record the subagent topology and the integrator-owned shared-file rule.
3. Keep the header law visible to every implementation agent.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpecUI 13 implementation state

## Current state

- CP0 done: worktree + submodule pin (`9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`) + evidence report + change
  artifacts; Codex Round-A (5.8 REVISE) folded; Round-B (8.7 APPROVE WITH NON-BLOCKING NOTES) recorded.
- Batch A done (Slices 1, 2, 4): committed after integrator review of the three subagent reports.
  - Slice 1: compat window/constants + diagnose-runner mirror (+test, boundary assertions) +
    setup-example mirror. Real red: 5 failing compat assertions recorded (`/tmp/slice1-red-compat.log`).
    Green: compat 10/10, diagnose 3 passed | 1 win32-only skip, core tsc clean.
  - Slice 2: Apply contract chain (workflow schema, opsx-types input/projection schemas, focused projection
    test; planning-cli-projection needs zero production change — pass-through is structural). Real red:
    `warnings` dropped by projection schema (`/tmp/slice2-red-run.log`). Green: 48/48 across 3 files, tsc
    clean. Fact correction folded into the report: the real ready-state stdout omits `missingArtifacts`
    (upstream JSON.stringify drops empty-valued keys) — optional, never null.
  - Slice 4: registry series `'1.13'` + provenance union retains `'1.12'` (SourceCraft `minCliSeries`
    untouched); pinned generator `1.13.0`. Real red: 2 staleness assertions (`/tmp/slice4-red-tool-init-state.log`).
    Green: registry/state 78/78, server projection 8/8 (+ new retired-1.12 test), integrations 9/9,
    tool-subscription 4/5 — the remaining red is `tool-subscription-router.test.ts:674` expecting
    `@fission-ai/openspec@1.12`, which is Slice 6's owner (natural red preserved).
- Environment notes from Batch A (all three agents): `pnpm --filter <pkg> test -- <file>` does NOT filter —
  vitest (cac) drops the `--` args and the full suite runs. Use `pnpm --filter <pkg> exec vitest run <file>`
  for focused gates. The reference submodule needed `pnpm install --frozen-lockfile && node build.js` once
  for `dist/cli/index.js` (untracked build output). Known unrelated failures: `path-realpath.test.ts`
  macOS `/var` flake (pre-existing on main) and environment-load CLI probe timeouts under parallel full
  suites (not seen with focused runs).
- `agent-command-content.ts:33` still comments "admitted 1.12 generator" — assigned to Slice 5 as a
  drive-by comment correction.
- Batch B done (Slices 3, 5, 6):
  - Slice 3: render owners locked — `change-view.tsx` (status region + `hasDirectStatus` gate) and
    `apply-progress-notice.tsx` (direct-plane warnings block with CLI provenance, neutral build-order block
    with `role="status"`, divergence preserved). Server service/router needed zero production change
    (pass-through structural; kernel spread covers it). Real red: three TestingLibrary failures (warnings
    absent from the direct plane). Green: web 29 tests, server projection 12, router 1.13 apply case;
    web+server typechecks clean. Cross-slice fix: one crowded-drill fixture carried `version: '1.12.0'` and
    lost `requirementDiff` under the rotated window — fixture rotated to `1.13.0`.
  - Slice 5: full positive matrix migrated (9 v13 suites + `__tests__/official-cli-v13-fixtures.ts` helper);
    joint gate 13 files / 76 tests green; `--version` provenance asserted everywhere; mutation red captured
    (bins-map → 112 fails identity). Boundary suite rotated to v13-gate semantics (1.12.0 below-admitted,
    same fixture shows 1.13 fields present / 1.12 absent). 8 retired v12 positive suites deleted with
    `git diff --name-status` + orphan-scan proof; tsconfig fixture lanes rotated to the v13 includes.
    Lockfile +23 lines, installed shim verified `1.13.0`. Drive-bys: `agent-command-content.ts:33` comment;
    Batch-A leftover TS18048 (`parsed.warnings?.[0]`); missed-by-plan
    `opsx-kernel-schemas-root.fixtures.test.ts` rotated to the admitted 1.13 line (schemas-root forwarding
    proof). All mirror assertions passed with zero expectation drift — 1.13 keeps every 1.12 contract the
    suites pin.
  - Slice 6: four owner-class groups red/green — web compat copy (cli-health-gate 9 failed → 11/11), server
    evidence (router 106→107 incl. the natural red at `tool-subscription-router.test.ts:674`, change-diff
    6 failed → 9/9, findings 4 failed → 4/4, cold-start pin rotation → 1/1), web evidence (findings/archived
    fixtures rotated → 47/47), cli/scripts (constant-following green; diagnose mirror re-verified through the
    canonical root config). Zero production logic changes.
  - Integrator follow-up: `packages/web/scripts/w2-project-binding-playwright.ts` `PINNED_OPENSPEC_COMMIT`
    rotated to `9d4e5974...` (Slice 6 escalation; header updated).
- Known load-dependent flake (pre-existing, HEAD-reproduced by Slice 6): server git-scope test sits near
  its 5s budget under parallel load; re-verified green in isolation. To be re-run during the full gate
  window on a quiet machine.
- Full gates (Slice 7): `format:check`, `lint:ci`, `typecheck` green. Integrator incident, recorded
  honestly: a repo-root `prettier --write` without explicit paths reformatted 111 out-of-scope files
  (archived changes, skills docs, website, unrelated sources) — all restored via
  `git checkout --` against an explicit keep-list before commit; nothing out of scope was committed
  (verified: commits touch only change-owned files). First `test:ci` run had one environmental failure
  (`scripts/pnpm-invocation.test.mjs` 5s spawn timeout under gate load; isolated rerun green, file
  untouched by this change). First `test:browser:ci` run failed on a missing Playwright
  `chromium_headless_shell-1208` executable (machine prerequisite); installed via
  `pnpm exec playwright install chromium`. Final gates: `test:browser:ci` green; `test:ci` **78 files
  passed, 1 failed** — the single failure is `src/reactive-fs/path-realpath.test.ts` (`/var` vs
  `/private/var` TMPDIR symlink assertion), reproduced identically on **unmodified `main`** (evidence:
  `/tmp/main-realpath-flake.log`, exit 1, same assertion); disclosed in PR notes, never reported green.
- The stray-prettier incident also touched the `references/openspec` submodule working tree (caught
  because `upstream-contract-regression` reads pinned-tag source through it); restored with
  `git checkout -- .` inside the submodule, keeping the untracked `dist/` fixture build.
- Integrator follow-up during the full gate (missed-owner class, same as Slice 5's schemas-root find):
  `packages/core/src/opsx-kernel-cli-projection.test.ts` modeled the admitted session as fixture version
  `1.12.0`, so batch/findings capability derivations failed under the rotated window. Rotated the fixture
  pair to `1.13.0` admitted / `1.12.0` retired with the gate predicate `startsWith('1.13')`; both affected
  files re-verified green (21/21).

## Evidence recording rule

Every implementation round records: the slice, the production owner file(s), the precise red case as it
failed (or the honest statement that a red case could not be captured and why), the focused green command and
its result, and the commit. A claim without its command output is not evidence.

## Subagent topology

- Batches follow the slice order in `research-plan.md`; each subagent touches only its slice's file set.
- Shared files (`packages/core/package.json` devDeps, lockfile, cross-package copy, AGENTS.md, README files,
  `.changeset/`) are integrator-owned: subagents report required changes; ZCode lands them.
- Subagents never `git commit`/`git push`, never operate shared resources (dev server, herdr), and must
  report difficulties encountered plus how they resolved them (subagent feedback protocol).
- Subagents that start any long-lived process (dev server, fixture daemon) must terminate it and report the
  pid plus recovery evidence (resident-process recovery law).

## Header law reminder

Every changed TypeScript/TSX physical file, including tests, carries an accurate timestamped
orthogonal-intent/original-request header. This change's original request line is dated 2026-09-12.

## Review rounds

### Round-A review disposition (herdr v13-change-reviewer, gpt-5.6-terra xhigh, 2026-09-12) — 5.8/10, REVISE

Worked 6m 35s. Verdict: version decision and upstream facts verified sound; strict validation passes; no 1.14
pre-claim or UI-side parallel parsing found. Four blockers, all adopted:

1. **B1 Apply projection owner chain missing** → Slice 2 now owns `opsx-types.ts`
   (`ApplyInstructionsInputSchema` + `ApplyInstructionsProjectionSchema`), `opsx-types.test.ts`,
   `cli-contracts/workflow.test.ts`, and `planning-cli-projection.ts`; red is a fixed command asserting the
   ready-state payload's `warnings` is dropped by the projection schema today.
2. **B2 positive fixture matrix incomplete** → Slice 5 now migrates the complete v12 positive matrix to v13
   counterparts (workflow, default-store, nested-spec, show-diff, validation-full, validation-findings,
   batch-status, agent-delivery) plus a new apply-readiness suite; retired v12 positives are deleted with
   their counterparts; `--version` provenance asserted in every file.
3. **B3 diagnose-runner mirror test missing** → Slice 1 adds `scripts/diagnose-cli-runner.test.mjs` with
   1.12-rejected/1.13-accepted boundary assertions; green gate runs it.
4. **B4 historical scenario titles unannotated** → research-plan gains the Spec hygiene section (titles are
   scenario identity; bodies carry semantics; `minCliSeries: '1.12'` is a physical fact that does not rotate
   while `AgentCliSeries` does).

ZCode-found same-class gap (folded into Slice 5): `upstream-contract-regression.test.ts` pins the reference
commit and must rotate with the pin guard. Also verified during baseline: `path-realpath.test.ts`
`/var` vs `/private/var` failure exists on unmodified `main` (pre-existing environmental flake; recorded in
Slice 7 / PR notes, not silently skipped).

Non-blocking (all adopted): fixed red commands (n1); Slice 3 candidate render owners named with an
implementer lock-in step recorded in implementation.md (n2); lockfile-diff + installed-shim acceptance
evidence (n3); Slice 6 grouped into four owner-class red/green units (n4); report distinguishes decode
tolerance from projection compatibility (n5); CP3 gains a separate complete-matrix checkbox (n6).

Pending: Round-B re-review after these corrections.

### Round-B review disposition (herdr v13-change-reviewer, gpt-5.6-terra xhigh, 2026-09-12) — 8.7/10, APPROVE WITH NON-BLOCKING NOTES

Worked 2m 52s. Verdict: B1–B4 all materially closed (owner chains, full positive matrix, mirror-test gate,
spec-hygiene split verified against current source); strict validation re-passed; no new blockers. Disposition:
implementation may start under the CP/Slice evidence rules. Non-blocking notes, all adopted:

1. Slice 1 green gate now names a static setup-example mirror assertion (series constant check) instead of
   deferring all setup-example coverage to Slice 6 "consumers".
2. Slice 3 implementer locks the final Web render owner in this file before coding, and the three assertions
   (direct-plane warning, next-step chain, absent-field degradation) are written as separate test cases.
3. Slice 5 retirement of v12 positive suites must be proven with `git diff --name-status` against the fixture
   inventory; v12 boundary helper/tests stay executable.
4. The actual diagnose-test runner command (not the parenthesized alternative) is recorded in the slice
   report.
5. PR notes attach the unmodified-main `path-realpath.test.ts` failure output; the flake is never reported as
   a green gate.
6. This Round-B disposition recorded (this entry).
