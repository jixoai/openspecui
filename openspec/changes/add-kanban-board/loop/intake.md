<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Preserve the contributor's Kanban intent without inventing OpenSpec lifecycle phases.
2. Record the owner-approved full Board and Dashboard readonly projection boundary.
3. Fix Operator, realtime, static, and final-acceptance ownership before implementation.

Contributor request (2026-07-18): "Add a Kanban-style board to visualise changes."
Owner request (2026-07-28): "这个PR自身是否符合OPSX的开放式设计，是否会冲突？"
Owner decision (2026-07-28): implement the reviewed rewrite and replace Dashboard Workflow Progress with ReadonlyKanban.
-->

## Objective

Add an objective Kanban projection without turning OpenSpec's action graph into a fixed workflow.

```text
OpenSpec facts                          Presentation

stage=change + phase=no-tasks      ->  No tracked tasks
stage=change + phase=in-progress   ->  Tasks remaining
stage=change + phase=complete      ->  Tasks complete
stage=archive                      ->  Archived
```

These columns describe observable facts only. They do not mean TODO, QA, Done, verified, synced, valid,
or ready to archive.

## Product Boundary

- `/board` is the full interactive Kanban surface and is labelled `Kanban` in project navigation.
- Dashboard receives a compact `ReadonlyKanban` and replaces only the existing Workflow Progress region.
- Dashboard Active Changes remains unchanged.
- Active rows use the exact `TrackedTaskProgress.phase` emitted by the OpenSpec projection.
- Archived rows are structurally archived facts and default to a bounded `30d` range; `7d`, `30d`, `90d`,
  and `all` remain available on the full Board.
- Apply and Archive are explicit commands, not card state mutations.
- Apply opens the existing Compose Operator; Archive opens the existing Archive Operator.
- Any active card may request Archive. A drag to Archived opens the same Archive Operator and never archives
  directly.
- Keyboard and touch users receive explicit icon actions equivalent to drag.
- Static/SSG uses the same readonly model and navigation, with no drag or operation controls.

## Realtime Boundary

```text
Changes projection ----> active lanes ----> local loading/update/error state
Archives projection ---> archive lane ----> local loading/update/error state
Root authority --------> operation gate only
```

- One slow projection must not block the other lanes.
- Retained rows remain visible during revalidation or failure.
- A failed region exposes its error beside retained content.
- Progressive Change batches and row errors remain observable.
- Apply/Archive/drop are disabled whenever the corresponding projection or Root authority is not current.

## Non-Goals

- No persisted board status, phase mutation, task mutation, ordering, assignee, WIP limit, or package graph.
- No `TODO`, `QA`, or `Done` inference.
- No claim that completed tracked tasks imply validation, verification, sync, or archive readiness.
- No new Board-specific RPC when the existing Dashboard Summary and reactive list projections can carry the facts.
- No final browser or visual acceptance by an Agent; the owner performs that walkthrough.

## Acceptance Boundary

- Core/Server/static Dashboard Summary exposes exact active phase counts plus bounded archive summaries.
- Shared browser-safe helpers classify lanes and archive ranges identically in live and static projections.
- Dashboard and static surfaces use `ReadonlyKanban` without operation controls.
- Full Board has independent active/archive lifecycle states, progressive rows, row errors, retained refresh data,
  motion continuity, accessible explicit actions, and archive drag as an Operator launcher.
- Change Detail and Board consume one shared `useChangeOperatorLauncher` owner.
- Focused typed Vitest and basic component-level browser fixtures pass; owner visual acceptance remains outstanding.
- Changeset, strict OpenSpec validation, SSG build, and repository gates pass before PR delivery.
