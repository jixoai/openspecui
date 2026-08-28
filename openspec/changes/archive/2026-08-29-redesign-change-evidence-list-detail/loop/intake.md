<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Preserve the Owner walkthrough feedback and the list-detail redesign direction.
2. State the delivery boundary: Change Detail Evidence tab only.

Original request (2026-08-28, walkthrough feedback): "就是界面需要打磨一下，比如 requirement diff 和 archived validation，这两个手风琴，在 Evidence 页面是 full-w。其实整个 Evidence 页面的结构就应该重新设计一下，使用移动端的 list-detail 思维来设计这个页面会更好一些：分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
-->

# Change Evidence list-detail redesign intake

## User Input

> 走查基本没问题。界面打磨：requirement diff 和 archived validation 两个手风琴在 Evidence 页面是 full-width。
> 整个 Evidence 页面的结构应该重新设计：使用移动端的 list-detail 思维——分成两栏，左侧 list，右侧详情，替代手风琴。

## Objective Scope

Replace the stacked full-width accordion composition of the Change Detail Evidence tab with a
container-responsive list-detail workspace:

```text
wide container                    crowded container (mobile-first base)
+----------+------------------+   +------------------------+
| evidence | selected detail  |   | evidence list          |
| list     | (scroll owner)   |   | tap item ->            |
| (order = decision-plane law)|   |   detail + back        |
+----------+------------------+   +------------------------+
```

List order preserves the established evidence layering (summary/paths -> requirement diffs ->
archived validation -> CLI/raw payload). No evidence semantics, fetching, or authority change —
this is a presentation-structure change only.

## Non-Goals

- Do not change what evidence exists, how it is fetched, or its CLI-owned provenance.
- Do not touch the Detail Header, Folder/Content tabs, or the decision plane.
- Do not introduce viewport breakpoints (container queries own the topology).
- Do not persist sub-selection in routes or browser storage.

## Acceptance Boundary

- Owner re-walkthrough on the rebuilt walkthrough servers (3100/3101) accepts the new structure;
  automated component tests are preparation evidence only.
