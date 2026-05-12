# Intake

## User Input

用户认可 hooks V1 方案，并要求开始实现。此前已确定：

- 使用 `openspec/openspecui.hooks.ts`，不要污染 `openspec/.openspecui.json`。
- 敲定并实现 `onReadDocument` 与 `onRunWorkflow`。
- 方案必须满足 GitHub issue #103：configurable markdown pre-processor daemon for spec views。
- `.chat` 文件夹用于保留讨论设计，并且需要被 git ignore。

## Objective Scope

- Add project-local hooks support for OpenSpecUI runtime.
- Provide type-safe public hook contracts for `onReadDocument` and `onRunWorkflow`.
- Route document reads through a shared processed/source document service for live UI, search, and static export.
- Route OPSX workflow invocation payload generation through `onRunWorkflow` without replacing OpenSpec CLI truth.
- Preserve raw source access for #103 and auditing workflows.

## Non-Goals

- Do not add executable behavior to `openspec/.openspecui.json`.
- Do not create browser-side hook execution in V1.
- Do not implement a generic plugin bus.
- Do not replace OpenSpec CLI status, instructions, schema, validation, or archive logic.

## Acceptance Boundary

- A project can define `openspec/openspecui.hooks.ts` with either hook exported.
- Missing hooks preserve current behavior.
- `onReadDocument` can enrich spec markdown for view/search/export and raw reads remain untouched.
- `onRunWorkflow` can customize OPSX action payloads while default behavior remains current-compatible.
- Tests cover loader, document processing, workflow payload processing, and #103-style enrichment.
