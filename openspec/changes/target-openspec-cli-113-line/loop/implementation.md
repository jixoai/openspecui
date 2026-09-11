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
  artifacts, on branch `target-openspec-cli-113-line` (uncommitted until the Codex change review round lands).
- Slices: not started.

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
