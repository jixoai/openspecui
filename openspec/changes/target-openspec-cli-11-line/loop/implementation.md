<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Track slice-level implementation gates and their evidence.
2. Record the subagent batch topology and shared-file exclusions.
3. Keep the review loop (Codex change review -> implement -> Codex code review) auditable.

Original request (2026-08-28): "等敲定任务之后，你开始调用子代理推进所有工作"
-->

# OpenSpecUI 11 implementation state

## Current state

```text
R0  reference + report            DONE   v1.11.0 pinned; references/openspec-1.11.0-report.md (executed evidence)
R1  change authored              DONE   intake / research-plan / specs deltas; Owner-default decisions recorded
R2  Codex change review          DONE   4/10 -> 6.5/10 -> 8.5/10 across three rounds; Batch A approved
R3  slice 1 compat gate          DONE   P0 constants+capabilities (ZCode); A1 tests/mirrors/web copy;
                                 integrator fixed cli-health-gate.test.tsx (11/11) and
                                 archived-validation-evidence.test.tsx (8/8) to the v11 law
R4  slice 2 CLI contracts        DONE   A2: batch-status.ts + show-diff.ts + executor methods + language
                                 passthrough; 41 contract tests green; barrel exports applied by integrator
R5  slice 3 agent registry       DONE   A3: series '1.10'|'1.11', zed entry, antigravity per-series override,
                                 series-aware staleness, opencode equivalence; 83 tests green; core barrel
                                 exports applied by integrator
R6  slice 4 pinned fixtures      DONE   B1: official-cli-v11-fixtures helper + 6 test matrices (batch/show-diff/
                                 workflow/validation/default-store/nested-spec), 19-* converted, upstream
                                 regression re-pinned to a0ddb60; integrator moved tsconfig lanes to the v11
                                 files (typed test-evidence law caught one union-narrowing error, fixed by
                                 parsing the success schema directly) and deleted the unreferenced v9 helper
R7  slice 5 batch transport      DONE   B2: capability-gated single-spawn fetchStatusList with shared
                                 projectWorkflowStatus/settleStatusArtifactDeps, per-change failure fallback
                                 spawn, opsx-status-list Work identity preserved; 21 kernel/projection tests
                                 green. Accepted semantic: batch mode's Work evidence is the status --all
                                 command evidence; failure/missing entries fall back to one serial spawn
R8  slice 6 server/web surfaces  DONE   C1: change-diff-evidence-service + router.diffEvidence + Change Detail
                                 Evidence-tab diff/warning disclosure; agent projection 1.10/1.11 series tests;
                                 Purpose-placeholder rendering locked. Integrator fixed the stale
                                 archived-validation gate copy + router.test fixture (106/106) and exported the
                                 diff/batch contract types from the Core barrel
R9  slice 7 release prep         DONE   C2: README/README-zh/packages-cli README v11 + README-1.9.0 archives +
                                 major changeset (fixed group, 12 packages). Release-time TODO recorded: bump
                                 the fixed-group base to 10.x before changeversion so major lands on 11.0.0
Gates (2026-08-28): format:check PASS; lint:ci PASS; typecheck PASS (all packages incl. website);
test:ci green except the pre-existing macOS /private/var path-realpath environmental failure
(reactive-fs untouched by this Change; CI runs on Linux/Windows where it passes); test:browser:ci
PASS (exit 0) run through a controlled herdr pane per heavy-load discipline. Integrator also fixed a
third mirror-constant site scripts/diagnose-cli-runner.mjs caught by the root gate.
R10 Codex code review loop       DONE (7.0/10 -> 8.0/10 -> 9.5/10 final; PR-ready verdict confirmed
                                 2026-08-28 by herdr `v11-change-reviewer`)
R11 archive + delivery           PENDING  Owner-gated

## Code-review disposition (herdr `v11-change-reviewer`, 2026-08-28)

- Round 1 (7.0/10): boundary blocker (residue cleanup inside the branch) fixed by splitting it onto
  `chore/spec-residue-cleanup`; M1 generator evidence moved to pinned 1.10/1.11 runners (historical 1.8
  unavailability sample kept explicitly labeled; unreferenced openspec-cli-19 alias removed); M2 headers and
  stale user copy refreshed; minors fixed (MODIFIED-only superRefine + negatives, line-anchored opencode
  strip + fake-equivalence negative, local timeout waiver reverted).
- Convergence (8.0/10): caught `agent-integrations-router.test.ts` still pinned to 1.9 — fixed, plus a
  proactive sweep repinned the Root Context cold-start integration (a0ddb60) and the tool-subscription
  fixtures. Final per-package evidence: core 729 passed (1 pre-existing macOS /private/var environmental
  failure, reproduced identically on a clean main worktree), server 649/649, web 1164/1164, app 384/384,
  cli 174/174, search 6/6, translators + website green; format/lint/typecheck green; browser CI green.
```

## Evidence recording rule

Each gate appends, when it turns DONE: the touched files, the focused test command(s) actually run, and any
deviation from the ordered slice. A gate may not turn DONE on a subagent self-report alone; the integrator
re-runs the focused owner test locally before recording it.

## Round-1 review disposition (herdr `v11-change-reviewer`, gpt-5.6-terra xhigh, 2026-08-28, 4/10)

Accepted and fixed:

- B1 duplicate `## MODIFIED Requirements` sections in one delta file silently dropped the first block
  (verified against the upstream parser's same-title section overwrite). Both restructured delta files now
  use at most one section per kind.
- B2 requirements that do not exist in the main spec were re-filed under `## ADDED Requirements`
  (`MODIFIED Delta Diff Evidence Surface`, `Generator Evidence Follows the Admitted CLI`).
- Antigravity root migration corrected to 1.11-only (1.10 keeps `.agent` current); report, plan, and
  config-center delta now encode the series split.
- Report wording: healthy batch entries are field-identical (no per-entry root); `postinstall` removed while
  `prepare`/`prepublishOnly` remain; opencode injection text `**Provided arguments**: $ARGUMENTS`; stale
  upstream in-source comment flagged as documentation drift.
- Slices 2/3/4/5/6 enriched with the reviewer's concrete red cases (requireCommandData exit-code gate,
  per-series registry snapshots, series-aware generated-by comparison, fixture mechanics + pinned-commit
  update, end-to-end diff data chain).
- Spec hygiene deltas added: `Explicit Planning Completion Projection`, `Schema Resolution JSON Sum Type`,
  `Archived Validation Evidence`.

Rejected (with reason):

- Renaming legacy scenario titles such as `Accept the adapted 1.7 line` to `Block retired ...` — the
  upstream scenario-loss guard forbids dropping or renaming scenarios inside a MODIFIED block; carrying the
  historical name with a current-law body is the established mechanic (v9 precedent). Reviewer round 2
  endorsed the rejection and asked for an explanatory note; the delta headers now carry it.

## Round-2 review disposition (6.5/10)

- research-plan internal contradictions fixed (healthy-entry root wording; lifecycle scripts wording).
- Main-spec stale semantics fully swept: `OPSX Command Mapping` and `CLI-backed Config Data Queries` gained
  v11 MODIFIED deltas (selector and archived validation now on both admitted lines; retired 1.8 branches
  recorded as historical scenario bodies).
- `JSON Stream Discipline` scenario now pins both 1.10.0 and 1.11.0 executables.
- CP3 rewritten with the real fixture-helper/test layout and an explicit not-executable-until-created note
  (B6 residual).
- B4 residual accepted as implementation-phase scope: slice 6 names the concrete owners
  (`document-service.ts` projection input and the Change Detail delta surface) where the diff field lands;
  the exact field names are settled by the implementing slice's focused tests.

## Round-3 review disposition (8.5/10)

- Verdict: no change-level blockers; Batch A approved.
- Pre-flight addition applied: the Agent inventory scenario now carries the per-target assertions for
  Command Code, MiniMax Code, Rovo Dev CLI, and Shared `.agents` skills on the admitted lines.
- Remaining deductions are implementation-phase by design (batch decoder, requireCommandData bypass,
  diff evidence chain, series-aware generated-by tests are planned but have no code evidence yet).

## Subagent topology

```text
Pre-flight (integrator-owned anchor)
  P0  openspec-compat.ts constants + capability fields   ZCode (every batch consumes these types)

Batch A (parallel, disjoint files)
  A1  compat tests + setup-example mirror + web copy    openspec-compat.test.ts, scripts/setup-example.ts,
                                                         web cli-health-gate / settings copy
  A2  core cli-contracts + executor                     packages/core/src/cli-contracts/*, cli-executor.ts (+ tests)
  A3  core agent registry                               packages/core/src/agent-delivery-registry.ts,
                                                         tool-init-state.ts, agent-command-content.ts (+ tests)

Batch B (after A)
  B1  fixtures + package.json                           core package.json devDeps, __tests__ fixture helper,
                                                         official-cli-v11-* tests, upstream-contract-regression
  B2  batch transport                                    packages/core/src/opsx-kernel.ts, cli-projection-sequence.ts
                                                         (+ tests)

Batch C (after B)
  C1  web surfaces                                       change-detail diff evidence, config-agents copy,
                                                         archived-validation/planning-completion wording (+ tests)
  C2  release prep                                       README.md, README-zh.md, packages/cli/README.md, .changeset/

Shared-file rule: package.json, pnpm-lock.yaml, .changeset/, openspec/* are integrator-only. Subagents report
required changes; the integrator applies them. No subagent commits or pushes.
```

## Header law reminder

Every changed TypeScript/TSX file (production and test) carries a current timestamped orthogonal-intent header
including the original request line for this Change. A production-only audit is incomplete.
