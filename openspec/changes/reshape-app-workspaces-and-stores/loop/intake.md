<!--
Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
1. Preserve the manager's first-hand App information-architecture request without rewriting it as implementation detail.
2. Bound the path-first Workspace home, managed-backend lifecycle, and Workspaces/Connections consolidation.
3. Bound the Environment-scoped Stores product model and Store index/detail outcome.
4. Preserve the owner-only final acceptance boundary.

Original request (2026-07-30): "我个人觉得，左侧只留下 Workspaces + Stores 就行了，你觉得呢？"
Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西，就跟 Config 和 Context 的关系一样。"
Original request (2026-07-30): "那么请你开始撰写这份change，如果没有疑问，可以一步到位，并提交。"
Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
Owner lifecycle decision (2026-07-30): closing a Workspace only closes its view; managed services stop explicitly, daemon stop terminates only daemon-managed services, and daemon restart restores the managed running set.
Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
Original request (2026-07-30): "任务管理器，打开后，可以看到所有正在运行中backend的详情，并可以杀掉Workspace，或者收藏、取消收藏"
Original request (2026-07-30): "弱化端口这个概念，重点强调 path的概念。"
Original request (2026-07-30): "Tab这里默认写仓库路径 org/repo，如果没有就使用path的foldername；subtitle写git分支名"
Owner correction (2026-07-31): Workspaces secondary navigation directly lists Favorites without an accordion;
Running requires compatible Health API evidence plus an established WebSocket; external close-only registrations
expose no Close/Remove/Delete lifecycle action.
Owner correction (2026-07-31): Favorites/Recent persistence belongs to the App daemon backend, never browser storage.
Owner correction (2026-07-31): "Workspace Home 页面不要有PWA安装，我们现在已经完全废弃pwa这个方向了。请清理干净pwa相关的代码"
Owner correction (2026-07-31): "左侧导航栏顶部这里的 OpenSpecUI App，这里的icon改成我们的 logo。"
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

The manager subsequently expanded Workspaces from a connection switcher into a path-first project launcher and
runtime manager:

```text
Workspaces
├─ Home (fixed first tab)
│  ├─ Favorites
│  ├─ Start from path
│  ├─ Recent directories
│  └─ Task Manager
├─ favorite directories (direct secondary navigation)
└─ open project tabs
```

## Objective Scope

1. Replace the App's current top-level `Connections / Environment / Workspaces` information architecture with
   `Workspaces / Stores`; remove the old product routes and terminology rather than retaining compatibility glue.
2. Make the first Workspace tab a fixed, non-closeable Home surface. It shows favorite project directories first,
   a path-input launch form in the middle, recent successfully opened directories below, and a Task Manager entry.
3. Let the local App daemon start and supervise an OpenSpecUI project backend from a canonical local directory.
   Closing its project tab preserves the running service; explicit Stop terminates it; daemon stop terminates only
   daemon-managed services; daemon restart restores the managed running set. External foreground `serve` owners
   remain separate and may stop only through their own current lease capability.
4. List favorite canonical directories directly beneath Workspaces without a `Running`/`Favorites` accordion.
   Selecting one focuses its current Workspace or starts the directory through managed daemon authority.
5. Make the Workspaces `+` control open a connection-backed Workspace Launcher. Known daemon/live/persisted
   connection candidates are the direct plane; manual backend URL entry is a secondary escape hatch.
6. Define one deterministic launcher outcome for every candidate: focus an already-open Workspace, open one
   Workspace for a reachable candidate, or expose its concrete offline/authentication/compatibility state without
   creating a duplicate tab.
7. Persist credential-free canonical directory history and favorites in the App daemon's user-level catalog.
   A successful managed directory launch updates recency only after backend admission settles; favorite state is
   independent from whether a backend or tab is open. Browser windows Pull this catalog and never own its storage.
8. Add an App-owned Task Manager Dialog for every current daemon registration. It independently establishes a
   compatible Health API result and WebSocket subscription before calling a backend Running, while retaining
   non-running registrations with their objective failure state.
9. Present every Task Manager backend and project tab path-first: use an objective GitHub `org/repo` slug as title when
   available, otherwise the canonical directory basename; use the current Git branch as subtitle. Full local path
   remains retrievable, while host/port stays secondary diagnostic evidence.
10. Make Stores the user-facing entry while preserving Environment as the registry and operation scope. A Store
    UI identity is `(backend-issued envUri, Store id)`; a backend locator is only a current access authority.
11. Replace projection-shaped Store navigation with a product-shaped hierarchy:

```text
Inventory       -> Stores index
Inspector       -> Store Detail
Context Matrix  -> Store Detail / Usage and relationships
Doctor evidence -> direct failure or collapsed healthy evidence
```

12. Design a dense, mobile-first, container-responsive Store index with Environment selection, search/filtering,
    health, currently observed Root/Reference usage, mutation activity, and retained realtime states.
13. Design Store Detail around identity, current usability, currently observed Workspace impact, Specs/active
    Changes content summary, repository facts, diagnostics, and safe Store lifecycle operations.
14. Keep Store Detail at `governance + readonly content overview`. Full proposal/spec editing and normal OPSX work
    remain Workspace responsibilities. `Open as Workspace` appears only when a real daemon/backend capability can
    establish or focus that Workspace.
15. Derive Store facts from typed OpenSpec CLI results. In particular, Store registry/Doctor evidence comes from
    the Store command group, while Store content comes from normal typed `list --specs|--changes --store <id>`
    projections; the App does not invent a parallel Store parser or persisted workflow.

## Non-Goals

- Do not change OpenSpec CLI Store identity, registry, root-selection, Reference, Doctor, or lifecycle semantics.
- Do not make the daemon adopt, terminate, or restore an externally owned foreground `serve` process without an
  exact current lease capability. Managed local services and external leases remain physically distinct owners.
- Do not clone, discover, or resolve a GitHub `org/repo` display slug into a local directory; directory launch
  accepts a local path and Git facts only improve presentation after objective inspection.
- Do not use host, port, backend URL, symlink spelling, or unverified Git metadata as Workspace project identity.
- Do not treat daemon lease presence as Running evidence or hide a still-registered external backend through a
  presentation-only Close, Remove, or Delete action.
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
- Do not preserve PWA install, manifest, service-worker cache/update, launch-role, or overlay-titlebar behavior.

## Acceptance Boundary

1. The persistent App shell exposes only Workspaces and Stores as primary domain navigation; Settings remains a
   visually secondary utility action.
2. Workspaces always retains a fixed first Home tab with favorite directories, one path-input form, recent
   directories, and a Task Manager entry. It cannot be closed, reordered, or replaced by a project iframe.
3. Submitting a valid local directory starts or focuses exactly one canonical managed service and Workspace with a
   loading lock and concrete failure. The same physical directory cannot produce duplicate managed backends.
4. Workspaces secondary navigation directly lists Favorites with no section accordion. Selecting a canonical path
   focuses its current Workspace or starts one managed backend; port is not a label or selector.
5. Task Manager shows all daemon registrations, distinguishes daemon-managed and external foreground owners, and
   calls one Running only after compatible Health API and established WebSocket evidence. Managed rows expose exact
   Stop; external close-only rows expose no Close/Remove/Delete/Stop action; favorite remains path-owned.
6. Closing a managed Workspace tab leaves its backend running; explicit Stop retires its authority and frames;
   daemon stop affects only managed services; daemon restart restores the previously running managed directory set.
7. Favorites and recent directories persist canonical credential-free paths independently from runtime state in the
   daemon-owned user catalog. Failed submissions, credentials, backend URLs, ports, and private launch fragments do
   not enter history; App windows converge through daemon invalidation Push followed by snapshot Pull.
8. The Workspace Launcher lists objective connection candidates and their live state, focuses existing
   Workspaces, opens new reachable Workspaces without duplication, and contains manual URL entry in a secondary
   flow. Credentials remain runtime-only.
9. The Stores index requires an explicit Environment identity whenever more than one is observed, keeps same-id
   Stores separate across Environments, and automatically resolves a current access authority inside the selected
   Environment without exposing backend URL selection as the normal product interaction.
10. Missing authority, authentication failure, offline state, incompatible capability, replacement generation,
    and conflicting same-Environment observations have distinct direct-plane outcomes. No mutation falls back to
    the first online backend.
11. Store rows show decision-relevant identity, health, observed usage, and active/failed operation state without
    horizontal overflow. Paths, remotes, metadata, observation provenance, and healthy raw evidence remain
    secondary.
12. Store Detail directly answers: what the Store is, whether it is usable, which connected Workspaces currently
    use/reference it, what Specs/active Changes it contains, and which lifecycle actions are currently valid.
13. Errors and blockers are never Tooltip-only or hidden in collapsed evidence. Healthy diagnostics and raw CLI
    envelopes remain available in deeper disclosure without dominating the page.
14. Initial, retained-refresh, regional failure, empty, and mutation lifecycle states preserve the established
    Push notification -> Pull current snapshot law and never fabricate optimistic Store inventory or content.
15. Focused checked tests cover Home/catalog persistence, canonical-path duplicate suppression, managed service
    lifecycle, favorite navigation, Health+WebSocket Running evidence, Task Manager authority, path-first labels,
    launcher state/duplication,
    composite Store identity,
    Environment authority selection and conflict, responsive index/detail topology, content projection, retained
    realtime behavior, and destructive-action authority retirement.
16. CI-equivalent local gates pass on the implementation branch. The owner receives numbered production-boundary
    walkthrough cases and remains the sole owner of final end-to-end browser acceptance.
17. Workspace Home ignores browser install prompts; clean App output contains no manifest, service worker, or PWA
    icon assets; Browser launch relay has no PWA role; and the sidebar brand renders the App-owned logo.
