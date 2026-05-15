## Implementation State

Implementation is in local verification. The platform parser/annotation/projection layers have
been implemented, and the SPEC detail renderer has been corrected back to Markdown-first
rendering after self review.

## Decisions Taken

- Use a three-layer local reading law:
  - Markdown facts are objective and syntax-only.
  - Semantics are loose annotations over facts.
  - Product shapes such as `Spec` are projections, not parser truth.
- Keep Markdown-first rendering: unknown content must render and remain navigable.
- Do not let web components own parsing truth; core owns facts, annotations, and projections.
- Avoid overfitting to current OpenSpec vocabulary by making semantic and projection rules plugin-owned, replaceable, and confidence-aware.
- Treat built-in OpenSpec behavior as one default reading plugin. Community/custom behavior should be able to add annotations and projections through the same rule interfaces.
- Remove compatibility-oriented parser thinking for local internals. The local parser may change destructively because the source Markdown remains the durable truth.
- Keep SPEC detail rendering on the raw Markdown HTML tree. `Spec` data may provide fallback
  counts, but it must not switch the page into a separate structured builder DOM.

## Divergence Notes

- This change intentionally follows the previous SPEC reading work but does not extend it locally. It creates the next platform layer needed to prevent future regex/string-rule creep.
- The implementation scope was upgraded after self review: `openspec-annotations` and `openspec-projection` are no longer monolithic parser stages. They now sit on top of the generic `markdown-reading` plugin pipeline.
- Keyword emphasis validates the same pipeline: OpenSpec keyword facts are emitted as `keyword` annotations in core, carried through projection, and rendered by the generic Markdown inline annotation hook instead of a Spec-page string scan.
- The initial implemented detail page still had a `spec`-prop builder branch that rebuilt
  requirements and scenario steps into custom cards/divs. That branch violated the Markdown-first
  law and has been removed. Scenario steps now remain authored `ul > li` nodes and receive
  `data-openspec-kind="scenario-step"` as a block annotation.
- `WHEN` / `THEN` / `SHALL` visual emphasis is now driven by the same annotation pipeline:
  keywords are wrapped as inline spans, while scenario-step ownership is carried by the original
  list item. The current visual rule uses Tailwind `@apply` with the project-level
  `text-shadow-openspec-keyword` token plus `text-shadow-primary/50`; it intentionally avoids
  background and border decoration.
- The Markdown-first enhancement layer now restores most of the previous structured reading
  affordances through HTML attributes and CSS only. Headings expose semantic label/title data,
  original block nodes expose zones such as `purpose`, `requirements-intro`, `requirement-body`,
  and `scenario-body`, and CSS uses those attributes plus pseudo-elements to render requirement
  labels, dividers, scenario surfaces, and section emphasis without replacing the authored
  Markdown tree.
- Requirement and scenario headings keep the original authored heading text in the DOM, but their
  enhanced visual form is rendered from attributes. CSS hides the original text color/font metrics
  and uses `::before` for the label and `::after` for `data-openspec-title`, so the page has a
  readable no-CSS fallback while avoiding duplicated `Requirement:` / `Scenario:` prefixes in the
  enhanced view.
- Purpose headings and purpose body blocks share the same `border-inline-start` and use padding,
  not inter-block margin, so they read as one semantic region rather than two disconnected boxes.
- Requirement/scenario indentation is driven by shared CSS variables:
  `--openspec-reading-label-column`, `--openspec-reading-label-gap`, and
  `--openspec-reading-content-indent`. Requirement titles, requirement body blocks, scenario
  titles, and scenario list text align to the same content column instead of mixing unrelated
  `gap` and margin constants.
- ToC-bearing pages now share a fluid page layout contract through `toc-page-layout`,
  `toc-page-content`, and `toc-page-sidebar`. The sidebar column treats the old width as a
  minimum, targets 20% of the available container for better visual balance, and caps at a shared
  max width so long navigation trees do not dominate wide screens.
- Right-side ToC panels now stretch vertically to the available container or viewport height.
  The floating/narrow ToC keeps its existing compact max-height behavior; only the wide sidebar
  mode consumes the extra vertical space.
- Scenario-step list items are explicitly kept as native `li` flow. They may carry
  `data-openspec-kind="scenario-step"` and scroll/line-height affordances, but they must not
  become grid/flex layout containers because that breaks Markdown list marker, wrapping, nesting,
  and long-content behavior.
- Spec Markdown unordered lists use square markers in the enhanced reading view while keeping
  native list semantics.

## Latest Verification Evidence

- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/spec-markdown-document.test.tsx`
- `pnpm --filter @openspecui/core exec vitest run src/markdown-reading.test.ts src/openspec-annotations.test.ts src/parser.test.ts`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm --filter @openspecui/core typecheck`
- `pnpm --filter @openspecui/web build:dist`
- `pnpm --filter openspecui run build:copy-web`
- Playwright against `http://localhost:3101/specs/cli-shell-product?_b=%2F` confirmed
  `li[data-openspec-kind="scenario-step"]` count `283`, `div.spec-scenario-step` count `0`,
  `WHEN` inside the original list item, transparent background, zero border, and active
  text-shadow.
- Follow-up Playwright verification on the same URL confirmed that semantic enhancements are
  CSS/attr-driven over original nodes: requirement remains `H3` with `data-openspec-label="REQ-01"`
  and `::before` content, scenario remains `H4` with grid/background/border styling, purpose and
  requirement body remain `P` nodes with zone attributes, and scenario body remains `UL` with
  requirement/scenario metadata.
- Follow-up Playwright verification on the same URL confirmed scenario steps remain native list
  items: `li[data-openspec-kind="scenario-step"]` count `283`, `div.spec-scenario-step` count `0`,
  first step parent `UL`, computed `display` `list-item`, and computed `grid-template-columns`
  `none`.
- Follow-up Playwright verification on the same URL confirmed the CSS/attribute projection:
  requirement remains `H3` with transparent original text, `::before` content `"REQ-01"` and
  `::after` content from `data-openspec-title`; scenario remains `H4` with transparent original
  text, `::before` content `"Scenario"` and `::after` content from `data-openspec-title`; Purpose
  heading and paragraph both have a `3px` inline-start border and zero vertical margin between
  them.
- Follow-up Playwright verification on the same URL confirmed the indentation model:
  unordered lists compute `list-style-type: square`; requirement heading padding and requirement
  body margin both compute to `84.8px`; scenario heading padding computes to `84.8px`; scenario
  list container margin plus padding computes to the same content x-coordinate while the original
  list item remains `display: list-item`.

## Loopback Triggers

- If no suitable small Markdown parser can provide reliable source ranges, return to research before implementing.
- If parser dependency choice would leak AST vendor types across package boundaries, return to design before implementing.
- If the annotation model starts rejecting or hiding unknown syntax, return to intake because that violates the core objective.
- If implementation requires breaking public API shapes beyond optional fields/projections, pause for explicit approval.
- If more OpenSpec-like document families appear, add plugins/rules rather than more special-case branches in the platform layer.
