<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Record the implementation log: slices dispatched, evidence captured, review rounds.
2. Keep every entry timestamped and falsifiable against a commit or command.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

# OpenSpec CLI 1.13.2 implementation log

## 2026-09-26 — Planning baseline (CP0)

- Worktree + branch + submodule pin + evidence report + change artifacts written (this commit).
- Upstream delta investigated against the full `v1.13.1..v1.13.2` source diff; findings recorded in
  `references/openspec-1.13.2-report.md` (P1 apply tracking evidence, P2 Kilo path, P3 glob
  recognition, P4 validation texts, P5/P6 non-obligations).
- Awaiting Codex Round-A change review before implementation freeze.

## 2026-09-26 — Codex Round-A change review (folded)

- Reviewer: codex-reviewer-1132 (gpt-5.6-terra, xhigh), 30m21s, against HEAD `fcaeb511` (clean tree).
- Verdict: planning 6/10 — upstream facts (P1-P6) and the OpenSpecUI owner map FULLY confirmed; 2 P1
  blockers, 7 P2 suggestions; implementation not yet authorized.
- P1-1: `taskTrackingConfigured === false` had no route into the direct-status mount — folded into
  research-plan Slice 2 (`hasDirectStatus` condition + `ApplyProgressNotice` input + route tests) and
  intake decision 5.
- P1-2: Slice 2 and former Slice 4 both held `opsx-types.ts` — merged into one owner/batch (Slice 2),
  slices renumbered, verification strategy updated.
- P2 folds: Kilo cleanup is an exact allowlist upstream (wildcards here are projection evidence);
  `tool-init-state` runtime cleanup boundary tests (ambiguity skip + `.kilo/command/` never
  cleanup-owned); zero-files-matched fixture; unavailable-never-all_done falsifiable spec scenario;
  glob-parity scope note (`opsxPathMatchesPattern` stays wildcard-class — fixture scope `*`-only);
  Slice 4 explicit red/green command points; upstream `docs/agent-contract.md` lag recorded as
  upstream doc drift (not our obligation).
- Next: Round-B re-review of the revised documents.

## 2026-09-26 — Codex Round-B approval (8.5/10) + residual P2 folds

- Round-B verdict: APPROVED. Both P1 blockers closed; all Round-A P2 folds verified in place; score
  6/10 -> 8.5/10. Implementation authorized.
- Residual P2 folds applied (non-blocking, documentation precision):
  - intake decision 4 rewritten: raw cleanup patterns cover only the two old-folder generations;
    `.kilo/command/` never appears; runtime `legacyCommandWorkflows` routing noted.
  - cli-integration spec Kilo scenario now distinguishes raw registry patterns from the runtime
    cleanup projection and documents the inherited wildcard-vs-upstream-allowlist evidence divergence
    (verified against `collectProjectCleanup` runtime behavior: wildcard matches are collected as
    evidence; OpenSpecUI executes no deletion).
  - Unreadable-tracking spec scenario pins the CLI-resolved `state: "ready"` so the projection
    assertion is self-contained.

## 2026-09-26 — Slices 1-4 implemented (subagent batches)

- Slice 1 (82b78539): pin rotation — npm alias + lockfile, PINNED versions/bins, every live pin-commit
  guard (prepare script, contract regression, cold-start integration, web playwright probe), CLAUDE.md
  pointer. Red: identity assertion expected 1.13.1 / received 1.13.2. Matrix green with zero assertion
  relaxations; @inquirer/core 11.2.1 -> 12.0.1 transitive.
- Slice 2 (3114132b): CliApplyInstructionsSuccessSchema + ApplyInstructions input/projection gain
  taskTrackingConfigured (optional, absence = pre-1.13.2) and unavailableTrackingFiles
  (absent-when-empty); Change Detail mounts the status region for unavailable evidence and for
  taskTrackingConfigured === false; isGlobPattern widened (extglob/brace/POSIX) in the core watcher
  mirror AND the web artifact-output-viewer local copy (subpath unification = recorded debt; the copy
  was found by the Slice-2 agent outside the brief and folded by the orchestrator). Reds: strict-schema
  member stripping, recognition classes, TestingLibrary missing regions, member-only-false
  non-mounting; the .passthrough() contract's honest red is type-level (workflow-contract-tests lane).
- Slice 3 (ec3c09bb): Kilo command pathTemplate .kilo/command/opsx-{workflow}.md + legacyPathTemplates
  + two-generation cleanup; runtime characterization proves the opsx-* pattern is ambiguity-skipped
  into legacyCommandWorkflows retirement and .kilo/command/ never appears in any cleanup result;
  consumers verified registry-driven (grep zero literal paths).
- Slice 4 (cdc4254b): executable 1.13.2 evidence — glob-tracked aggregation (5 tasks across 2 files),
  configured-but-zero-match, unreadable tracking (POSIX + root-uid guard, ready/blocked branches,
  realpath-based path expectations), kilocode fresh-init writes six .kilo/command/opsx-*.md plain
  markdown with skills still under .kilocode/skills/, TBD/TODO case rules + MODIFIED balance suffix
  asserted against the binary; AGENTS.md pin line + 2026-09-26 architecture decision; README audit
  clean (zero explicit 1.13.1 runtime claims); changeset for four packages. Self-check reds run and
  reverted (kilo path rollback, aggregation count).
- Combined verification: core 155 + web 41 + fixture matrix 23 tests green; core/web tsc clean.
