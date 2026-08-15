<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Preserve the original request and version-line decision for OpenSpecUI 9.
2. State the planning-only delivery boundary for the next implementation agents.

Original request (2026-08-15): "openspec 已经升级到1.9 ，我们目前的适配还在1.7 . 不过这两次版本更不不算大，请你准备我们openspecui v9的开发，直接跳过1.8的适配。也就是说这次v9的适配需要同时适配 1.8和1.9。"
-->

# OpenSpecUI 9 intake

## User Input

> openspec 已经升级到1.9 ，我们目前的适配还在1.7 . 不过这两次版本更不不算大，请你准备我们openspecui v9的开发，直接跳过1.8的适配。
>
> 也就是说这次v9的适配需要同时适配 1.8和1.9。
>
> 请你开始工作规划，将计划落地到 openspec change 中，不使用子代理，直接深入调查，给出可靠的升级计划。
>
> 做完计划后我会让其它Agent来开发，不是你负责，你只负责撰写change，写完后再开子代理（5.6-sol）做一次review，然后你做一次补全。
>
> 完成后，我就会自己开始开发

> Agent 开发已经完成，开始全面 review。

> 还是那个流程：更新 openspec change +handoff 文件。

## Objective Scope

Prepare OpenSpecUI 9 as one adaptation line for OpenSpec CLI 1.8.x and 1.9.x. Record source-backed protocol
facts, an executable implementation order, exact owner/red/green evidence, package/release preparation, and the
Owner-only acceptance boundary.

```text
OpenSpec CLI 1.8.x ----\
                         +--> OpenSpecUI 9 contracts, projections, tests, release preparation
OpenSpec CLI 1.9.x ----/
```

## Non-Goals

- Do not create or publish an OpenSpecUI 8 line.
- Do not change production source code in this planning Change.
- Do not support CLI `<1.8.0`, prereleases, or `>=1.10.0`.
- Do not repair unrelated active/archive validation failures.
- Do not open a PR, release, archive this Change, merge, or claim final browser acceptance.
- Do not implement the post-review R6 correction work in this planning pass.

## Acceptance Boundary

The planning delivery is complete only when:

- `references/openspec` points at the verified v1.9.0 source baseline;
- the research report, Change artifacts, delta Specs, `AGENTS.md`, and `i18n.zh.md` state one coherent v9 law;
- every implementation task identifies its primary owner, precise red case, green case, focused-review stop rule,
  and order relative to dependent work;
- the Change passes targeted OpenSpec 1.9 strict validation and a diff hygiene check; and
- an independent `gpt-5.6-sol` review has been incorporated without implementing production code.
- the post-R5 independent review has been translated into ordered R6 repair gates and a fresh-context handoff;
  R6 source work remains explicitly unchecked.
