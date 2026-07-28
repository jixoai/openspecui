<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Decide how OpenSpecUI projects canonical tracked tasks and aggregate document checklists without conflating them.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
Original request (2026-07-15): "统计信息仍然有一定的间接价值。"
-->

# Define the task progress projection

Status: closed
Type: grilling

## Question

When OpenSpec 1.6's canonical task artifact selected by `apply.tracks` differs from OpenSpecUI's existing schema-wide aggregate of Markdown checklists, which facts should drive workflow status, summaries, notifications, and labels, and how should the secondary aggregate remain visible without being mistaken for canonical progress?

## Resolution

[Task progress projection](../research/task-progress-projection.md) defines three non-interchangeable facts:

- `trackedTaskProgress` is OpenSpec-owned workflow truth.
- `documentChecklistSummary` retains cross-document statistics as visible secondary analytics.
- `applyInstructionProgress` preserves the raw Apply command result and its known upstream divergence.

Only tracked progress drives global task state. No-tasks is not completion, and CLI validate/archive results remain authoritative for archive readiness.
