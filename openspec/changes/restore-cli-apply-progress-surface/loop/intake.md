<!--
Orthogonal intents (created 2026-08-18 Asia/Shanghai):
1. Record the post-v9 regression in the user's own terms.
2. Separate planning completion from CLI-owned implementation progress.
3. Bound the correction to Change List, Dashboard, ReadonlyKanban, shared row rendering, and tests.
4. Preserve the owner-only release and final browser acceptance boundary.

Original request (2026-08-18): "changelist存在这种`Planning Complete`，而不是显示`Applying`，这有什么意义呢？之前那个Applying还能显示大概的进入，还会显示具体的总任务数和完成的任务数，为什么你把这个给改了？"
-->

## User Input

> changelist存在这种`Planning Complete`，而不是显示`Applying`，这有什么意义呢？之前那个Applying还能显示大概的进入，还会显示具体的总任务数和完成的任务数，为什么你把这个给改了？

## Objective Scope

The v9 correction must restore the lost CLI-owned implementation-progress surface without restoring the rejected
local tracked-task fallback:

```text
CLI task evidence (`openspec list` / Apply projection)
  -> Applying phase when completed > 0
  -> completed/total text
  -> proportional visual progress

local tracked task projection
  -> analytics and divergence evidence only
  -> never phase, denominator, or fallback implementation progress
```

The correction covers the shared `ChangeRow`, Change List, Dashboard Active Changes, and ReadonlyKanban cards.
`Planning Complete` remains valid only when planning artifacts are complete and no CLI-applied task evidence is
present. Detail's existing Apply Instructions projection remains the deeper source-attributed evidence surface.

## Non-Goals

- Do not reinterpret `isPlanningComplete` as Apply completion, validation, archive readiness, or release readiness.
- Do not use `trackedTaskProgress` to fill missing CLI counts or to derive `Applying`.
- Do not change OpenSpec CLI contracts, server projections, Agent delivery, or version admission.
- Do not perform browser Owner acceptance, merge, release, or archive as part of this correction.

## Acceptance Boundary

1. A Change with CLI `completedTasks > 0` renders `Applying` in Change List and Dashboard even when
   `isPlanningComplete` is true.
2. The same row shows CLI `completedTasks/totalTasks` and a proportional visual signal.
3. Deliberately divergent local tracked counts do not appear and do not affect the phase or ratio.
4. Missing CLI task evidence produces no task count or implementation-progress signal.
5. ReadonlyKanban uses CLI counts when present and has no local fallback.
6. Aggregate `opsx-status-list` may still be loading, but it cannot make a row with CLI `completedTasks > 0`
   flash `Unknown` or hide CLI `completed/total`.
7. Focused Web tests, formatting, lint, typecheck, and the existing release/Owner gates remain separate facts.
