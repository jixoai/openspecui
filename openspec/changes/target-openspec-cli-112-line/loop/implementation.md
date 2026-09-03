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
- CP1 pending: Codex change review before any production slice starts.

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
