## Research Findings

- Current `packages/core/src/parser.ts` parses specs by scanning lines and matching current OpenSpec heading forms such as `## Purpose`, `## Requirements`, `### Requirement:`, and `#### Scenario:`.
- Current scenario step extraction uses a regex over raw lines for `GIVEN`, `WHEN`, `THEN`, `AND`, and `BUT`; this is useful metadata but it is not yet tied to an objective Markdown node identity.
- Current `packages/web/src/components/spec-reading-model.ts` already moved in the right direction by combining parsed spec facts with raw Markdown context, but it still uses top-level string splitting for extra sections and Requirements intro.
- Current web rendering uses `react-markdown` with `remark-gfm`, but core does not currently expose a Markdown AST/facts parser as a platform contract.
- Existing package dependencies do not show a direct core-level AST parser dependency such as `mdast-util-from-markdown`, `remark-parse`, or `unified`; introducing one should be a deliberate core dependency decision, not a web-local convenience.
- The architectural risk is overfitting: if OpenSpec changes heading names, adds new block kinds, or allows richer nested sections, line scanning can either misclassify content or silently drop authored Markdown during semantic rendering.
- The stable law should be: Markdown text is the content truth; objective Markdown facts describe structure; OpenSpec semantic annotations are best-effort labels that can evolve independently.

## Decision & Plan (For Approval)

Adopt Option A: platform-law upgrade to an objective Markdown facts and semantic annotation pipeline.

```
source markdown
      │
      ▼
┌──────────────────────┐
│ Markdown Facts Layer │  objective, syntax-only
│ headings/lists/code  │  source ranges, raw markdown slices
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Annotation Plugins   │  loose semantics
│ purpose? requirement?│  confidence, rule id, plugin-owned
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Projection Plugins   │  Spec, reading sections, future outputs
│ never drops unknowns │
└──────────────────────┘
```

### Platform Law

- Add a core-owned Markdown facts model.
  - Facts record headings, paragraphs, lists, list items, blockquotes, tables, code blocks, thematic breaks, and raw source ranges when available.
  - Facts must preserve unknown nodes as generic Markdown facts with raw Markdown slices.
  - Facts must not contain OpenSpec opinions such as “this is definitely a requirement”.

- Add a core-owned annotation and projection plugin model.
  - Plugins register ordered annotation rules and projection rules.
  - Later annotation rules can depend on previous annotations.
  - Projections are optional outputs over the same facts and annotations; `Spec` is one projection, not the parser law.

- Add a built-in OpenSpec annotation model.
  - Annotations attach semantic labels to facts, such as `document-title`, `purpose-section`, `requirements-section`, `requirement`, `scenario`, and `scenario-step`.
  - Annotations include rule id and confidence/strength so UI can distinguish strong canonical matches from loose guesses.
  - Annotation rules must be version-tolerant and replaceable.

- Add a projection layer from annotated Markdown facts to existing contracts.
  - Existing `Spec` shape remains available as a local projection for product consumption.
  - The projection uses annotations where present and falls back to objective Markdown grouping where semantics are unknown.
  - Unknown content stays in rendered Markdown fragments and ToC, not discarded.

### Implementation Shape

1. Introduce `packages/core/src/markdown-facts.ts`.
   - Define typed node/fact interfaces.
   - Parse Markdown with a real Markdown parser dependency selected for core usage.
   - Expose stable raw Markdown slices and heading/list item text extraction.

2. Introduce `packages/core/src/markdown-reading.ts`.
   - Define typed plugin/rule/context interfaces.
   - Run annotation rules and projection rules in order.
   - Export helper APIs for heading ranges, slices, and annotation lookup.

3. Introduce `packages/core/src/openspec-annotations.ts`.
   - Define annotation interfaces and canonical semantic kinds.
   - Implement loose default plugin rules for current OpenSpec forms and common AI-mutated forms such as `Capabilities`, `Capability:`, and `Example:`.
   - Keep rules plugin-owned so future OpenSpec/community vocabulary can be added without rewriting renderer code.

4. Refactor `MarkdownParser.parseSpec`.
   - Make it consume annotated Markdown facts instead of scanning raw lines directly.
   - Produce `Spec` through the built-in projection plugin.
   - Preserve current scenario step metadata, but attach it to list-item facts first.

5. Refactor `SpecReadingModel`.
   - Consume annotated document facts instead of doing web-local string splitting.
   - Keep parsed `Spec` projection as a product input only where needed.
   - Render unknown Markdown ranges as original Markdown fragments.

6. Add tests and fixtures.
   - Canonical current OpenSpec spec.
   - Spec with extra top-level sections.
   - Spec with `#### Notes` inside a requirement.
   - Spec with fenced code containing fake headings.

- Spec with future-looking headings that should remain visible even if not semantically recognized.
- Community plugin behavior that can annotate/project custom structures without modifying core OpenSpec rules.

## Option B (Rejected Patch Path)

Keep adding regex/string cases to current parser and reading model.

This is faster short-term, but it keeps the system overfit to today's document shape:

- new official syntax would require new string branches;
- headings inside code fences could be misread;
- nested non-scenario sections remain fragile;
- web and core could keep drifting into separate parsing truths.

This path is acceptable only for emergency display bug fixes, not as the next platform law.

## Risks and Mitigations

- Risk: Adding an AST parser dependency increases core dependency surface.
  Mitigation: select a small, Markdown-standard parser and wrap it behind `markdown-facts.ts` so the rest of the repo depends only on our own typed facts.
- Risk: AST source positions may be incomplete or inconvenient for exact Markdown slicing.
  Mitigation: add tests for source-range fidelity and keep a line-offset mapper in core if the selected parser only provides line/column positions.
- Risk: Loose semantic annotation could become too fuzzy and mislabel content.
  Mitigation: annotations must expose confidence/rule id; rendering can keep the original Markdown visible and use annotations only as enhancement metadata.
- Risk: Migrating parser and reading UI together could be too large.
  Mitigation: land in layers: facts parser first, generic reading pipeline second, built-in OpenSpec plugin third, UI reading model fourth.
- Risk: Future OpenSpec official changes may add syntax that no current rule understands.
  Mitigation: unknown content is preserved by default, and new rules can be added without changing the facts layer.

## Verification Strategy

- Unit tests for Markdown facts:
  - headings inside fenced code are code content, not heading facts;
  - nested headings preserve hierarchy and source ranges;
  - lists and bold step keywords preserve raw text and plain text.
- Unit tests for OpenSpec annotations:
  - current canonical `Purpose`, `Requirements`, `Requirement:`, and `Scenario:` forms annotate strongly;
  - loose `Objective`, `Capabilities`, `Capability:`, and `Example:` forms annotate weakly;
  - non-canonical/future headings remain visible as Markdown facts even when not annotated;
  - `#### Notes` inside a requirement is not forced into a scenario.
- Parser/projection tests:
  - existing `MarkdownParser.parseSpec` tests still pass through the new projection;
  - `Spec` output remains available as projection output.
- Pipeline tests:
  - custom plugins can annotate and project custom structures without editing OpenSpec rules;
  - later rules can depend on earlier annotations.
- Web reading tests:
  - semantic reading blocks still render current fixtures;
  - unknown sections and scenario residual markdown remain visible;
  - ToC receives objective headings without duplicate semantic-only labels.
- Browser walkthrough:
  - current rich requirement body fixture;
  - a new AST-stress fixture with code-fence fake headings, nested notes, tables, and future-looking sections.
