<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Record fixed-point evidence from PR #208 and OpenSpec 1.6.
2. Define the approved projection and Operator architecture.
3. Preserve exact responsive risks, verification order, and owner acceptance boundary.

Owner request (2026-07-28): deeply investigate whether PR #208 conflicts with OPSX's open design.
Owner decision (2026-07-28): implement the reviewed rewrite.
Owner layout correction (2026-07-28): ReadonlyKanban responds to its own container as `4x1`, `2x2`, or `1x4`
without horizontal scrolling.
-->

## Fixed-Point Findings

The original PR head is not mergeable as implemented.

| Evidence                                                                        | Consequence                                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------- | --------------------------------------- |
| `apply.tracks` may be absent                                                    | `0/0` is `no-tasks`, not TODO or completion                     |
| `TrackedTaskPhase = no-tasks                                                    | in-progress                                                     | complete` | use the upstream task taxonomy verbatim |
| completed tracked tasks do not prove other artifacts, validate, verify, or sync | do not call the lane QA/Done                                    |
| Archive can proceed with acknowledged incomplete tasks and skip options         | Archived is structural history, not quality completion          |
| current `ChangeMeta` uses `trackedTaskProgress`                                 | remove obsolete `progress`/`tasksComplete` code                 |
| Changes emit progressive batches and row errors                                 | preserve partial rows and local evidence                        |
| Archives and Changes settle independently                                       | no combined full-page Loading barrier                           |
| current SSG owns routes in `ssg/route-manifest.ts`                              | do not restore the old entry-server registry                    |
| current actions are owned by Compose and Archive Operators                      | Board must launch those owners, never copy their mutation logic |

The prior `TODO / In Progress / QA / Done` terminology and frontend-only architecture are superseded.

## Approved Architecture

```text
Core dashboard contract
  DashboardSummaryProjection
    activeChanges[] { trackedTaskProgress }
    activePhaseCounts { noTasks, tasksRemaining, tasksComplete }
    recentArchives[] { id, name, archivedAt, trackedTaskProgress }
             |
             +--> Server Summary loader (one existing archive read)
             +--> Static provider (same derivation helpers)
             +--> Dashboard ReadonlyKanban

Web shared model
  kanban-model.ts
    lane classifier
    archive timestamp/range policy
             |
             +--> ReadonlyKanban
                    own inline-size container
                    1 column -> 2 columns -> 4 columns
             +--> InteractiveKanban

Operation owner
  useChangeOperatorLauncher({ changeId, changeName })
    Root readiness recheck
    Apply   -> existing Compose Operator
    Archive -> existing Archive Operator
             |
             +--> Change Detail
             +--> Full Board actions/drop
```

## Implementation Slices

1. Contract slice: browser-safe archive time helpers, Dashboard Summary schema/types, Server/static derivation,
   checked tests.
2. Presentation slice: shared lane model and `ReadonlyKanban`, motion-based list continuity, Dashboard replacement.
3. Operator slice: shared launcher, Change Detail adoption, interactive Board with `DataTransfer` IDs and explicit
   icon actions.
4. Delivery slice: route manifest, nav terminology, changeset, focused tests, SSG, then full gates.

## Guardrails

- DnD transports only a change ID through `DataTransfer`; drop resolves the current row by ID.
- No module-global drag state and no stale row object as operation authority.
- Root readiness and active/archive projection currency are checked at the command boundary.
- Archive range uses one core helper; invalid dated IDs fall back to `updatedAt`.
- Dashboard readonly data is bounded at the producer and does not start another Adapter read.
- `ReadonlyKanban` accepts data and navigation only, never action callbacks.
- `ReadonlyKanban` owns the nearest inline-size container for its grid. It uses container thresholds, not viewport
  breakpoints, and contains no horizontal-scroll, auto-column, or column-flow fallback.
- Every changed TS/TSX file has a current intent/original-request header.

## Verification Order

```text
typed focused tests
  -> focused Web component tests
  -> clean SSG build + static route assertions
  -> format / lint / workspace typecheck / unit / basic browser fixtures
  -> owner visual and real browser walkthrough
```

Full gates do not substitute for focused evidence. Agent automation stops before final visual acceptance.
