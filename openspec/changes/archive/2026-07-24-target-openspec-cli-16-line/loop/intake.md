<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Preserve the manager's original OpenSpec 1.6 adaptation requirements.
2. Bound the implementation scope established by Wayfinder decisions.
3. Exclude adjacent Store, Workset, registry, and authorization products.
4. Define an objective acceptance boundary for the implementation loop.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
-->

## User Input

> "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。你先了解项目，然后更新 references/openspec，然后使用 $wayfinder 和我讨论具体的适配计划。我们最终使用openspec来管理 wayfinder 产出的文档。"

> "我个人的想法，是把 `--app` 模式提上日程。因为 app 模式提供了多标签管理。它天生适合多项目管理的这种场景。"

> "Store Manager 的存在才能使得整个产品故事形成闭环，所以我仍然需要看到一个初版的 Store Manager，也许不用打磨细节，但是平铺所有功能和信息来验证故事闭环还是有必要的。"

> "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"

> "我们刻意开发了一个响应式内核，这是 openspecui 对 openspec 最大的增强。操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"

> "统计信息仍然有一定的间接价值。"

> "理论上是要的，你觉得呢，工作难度大不大？这是额外的工作还是可以和 live 版本保持尽可能的一致？"

> "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等， 一直都在Loading，给我的感觉就是非常卡。"

## Objective Scope

This loop targets the OpenSpecUI 6.x adaptation for OpenSpec CLI 1.6 while auditing incomplete 1.4 and 1.5 contracts rather than treating version compatibility as feature completeness.

The implementation scope is:

- Make the OpenSpec CLI-resolved planning root the single writable root for every project operation, including external Store-backed roots.
- Project read-only Reference specs through a source-aware Spec Catalog without turning one project workspace into a multi-root editor.
- Adapt project shell, Dashboard, Changes, Change detail, Specs, Spec detail, Archive, Config, Context, Search, Git, Terminal, Settings, OPSX actions, Notifications, and static export to root and Reference provenance.
- Align workflow delivery with the 1.4 `sync` core-profile change and the 1.6 `update`, Oh My Pi, Trae, validation/archive, and tracked-task contracts.
- Split formal tracked progress, document checklist statistics, and Apply instruction progress into non-interchangeable facts.
- Extend the reactive kernel from the launch project to the effective OpenSpec data home, registered Store roots, and connected project roots using push invalidation followed by client pull.
- Establish App Home/Connections and the hosted runtime-environment protocol required for multi-project operation; retain the selected Store Inspector, Context Matrix, and Inventory product contract for experimental Store Manager work.
- Add an optional whole-backend shared Bearer access gate through `--auth` and `--password`, without introducing users or permissions.
- Keep live and static Spec presentation on one catalog, route, search, and read-only UI contract; require explicit `--references=include|omit` consent for static Reference content.

## Non-Goals

- No project-owned `openspec/.env`, `StoreRoot`, registry overlay, or OpenSpecUI-authored Store registry.
- No automatic Store clone, pull, push, repository synchronization, or filesystem-wide project discovery.
- No Workset orchestration in this change.
- No multiple writable planning roots inside one project tab.
- No user accounts, roles, ACLs, permissions, multi-tenant authorization, or transport encryption product. Non-loopback access remains dependent on HTTPS/WSS deployment.
- No recursive Reference traversal and no export of referenced changes, archives, config, Git state, registry data, or unrelated Stores.
- No requirement to make production Store mutation a 6.0 release gate while `--app` remains experimental.
- No compatibility aliases for replaced task-progress or Spec-identity contracts; migration and release sequencing remain explicit delivery decisions.

## Acceptance Boundary

The loop is accepted when all of the following are objectively true:

- `references/openspec` remains pinned to official `v1.6.0` and implementation behavior is checked against its source, JSON contracts, tests, and exit status.
- Every root-dependent server and WebUI operation consumes one CLI-resolved Root Context and preserves Store flags, resolved artifact paths, Reference diagnostics, and root provenance.
- Owned changes and archives remain scoped to the writable planning root; referenced Specs are navigable and searchable but visibly read-only and identified by `(referenced, storeId, specId)`.
- The project pages named in Objective Scope render root-correct facts and do not infer registry ownership, completeness, permissions, synchronization, or health beyond OpenSpec CLI evidence.
- Workflow surfaces include `sync` and `update`, Oh My Pi and Trae delivery state, strict 1.6 validation/archive outcomes, and the three separately named task projections.
- Successful CLI or external filesystem changes invalidate the affected environment facets and subscribed clients pull fresh CLI projections across the expanded observation roots.
- App can identify backend instances separately from stable `envUri` environments, discover protocol capabilities, connect with optional transient Bearer credentials, and render the planned experimental Store surfaces without making Store truth browser-owned.
- Static export addresses Specs by compound identity, shares live routes/search/UI, requires explicit Reference inclusion or omission, rejects incomplete include materialization, and removes absolute paths, remotes, registry/data-home values, and backend identity from its snapshot.
- Focused unit/integration/browser tests cover root selection, References, task semantics, reactive propagation, access gating, hosted protocol, static include/omit/redaction, route collisions, and page-level behavior.
- Required CI-equivalent checks pass, a changeset covers publishable package behavior, the protected-branch PR flow passes, and archive/release gates follow repository policy.
