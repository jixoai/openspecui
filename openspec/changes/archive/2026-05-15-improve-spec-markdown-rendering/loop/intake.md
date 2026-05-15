## User Input

检查 github issues #139 #140，提出建议和想法。

不考虑兼容性。直接破坏性完整升级。不过开始之前，需要先构建一个临时文件夹，把这个问题彻底暴露出来，展示错误的效果。

看到了错误效果后，询问修复建议。

提出更灵活的方案：直接渲染原始文件内容，同时在 Markdown 到 HTML 的过程中标记关键结构信息，再利用这些结构信息用 CSS 强化阅读体验。询问该方案和结构化方案的优缺点，并要求客观评价。

整合意图：直接渲染，但同时也要进行解析，把解析出来的结果进一步用来强化渲染。同时 ToC 这部分的支持要做得更好。开始编写 openspec 推进这个变更。

## Objective Scope

This loop defines and implements a Markdown-first spec detail rendering model for OpenSpecUI:

- Spec detail pages render the processed Markdown document directly as the primary source of visual truth.
- OpenSpec structural parsing still occurs, but its output is used as an enhancement layer for requirement/scenario semantics, anchors, card styling, counts, and ToC behavior.
- The rendering path must preserve Markdown authored by users and `onReadDocument` hooks, including line breaks, blockquotes, lists, emphasis, code blocks, and GFM content inside requirement bodies.
- ToC support must improve so OpenSpec structures and Markdown headings are discoverable, stable, and aligned with rendered anchors.

## Non-Goals

- Do not preserve compatibility with the current `Requirement.text` rendering model as a product contract.
- Do not build a generic plugin system or new hook surface for this work.
- Do not make CSS responsible for business facts; CSS may style semantic markers, but parsing must produce objective structural metadata.
- Do not redesign unrelated routes such as changes, archive, config, dashboard, or terminal panels unless required to keep shared Markdown primitives coherent.
- Do not treat the temporary reproduction fixture under `tmp/issue-139-140-repro/` as production test data without first converting it into focused regression tests.

## Acceptance Boundary

- A spec detail page with multi-line requirement body Markdown renders the original Markdown structure instead of a space-joined heading string.
- Requirement body Markdown such as bold text, blockquotes, lists, and code blocks renders as Markdown.
- A requirement body list before the first scenario remains requirement body content and is not counted as a scenario.
- Requirement and scenario structures expose stable semantic markers for styling and interaction.
- The ToC includes stable entries for spec sections and OpenSpec requirement/scenario structures without broken href/id alignment.
- Live mode and static export mode use the same Markdown-first rendering and structural enhancement law.
- Parser tests and web rendering tests cover the reproduction exposed by issues #139 and #140.
