## User Input

用户认为把 SPEC 阅读模型升级到 Markdown AST 级别是有必要的，但同时要求解析足够宽松，因为 OpenSpec 官方很有可能升级标准。用户强调解析要足够“客观”，不能被现有标准做得“过拟合”。

用户要求使用 `$openspec-explore` 编写 OpenSpec change，然后推进。

## Objective Scope

- Define an OpenSpec change for an objective Markdown reading model that starts from Markdown facts before applying OpenSpec semantics.
- Replace over-fitted string-section assumptions with an explicit two-layer model:
  - objective Markdown facts;
  - loose, version-tolerant OpenSpec semantic annotations.
- Preserve Markdown-first rendering as the governing law: unknown or future OpenSpec syntax must remain visible and navigable instead of being dropped.
- Plan the migration path for current spec parsing and SPEC reading UI without writing application code in explore mode.

## Non-Goals

- Do not implement application code during this explore pass.
- Do not lock the parser to the current OpenSpec heading vocabulary only.
- Do not require OpenSpec source authors to rewrite existing documents.
- Do not introduce a strict validator that rejects unknown future OpenSpec constructs.
- Do not copy the current reading UI implementation into a second parallel truth.

## Acceptance Boundary

- The change artifacts define a platform-law model where Markdown AST/facts are the objective source and OpenSpec semantics are annotations.
- The plan explicitly handles future OpenSpec standard drift by preserving unknown nodes and making semantic rules replaceable/version-aware.
- The plan identifies current overfit points in `MarkdownParser` and `SpecReadingModel`.
- The checkpoints describe implementation, verification, migration, and PR gates.
- The change remains ready for a later implementation pass without modifying application code in explore mode.
