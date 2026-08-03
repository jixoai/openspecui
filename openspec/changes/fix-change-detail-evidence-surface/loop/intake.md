<!--
Orthogonal intents (created 2026-08-03 Asia/Shanghai):
1. Preserve the owner's Change Detail evidence-surface problem and product questions.
2. Fix the default decision plane without removing objective CLI and Root evidence.
3. Bound automated preparation while reserving final browser acceptance for the owner.

Original request (2026-08-03): "changeDetail页面有严重的BUG：右上角这里有一坨内容，这些内容没有任何高度限制，而且非常影响观感，思考一下有没有优化的方案方法？"
Owner correction (2026-08-03): Actions stay at the title inline-end until a narrow container wraps them below; Apply inputs become a Dialog action; Schema, artifact progress, Root, and References become subtitle badges; action-specific unavailable reasons belong to the corresponding button Tooltip.
Owner correction (2026-08-03): the wide Header uses `grid-template-columns: auto 1fr` so title identity receives width priority; long titles wrap instead of truncating.
-->

## User Input

> changeDetail页面有严重的BUG：右上角这里有一坨内容，这些内容没有任何高度限制，而且非常影响观感，思考一下有没有优化的方案方法？
>
> 前提是，你深入考虑过这些问题：
>
> 1. 这个内容什么时候下需要查看？
> 2. 在changeDetail中它的最必要的展示信息应该是什么？
> 3. 有什么方法可以作为这个必要内容与完整内容之间的载体？Dialog？还是在changeDetail的tabs中新增一个tabPage？

## Objective Scope

- Keep Change identity, subtitle status badges, workflow actions, errors, blockers, stale authority, and progress divergence in the default decision plane.
- Keep Actions at the title inline-end when space permits; use `auto 1fr` for the wide Header so identity/title receives width priority, then wrap the complete action row below only at narrow container widths.
- Move persistent Root, Store, Reference, artifact-path, action-context, and raw CLI evidence into a dedicated `Evidence` tab after `Folder`.
- Expose non-empty Apply context and operation guidance as one workflow action that opens a bounded Dialog.
- Present Schema, artifact completion, Root source/Store, and Reference state as Tooltip-backed subtitle badges.
- Attach action-specific unavailable reasons to the corresponding disabled action Tooltip instead of rendering a repeated summary line.
- Separate compact header content from a full-width action/status region in the shared OPSX detail layout.
- Preserve live/static source distinctions and current/retained/unavailable Reference states without fabricating zero counts.
- Make the Evidence panel mobile-first, horizontally overflow-free, and the primary vertical scroll owner for its tab.

## Non-Goals

- Do not change Core, Server, Router, subscription, mutation, or OpenSpec CLI contracts.
- Do not add an Evidence tab to Archive Detail.
- Do not use a Dialog for persistent Change evidence.
- Do not hide transport errors, Root blockers, stale authority, progress divergence, or Reference failures inside a Tooltip or Dialog.
- Do not complete, rewrite, or claim the pending Config Guide owner walkthrough.

## Acceptance Boundary

- Change Header height and width allocation are independent from evidence volume; no workflow or evidence tree renders as its right-side sibling.
- The default Artifact/Content tab excludes verbose paths, Reference detail, and raw CLI payload while keeping workflow actions and direct failures visible.
- `Evidence` is routable through the existing tab query, displays readable facts through raw CLI evidence, and never becomes the default tab.
- Apply inputs are absent when empty and appear as a workflow action when present; its Dialog preserves complete context and guidance.
- At wide container widths the Header uses `auto 1fr`, identity/title receives width priority, and Actions occupy the remaining inline-end column; at narrow widths Actions wrap as one block-end row without horizontal overflow.
- Long Change titles wrap within the identity column, including continuous long tokens, instead of clipping or using ellipsis.
- Schema, artifact completion, Root source/Store, and Reference status occupy the subtitle as compact badges with complete Tooltip explanations.
- Each action-specific unavailable reason is reachable from its own disabled button Tooltip, with no duplicate `Unavailable:` summary line.
- Missing Root Context renders Reference evidence as unavailable, retained Root Context remains source-attributed, and static mode explicitly reports unavailable CLI provenance.
- Focused checked Vitest and basic component-browser fixtures cover behavior and 390px, 768px, and 1280px container geometry without page-level horizontal overflow.
- CI-equivalent checks, clean SSG build, strict Change validation, changeset validation, and `git diff --check` pass at the implementation head.
- Final end-to-end browser walkthrough and visual acceptance remain owner-owned.
