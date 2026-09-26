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

## 2026-09-26 — Vision-subagent ego-browser E2E walkthrough (CP5, preparation evidence)

- Agent: vision subagent with ego-browser against the real server (worktree build, isolated
  HOME/XDG, scratch project /tmp/openspecui-1132-walkthrough, port 4173, PATH pinned to the
  worktree's openspec-cli-113 bin after an initial system-openspec 1.4.1 mismatch dialog).
- Precheck against the pinned 1.13.2 binary: walk-glob `taskTrackingConfigured:true`, no
  unavailable key, progress 2/5; walk-blocked one unavailable entry (verbatim /private/tmp
  realpath + EACCES reason), progress 1/2, state ready; walk-untracked `false`, empty tasks.
- All five scenarios PASS: changes list (aggregated 2/5 row), walk-glob detail (aggregated
  badge + two matched files, no fabricated status region), walk-blocked detail (full-width
  amber region, verbatim path/reason including the /private/tmp prefix, CSS-verified amber
  tokens, 420px no-horizontal-overflow), walk-untracked detail (muted "tracks no tasks" note,
  no blocked semantics, no fabricated 0/0 progress claim), regression smoke (board four lanes,
  config overview, 0 console errors across 7 routes with a self-tested CDP hook).
- Black-image defense executed on all 9 screenshots (unique colors 486-1099, non-black >98.8%).
- Three P3 observations recorded for the Owner's final walkthrough: 0/0 badge wording beside
  the no-tracking note (list row + header badge), board cards showing bare 1/2 counts, and
  unavailable evidence living only on the Change Detail direct plane (spec-scoped).
- Processes reaped (pids recorded, port verified free, chmod 000 -> 600 restored); artifacts
  kept under /tmp/openspecui-1132-walkthrough/ for Owner review.
- Friction feedback (writeback blocked by sandbox on the skill file; recorded here for the
  Owner): ego-browser `page.events()` does not buffer console events — console collection
  needs a CDP `Page.addScriptToEvaluateOnNewDocument` hook with a self-test; walkthrough
  recipes must pin PATH to the worktree's pinned CLI bin to avoid the system-openspec
  version-mismatch dialog.

## 2026-09-26 — Codex Round-C implementation review (7.5/10) + folds

- Reviewer ran the required focused suites plus a destructive spot-check (temporarily removed the
  member-only-false mount condition, saw the red, restored, re-green). No leftover tree changes.
- P1 fixed: `packages/web/scripts/w2-project-binding-playwright.ts` version assertion stayed
  `1.12.0` while its SHA constant rotated — assertion + header now `1.13.2`; the script's pinned
  bin is the submodule source (`references/openspec/bin/openspec.js`, `--version` = 1.13.2
  verified). Root cause of the miss: the Slice-1 grep audit pattern `1\.13\.1` could not catch a
  stale older literal.
- P2 folds: AGENTS.md pinned-clean-build law examples rotated to v13/v1.13.2/db23097; web
  artifact-output-viewer gained direct brace/extglob/Windows parity cases (10/10 green); the
  no-tracking note wording now says "no apply.tracks configured" (was "empty apply.tracks");
  changeset typo expglob -> extglob.
- Not folded (recorded as accepted): in-window decode fixtures keep `1.13.1` literals by design
  (cli-health-gate proves older admitted patches pass the gate).

## 2026-09-26 — Codex Round-D approval (9.0/10)

- Round-D verified every Round-C fold in dbfe805c (W2 version/SHA consistency, AGENTS.md law
  rotation, viewer parity tests, note wording, changeset spelling) and re-ran the three web suites
  (45 tests green). Verdict: APPROVED for full gates and PR; score 7.5 -> 9.0.
- The "uncommitted working-tree change" it observed (two-line type guard in
  official-cli-v13-validation-findings-fixtures.test.ts) was the union-narrowing fix the full
  typecheck gate surfaced after Round-C; committed separately as 58f1cd48 with the
  transpile-vs-typecheck-lane explanation and the affected suite re-green (6/6).
- Gate status at this point: format:check PASS, lint:ci PASS (0 errors), typecheck PASS (all
  lanes, after 58f1cd48); test:ci running; browser:ci queued.
