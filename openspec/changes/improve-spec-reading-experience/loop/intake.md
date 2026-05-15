## User Input

用户要求阅读 `tmp/spec-reading-concept/index.html`，认为其中有些设计改进可以借鉴来优化 SPEC 阅读体验，并指出这意味着结构化分析还需要改进。

用户随后要求完成三项工作：

1. 先做 `SpecReadingModel`：从 parsed spec + raw markdown 生成 requirement/scenario block metadata。
2. 再升级 `SpecMarkdownDocument`：不再只 transform heading，而是支持 semantic block wrapping。
3. 最后做视觉：REQ index、Scenario card、WHEN/THEN badge、Purpose zone、移动端 ToC polish。

用户要求完成 1、2、3 之后，自己走查通过，再交给用户验收。

## Objective Scope

- Add a structured reading model for SPEC documents that preserves Markdown as the visual source while exposing semantic blocks for reading enhancements.
- Upgrade SPEC document rendering so purpose, requirements, scenarios, and scenario steps can be rendered as stable reading zones.
- Apply the concept's useful reading improvements to the existing UI: purpose zone, requirement index, scenario cards, step badges, and mobile ToC polish.
- Verify with automated tests and a browser walkthrough before user acceptance.

## Non-Goals

- Do not replace the Markdown-first rendering law with a fully reconstructed document model.
- Do not copy the concept page's entire visual style wholesale.
- Do not change OpenSpec source file syntax.
- Do not build unrelated translation, validation, or workflow features in this loop.

## Acceptance Boundary

- Parsed spec facts expose scenario step metadata without losing `bodyMarkdown` fallback text.
- SPEC rendering still preserves original Markdown content and ToC labels/anchors.
- Requirement sections render with stable `REQ-xx` indices.
- Scenario sections render as cards with structured step badges for `WHEN`, `THEN`, `AND`, `GIVEN`, or `BUT` list items when available.
- Purpose renders as a distinct reading zone.
- Mobile ToC entry is compact and does not overflow narrow viewports.
- Focused core/web tests pass, web typecheck passes, and browser walkthrough confirms the reading surface works.
