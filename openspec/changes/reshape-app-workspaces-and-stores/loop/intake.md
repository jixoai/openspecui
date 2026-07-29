<!--
Orthogonal intents (created 2026-07-30 Asia/Shanghai):
1. Preserve the manager's first-hand App information-architecture request without rewriting it as implementation detail.
2. Bound the Workspaces/Connections consolidation and the Environment-scoped Stores product model.
3. Define the Store index/detail product outcome and the owner-only final acceptance boundary.

Original request (2026-07-30): "我个人觉得，左侧只留下 Workspaces + Stores 就行了，你觉得呢？"
Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西，就跟 Config 和 Context 的关系一样。"
Original request (2026-07-30): "那么请你开始撰写这份change，如果没有疑问，可以一步到位，并提交。"
-->

## User Input

> 我个人觉得，左侧只留下 Workspaces + Stores 就行了，你觉得呢？
>
> 1. Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input
> 2. Stores 完全可以融入 `Environment Center` 这个东西，就跟 Config 和 Context 的关系一样。
>
> 我最大的问题是，我应该如何展示Stores这个界面如果是一个列表，那么StoreDetailPage应该如何设计呢？说说你的看法

The manager then authorized a one-pass Change after the discussion converged. The agreed product direction is:

```text
OpenSpec App
├─ Workspaces   active project work
└─ Stores       reusable OpenSpec roots in a selected runtime environment
```

Connections and Environment remain objective system facts, but no longer compete with Workspaces and Stores as
top-level product destinations. Settings remains a utility entry rather than a third domain destination.

## Objective Scope

1. Replace the App's current top-level `Connections / Environment / Workspaces` information architecture with
   `Workspaces / Stores`; remove the old product routes and terminology rather than retaining compatibility glue.
2. Make the Workspaces `+` control open a connection-backed Workspace Launcher. Known daemon/live/persisted
   connection candidates are the direct plane; manual backend URL entry is a secondary escape hatch.
3. Define one deterministic launcher outcome for every candidate: focus an already-open Workspace, open one
   Workspace for a reachable candidate, or expose its concrete offline/authentication/compatibility state without
   creating a duplicate tab.
4. Make Stores the user-facing entry while preserving Environment as the registry and operation scope. A Store
   UI identity is `(backend-issued envUri, Store id)`; a backend locator is only a current access authority.
5. Replace projection-shaped Store navigation with a product-shaped hierarchy:

   ```text
   Inventory       -> Stores index
   Inspector       -> Store Detail
   Context Matrix  -> Store Detail / Usage and relationships
   Doctor evidence -> direct failure or collapsed healthy evidence
   ```

6. Design a dense, mobile-first, container-responsive Store index with Environment selection, search/filtering,
   health, currently observed Root/Reference usage, mutation activity, and retained realtime states.
7. Design Store Detail around identity, current usability, currently observed Workspace impact, Specs/active
   Changes content summary, repository facts, diagnostics, and safe Store lifecycle operations.
8. Keep Store Detail at `governance + readonly content overview`. Full proposal/spec editing and normal OPSX work
   remain Workspace responsibilities. `Open as Workspace` appears only when a real daemon/backend capability can
   establish or focus that Workspace.
9. Derive Store facts from typed OpenSpec CLI results. In particular, Store registry/Doctor evidence comes from
   the Store command group, while Store content comes from normal typed `list --specs|--changes --store <id>`
   projections; the App does not invent a parallel Store parser or persisted workflow.

## Non-Goals

- Do not change OpenSpec CLI Store identity, registry, root-selection, Reference, Doctor, or lifecycle semantics.
- Do not make the App daemon own or supervise project backend processes.
- Do not implement Store Git clone, pull, push, synchronization, or machine-wide filesystem discovery.
- Do not merge same-id Stores across Environment identities or infer Environment identity from URL, path, port,
  process lifetime, or the first online connection.
- Do not persist credentials, private launch fragments, generation-bound mutation authority, or daemon Workspace
  snapshots in launcher or Store route state.
- Do not duplicate Project Web inside Store Detail or introduce editable Specs/Changes there.
- Do not preserve `Connections`, `Environment`, `Inventory`, `Inspector`, or `Context Matrix` as parallel primary
  product destinations after replacement.
- Do not treat capability advertisement as permission, Doctor silence as machine-wide completeness, or retained
  display data as current mutation authority.
- Do not claim agent-run browser fixtures as final end-to-end acceptance.

## Acceptance Boundary

1. The persistent App shell exposes only Workspaces and Stores as primary domain navigation; Settings remains a
   visually secondary utility action.
2. The Workspace Launcher lists objective connection candidates and their live state, focuses existing
   Workspaces, opens new reachable Workspaces without duplication, and contains manual URL entry in a secondary
   flow. Credentials remain runtime-only.
3. The Stores index requires an explicit Environment identity whenever more than one is observed, keeps same-id
   Stores separate across Environments, and automatically resolves a current access authority inside the selected
   Environment without exposing backend URL selection as the normal product interaction.
4. Missing authority, authentication failure, offline state, incompatible capability, replacement generation,
   and conflicting same-Environment observations have distinct direct-plane outcomes. No mutation falls back to
   the first online backend.
5. Store rows show decision-relevant identity, health, observed usage, and active/failed operation state without
   horizontal overflow. Paths, remotes, metadata, observation provenance, and healthy raw evidence remain
   secondary.
6. Store Detail directly answers: what the Store is, whether it is usable, which connected Workspaces currently
   use/reference it, what Specs/active Changes it contains, and which lifecycle actions are currently valid.
7. Errors and blockers are never Tooltip-only or hidden in collapsed evidence. Healthy diagnostics and raw CLI
   envelopes remain available in deeper disclosure without dominating the page.
8. Initial, retained-refresh, regional failure, empty, and mutation lifecycle states preserve the established
   Push notification -> Pull current snapshot law and never fabricate optimistic Store inventory or content.
9. Focused checked tests cover navigation replacement, launcher state/duplication, composite Store identity,
   Environment authority selection and conflict, responsive index/detail topology, content projection, retained
   realtime behavior, and destructive-action authority retirement.
10. CI-equivalent local gates pass on the implementation branch. The owner receives numbered production-boundary
    walkthrough cases and remains the sole owner of final end-to-end browser acceptance.
