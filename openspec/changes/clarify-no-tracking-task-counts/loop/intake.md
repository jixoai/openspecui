<!--
Orthogonal intents (created 2026-09-27 Asia/Shanghai):
1. Record the Owner-walkthrough P3 adjudication and its rulings (fix / reject) with rationale.
2. Keep the delivered update-openspec-cli-1132 semantics untouched (presentation-only change).

Original request (2026-09-27): "我目前看没有致命问题，剩余裁决你和 codex 讨论，完成工作收尾"
-->

# clarify-no-tracking-task-counts intake

## Adjudication record (2026-09-27)

Owner's final walkthrough of update-openspec-cli-1132: no fatal issues. Three P3 observations went
to joint adjudication. The Codex channel was hard-down (local gateway 502 on every attempt,
confirmed by direct probe), so per the standing substitution rule an independent super-thinker
reviewer executed the adjudication against the real repository code; rulings below are joint
(ZCode + that reviewer).

| P3 | Ruling | Essence |
| --- | --- | --- |
| 1 — Detail `0/0` badge beside the no-tracking note | **Fix** | Badge keeps literal CLI numbers, lowers tone, appends qualification to aria/tooltip; gated strictly on `taskTrackingConfigured === false` (never absent). Data already in hand (`change-view.tsx` holds the member); presentation only. |
| 2 — Board card lacks unavailable-tracking hint | **Reject** | Unavailable evidence is a decision fact owned by the Change Detail direct plane (delivered spec's design, not an omission); the list/Kanban payload carries no `unavailableTrackingFiles`, so a fix needs per-change apply subscriptions — cost/benefit inverted, and it would push decision facts onto a scan surface against the OPSX-first hierarchy law. Revisit only if upstream `list` ever aggregates tracking-evidence summaries. |
| 3 — Changes row `Tasks 0/0` for no-tracking schemas | **Fix** | `cliTaskSummary.status === 'no-tasks' && totalTasks === 0` renders muted `No tasks`; tooltip keeps the upstream ambiguity verbatim (list cannot distinguish unconfigured `apply.tracks` from an empty tracked list — the wording must not assert either). Board cards unchanged (lane placement already carries the phase). |

## Non-Goals

- No schema/projection/gating change: `opsx-types.ts`, CLI contracts, `createApplyInstructionProgress`
  untouched; numbers stay CLI-owned (2026-08-18 law).
- Board/Kanban cards unchanged (Kanban projection law; P3-2 rejected).
- No change to the archived update-openspec-cli-1132 or its spec.

## Acceptance boundary

Focused web tests + typecheck + the repo's changed-file format/lint gates; Owner visual pass is
already covered by the walkthrough that produced these P3s (badge/list states are the same pages).
