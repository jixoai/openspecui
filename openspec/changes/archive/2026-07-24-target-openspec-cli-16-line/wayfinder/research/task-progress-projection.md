<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Define the OpenSpec-owned task progress that drives workflow state.
2. Preserve document-wide checklist statistics as a secondary projection.
3. Preserve the upstream apply-instructions divergence with explicit provenance.
4. Assign each projection to product surfaces without ambiguous shared naming.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
Original request (2026-07-15): "统计信息仍然有一定的间接价值。"
-->

# Task progress projection

## Source boundary

OpenSpec 1.6 defines formal task progress by selecting the artifact whose `generates` equals `apply.tracks`, expanding that artifact's output glob, and aggregating checkboxes only across the matched files. When schema or artifact resolution fails or matches nothing, it falls back to top-level `tasks.md`.

OpenSpecUI 3.12 intentionally broadened its older `tasks.md` parser to every schema artifact Markdown source. That fixed custom-schema `0/0` results and remains useful as planning statistics, but it is broader than the OpenSpec 1.6 workflow metric.

## Resolved model

```text
OpenSpec tracked artifact glob
        |
        `-> trackedTaskProgress ----------> workflow truth

all schema-document checkboxes
        |
        `-> documentChecklistSummary -----> secondary analytics

instructions apply --json
        |
        `-> applyInstructionProgress -----> attributed execution context
```

### `trackedTaskProgress`

- Select exactly the OpenSpec tracked artifact, then aggregate every file matched by that artifact's output glob.
- Drive Change List and Dashboard task counts, workflow-phase task input, completion notifications, and primary Tasks UI.
- Represent zero tasks as `no-tasks`. Completion requires `total > 0 && completed === total`.
- Never independently declare archive readiness; validate/archive CLI outcomes remain authoritative.

### `documentChecklistSummary`

- Aggregate checkboxes across schema document outputs, deduplicated by physical file and grouped by artifact/file when schema provenance is available.
- Preserve total, completed, and remaining counts as indirect evidence of planning volume and residual checklist items.
- Show a compact secondary summary in Change Detail and optional lower-priority Dashboard analytics, with a disclosure for per-document breakdown.
- Do not drive workflow phase, readiness, notifications, primary progress bars, or filtering that claims a change is incomplete.

### `applyInstructionProgress`

- Preserve the raw progress and state returned by `openspec instructions apply --json` on the Apply surface.
- OpenSpec 1.6 currently reads `apply.tracks` there as one literal path, while list/view/archive expand the tracked artifact glob.
- When it differs from `trackedTaskProgress`, show both with source attribution and a non-fatal upstream-divergence diagnostic. Never overwrite either value with the other.

## Surface assignment

| Surface                    | Primary fact                                 | Secondary fact                                  |
| -------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Change List                | `trackedTaskProgress`                        | None                                            |
| Dashboard workflow summary | `trackedTaskProgress`                        | Optional separate document-checklist analytics  |
| Change Detail header       | `trackedTaskProgress`                        | Compact `documentChecklistSummary`              |
| Tasks view                 | Tracked task files and items                 | Per-document checklist disclosure               |
| Apply                      | `applyInstructionProgress` with source label | `trackedTaskProgress` comparison when divergent |
| Notifications              | `trackedTaskProgress` transitions            | None                                            |
| Archive readiness          | CLI validate/archive outcome                 | Neither statistic decides readiness             |

## Contract consequence

The generic `progress` name currently combines incompatible meanings and must be removed. The new names are intentionally non-compatible: callers must choose which fact they mean rather than inheriting an alias that silently preserves the old ambiguity.
