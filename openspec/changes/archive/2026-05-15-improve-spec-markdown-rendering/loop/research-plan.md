## Research Findings

- `packages/web/src/routes/spec-view.tsx` currently renders a synthetic document from parsed `Spec` data: overview is rendered through `MarkdownViewer`, but requirements are rebuilt from `spec.requirements`, and requirement text is inserted as plain JSX inside `H2`.
- `packages/core/src/parser.ts` currently uses `Requirement.text` as both heading title and body accumulator. Body lines before the first scenario are joined with spaces, and list lines before a scenario are appended to `currentScenarioText`.
- `packages/server/src/document-service.ts` already exposes the processed spec Markdown through `readSpecRaw(specId, consumer, mode)`, then separately parses that Markdown through `readSpec`. This means the system already has both a document source path and a parsed metadata path.
- Static export already stores both `content` and `sourceContent` for specs in `ExportSnapshot`; `packages/web/src/lib/static-data-provider.ts` exposes raw spec content via `getSpecRaw`.
- `MarkdownViewer` already has a string rendering path with ToC collection, heading id assignment, nested viewer support, and hash navigation. The current missing law is not "how to render Markdown" but "how to attach OpenSpec structural semantics to rendered Markdown while preserving the original document."
- The temporary reproduction under `tmp/issue-139-140-repro/` proves two separate failures: multi-line requirement body Markdown is collapsed into one string, and requirement body lists before scenarios are counted as scenarios.

## Decision & Plan (For Approval)

Use a Markdown-first rendering law for spec detail pages:

1. Treat processed spec Markdown as the primary visual source for spec detail pages.
2. Keep structural parsing as an enhancement layer, not as the visual reconstruction source.
3. Add a spec-aware Markdown rendering layer that recognizes OpenSpec headings such as `## Purpose`, `## Requirements`, `### Requirement: ...`, and `#### Scenario: ...`.
4. Attach semantic markers to rendered structure, for example `data-openspec-kind="requirement"` and `data-openspec-kind="scenario"`, plus stable ids and titles.
5. Use those semantic markers for visual enhancement, count displays, anchors, and ToC behavior.
6. Preserve Markdown content inside requirement and scenario bodies by letting the Markdown renderer own body rendering.
7. Keep dashboard/search/validation count-oriented behavior backed by objective parser data, but update parser behavior so the extracted structure no longer destroys requirement body Markdown.

Implementation should introduce a shared spec-document rendering primitive rather than patching `spec-view.tsx` inline. The likely shape is:

- `packages/core`: expose a parser result that separates spec document metadata from render markdown and structural ranges/blocks.
- `packages/web`: add a `SpecMarkdownDocument` component or equivalent shared rendering helper.
- `packages/web`: route live and static spec detail pages through the same Markdown-first component.
- `packages/web`: update `MarkdownViewer` or add a spec-specific extension point so ToC entries can represent OpenSpec requirement/scenario structures with stable ids.
- `packages/web`: style semantic OpenSpec blocks through data attributes instead of hard-coded reconstructed cards.

## Capability Impact

### New or Expanded Behavior

- Spec detail pages preserve full Markdown fidelity for requirement bodies, scenario bodies, and hook-injected content.
- OpenSpec structures are visually enhanced while remaining part of the original rendered Markdown flow.
- ToC support becomes structure-aware: users can navigate to Purpose, Requirements, individual requirements, scenarios, and normal Markdown headings without broken href/id alignment.
- Static export and live mode share the same Markdown-first spec detail rendering law.

### Modified Behavior

- Requirement cards are no longer reconstructed from `Requirement.text` and `scenario.rawText`.
- Parsed requirement/scenario data is no longer the primary render source for spec detail pages.
- Parser behavior must stop treating body lists before scenarios as scenario content.
- The current `Requirement.text` mixed semantic role is not preserved as a rendering contract.

## Risks and Mitigations

- Risk: Markdown AST recognition could misclassify headings inside code blocks or blockquotes.
  Mitigation: implement recognition at the Markdown AST/component layer where rendered heading nodes are already known, and test code block / blockquote cases.

- Risk: CSS-only enhancement could hide missing business facts.
  Mitigation: CSS may style data markers, but counts and structure metadata must come from parser/AST facts, not visual selectors.

- Risk: ToC entries could duplicate normal Markdown headings and OpenSpec synthetic structure entries.
  Mitigation: define a single registration path for spec headings and OpenSpec structures, and add tests for href/id alignment and duplicate headings.

- Risk: live and static paths could diverge.
  Mitigation: make both paths fetch/use raw processed spec Markdown and call the same `SpecMarkdownDocument` component.

- Risk: parser changes could affect dashboard counts or validation.
  Mitigation: keep focused parser tests for existing count behavior plus new requirement body/list cases.

## Verification Strategy

- Run core parser tests for spec parsing, including regression cases from `tmp/issue-139-140-repro`.
- Add web unit tests for spec Markdown rendering:
  - bold text renders as `<strong>`;
  - quote syntax renders as `<blockquote>`;
  - requirement body list is not treated as a scenario;
  - requirement/scenario semantic markers exist;
  - ToC hrefs align with rendered ids.
- Add or update static provider tests so static mode serves processed Markdown for the same component path.
- Run scoped checks during implementation:
  - `pnpm --filter @openspecui/core test -- parser.test.ts`
  - `pnpm --filter @openspecui/web test -- spec-view`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter @openspecui/web build:ssg`
- Use the temporary reproduction project as a manual/browser verification target before finalizing the implementation.
