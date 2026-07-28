<!--
Orthogonal intents (created 2026-07-28 Asia/Shanghai):
1. Preserve the owner's original information-hierarchy request.
2. Bound the UI distillation without deleting OpenSpec 1.6 facts or weakening blockers.
3. Define automated preparation evidence separately from owner visual acceptance.

Original request (2026-07-28): "对比 5.x 的版本，我们这个版本在界面上加了很多信息，这些信息绝大部分应该简化成badge+toolip或者手风琴。让界面像5.x那样清爽的同时，仍然保证6.x新增的信息可以被Get到。因为我们openspecui最关键的是OPSX这套流程，其它都是服务于这套流程的。"
-->

## User Input

对比 5.x，6.x 新增的大量信息应当被重新组织为 Badge + Tooltip、手风琴或其他间接空间。界面需要恢复 5.x 的清爽感，同时保证 6.x 新增事实仍然能够被获取。OPSX 流程是 OpenSpecUI 的核心，其余信息服务于该流程。大部分具体界面决策由实现者完成，Owner 负责最终验收。

## Objective Scope

```text
OpenSpec / runtime facts
          |
          v
  [decision relevance]
     |        |          |
     v        v          v
  Action    Scan       Evidence
  current   status     provenance
     |        |          |
  visible   badge +    disclosure
            tooltip
```

- Establish one shared information-hierarchy vocabulary for live and static Web projections.
- Keep the current OPSX task, next action, mutation state, errors, stale state, and blockers directly visible.
- Compress secondary Root, Store, Reference, schema, source, and diagnostic summaries into accessible status badges and tooltips.
- Move verbose paths, raw CLI envelopes, provenance, and low-frequency diagnostics into collapsed disclosure regions without deleting them.
- Apply the vocabulary to the global Root indicator, Dashboard scope summary, Change workflow surfaces, Config ownership surfaces, Settings diagnostics, and the dedicated Context projection.
- Preserve source-distinct, static/live, reactive freshness, and Root authority contracts.

## Non-Goals

- Do not change OpenSpec CLI truth, Server APIs, reactive ownership, cache behavior, routing, or mutation authority.
- Do not remove Config, Context, Settings, Store, Reference, Git, or static-export capabilities.
- Do not hide errors, readiness blockers, stale authority, or destructive-operation consequences in a tooltip-only surface.
- Do not redesign the brand palette, navigation topology, Kanban semantics, editor layout, or terminal behavior.
- Do not claim final browser or visual acceptance from automated tests; the Owner performs that walkthrough.

## Acceptance Boundary

- The primary OPSX action and current task remain discoverable without expanding a disclosure.
- Every compressed 6.x fact remains keyboard-reachable and screen-reader attributable through a visible summary plus Tooltip, Popover, or Accordion content.
- Raw CLI/path/provenance evidence is collapsed by default but still rendered on demand.
- Errors, stale projections, failed Reference diagnostics, and blocked actions remain directly visible and actionable.
- Repeated evidence uses shared primitives and a consistent density instead of route-local ad hoc cards.
- Static and live modes share presentation primitives and retain their objective source labels.
- Focused Vitest and component-level browser fixtures cover summary/disclosure behavior; final visual and end-to-end acceptance remains Owner-owned.
