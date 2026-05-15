## Research Findings

- `tmp/spec-reading-concept/index.html` demonstrates a reading model with distinct purpose, requirement, scenario, and step zones.
- Current `SpecMarkdownDocument` only transforms headings. It can set ids, ToC labels, suffixes, and data attributes, but it does not wrap semantic sections.
- Current parser already separates requirement `title`, `bodyMarkdown`, and scenarios with `title`, `bodyMarkdown`, and `rawText`.
- Current schema does not expose scenario step facts such as `WHEN`, `THEN`, or `AND`.
- `MarkdownViewer` supports a builder mode with shared ToC collection, so SPEC rendering can move from string-only heading transforms to a structure-aware builder while still rendering Markdown fragments through nested viewers.
- The previous Markdown-first law remains valid: raw/processed Markdown is the visual source, and parsed structure should enhance rendering rather than replace author content.

## Decision & Plan (For Approval)

Implement the requested three-part upgrade:

1. Add scenario step metadata to the parsed spec model.
   - Parse GFM list items that begin with RFC scenario keywords (`GIVEN`, `WHEN`, `THEN`, `AND`, `BUT`), including bold keyword forms.
   - Preserve the original scenario `bodyMarkdown` and `rawText`.

2. Add a SPEC reading model and semantic renderer.
   - Build a `SpecReadingModel` from parsed spec facts and raw Markdown context.
   - Render with `MarkdownViewer` builder mode so purpose, requirement, scenario, and body fragments become stable blocks while retaining ToC integration.

3. Apply reading visuals from the concept selectively.
   - Purpose zone.
   - Requirement index (`REQ-01`).
   - Scenario cards.
   - Scenario step badges.
   - Mobile ToC polish through the shared `Toc` / MarkdownViewer surface.

## Capability Impact

### New or Expanded Behavior

- SPEC detail pages expose more scan-friendly reading structure.
- Scenario steps gain dedicated visual treatment when OpenSpec-style step lines are present.
- Requirement and scenario sections become stable semantic blocks that can support future folding, filtering, validation markers, or deep links.

### Modified Behavior

- SPEC detail rendering moves from string Markdown heading transform to a semantic builder model for OpenSpec documents.
- ToC labels remain based on OpenSpec titles, not visible adornments.

## Risks and Mitigations

- Risk: Reconstructing document order could drop authored Markdown.
  Mitigation: Use parsed `bodyMarkdown` fragments as the rendered source for each block and keep raw Markdown fallback available.
- Risk: Step parsing could misclassify normal lists.
  Mitigation: Only classify list items with explicit scenario keywords at the start, optionally bolded.
- Risk: Nested Markdown viewers could pollute ToC with body headings.
  Mitigation: Disable ToC collection for body fragments and explicitly register only semantic headings.
- Risk: Mobile ToC could regress into overflow.
  Mitigation: Use existing shared ToC overflow law and verify narrow viewport.

## Verification Strategy

- Core parser tests for scenario step extraction and raw Markdown preservation.
- Web component tests for purpose zone, requirement index, scenario card, step badges, and ToC labels.
- Web typecheck.
- Browser walkthrough against a temporary/spec fixture page with rich requirement bodies and scenario steps.
