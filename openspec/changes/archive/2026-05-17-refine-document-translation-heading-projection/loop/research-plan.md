## Research Findings

- The former spec-specific Markdown renderer creates OpenSpec heading children with two visible spans: `.openspec-heading-label` contains `Requirement:` or `Scenario:`, and `.openspec-heading-title` contains the title text.
- The heading element already carries structural metadata: `data-openspec-kind`, `data-openspec-title`, and optional `data-openspec-label`. Requirement headings use generated labels such as `REQ-01`; scenario headings use `Scenario`.
- CSS currently styles `.openspec-heading-label` as the visible label column for requirement and scenario headings. After the previous pseudo-content migration, that visible content became the semantic prefix rather than the former visual badge.
- The former translation-specific Markdown wrapper appends a final `document-translation` render processor when a complete `DocumentTranslationResult` exists.
- Direct heading translation currently replaces heading children with a translated label/title split for OpenSpec-like headings; bilingual heading translation currently appends a suffix node with the translated heading text.
- Block translation currently uses two different render shapes: direct mode replaces children with a `.document-translation-target`, while bilingual mode renders source and target siblings.
- `useDocumentTranslation` currently waits for `translateMarkdownDocument()` to resolve before setting `result`; the page cannot show partial translated segments during long document translation.
- `translateMarkdownDocument()` already loops segment-by-segment internally, so the core translation adapter has a natural boundary where per-segment patches can be emitted without changing the Markdown parser.
- The Markdown render processor chain is currently synchronous and projection-oriented. Turning every Markdown processor into an async emitter would expand the platform law beyond the translation requirement.
- ToC already consumes projected heading labels through the generic render projection and `data-toc-label`; this contract should remain translation-agnostic.
- HTML validity constrains heading children to phrasing content; segment projection inside headings should use inline elements such as `span`, not `p`.

## Decision & Plan (For Approval)

- Treat this loop as a refinement of the document translation platform and OpenSpec heading projection, not as a page-local CSS patch.
- Preserve one Markdown rendering entry: `MarkdownViewer` owns Markdown content, optional path metadata, render plugins, ToC collection, and translation action composition.
- Move spec-specific rendering from a component entry into a path-aware OpenSpec render plugin activated by `specs/<id>/spec.md`.
- Keep the Markdown render pipeline synchronous and pure: it receives Markdown plus the current translation snapshot and produces DOM projection.
- Move asynchronous behavior into the document translation session: the session extracts translation segments, translates them in order, emits per-segment patches, and updates the snapshot after each patch.
- Preserve abort semantics at the session boundary. Cancelling an in-flight session aborts the translator operation, clears the current snapshot, and prevents stale patches from mutating the rendered view.
- Refine OpenSpec heading projection into three concerns:
  - Visual badge: `REQ-03` for requirements and `Scenario` for scenarios. This may use CSS pseudo-content because it is visual decoration rather than primary text.
  - Semantic kind: `Requirement:` / `Scenario:` remains real text for accessibility and translation projection, but is visually hidden when the badge is displayed.
  - Title segment: the heading title remains the visible semantic title and participates in source/target segment projection.
- Prefer the CSS badge path for requirement/scenario labels in this loop because the source of truth already exists in `data-openspec-label`, it preserves compact DOM, and it limits real-node migration to meaningful text.
- Define one stable translation segment render model for source and target content:
  - Segment wrapper carries stable segment identity, mode, status, source language, and target language.
  - Source and target children use consistent attributes/classes in both direct and bilingual modes.
  - CSS controls whether source is visually hidden, inline, or block based on display mode and source node kind.
- Keep ToC projection outside the ToC component:
  - Direct mode projects translated labels from the current snapshot when available.
  - Bilingual mode projects source labels.
  - Pending segments fall back to source labels until target text exists.
- First implementation should use ordered sequential progressive emission. Concurrent translation, chunk scheduling, and viewport-prioritized translation can be deferred.

## Capability Impact

### New or Expanded Behavior

- Document translation can progressively render completed segments before the full document finishes translating.
- Translation snapshots can represent pending, translated, and error segment states.
- OpenSpec requirement headings visually show generated requirement badges such as `REQ-03` while retaining semantic `Requirement:` text for accessibility and translation.
- OpenSpec scenario headings visually show `Scenario` without a trailing colon while retaining semantic `Scenario:` text for accessibility and translation.
- Direct and bilingual translation share a single source/target segment DOM model with mode-specific presentation.

### Modified Behavior

- Requirement and scenario heading visible labels change from semantic prefixes back to visual badges.
- Heading translation no longer needs a separate direct-only child replacement path and bilingual-only suffix path; both modes consume the same segment projection model.
- Translation status can remain `translating` while partial translated content is visible, then transition to `translated` when all segments complete.
- `data-toc-label` continues to be projected by the rendering layer, but pending progressive translations may update it as translated heading segments arrive.

## Risks and Mitigations

- Risk: CSS pseudo-content could regress the previous goal of real selectable heading text.
  - Mitigation: only the visual badge uses pseudo-content; semantic kind and title remain real DOM text.
- Risk: visually hidden semantic kind may affect heading accessible names differently than visible labels.
  - Mitigation: add tests for heading accessible names and keep `Requirement:` / `Scenario:` in real text.
- Risk: progressive patches can race with cancellation or a new document/config.
  - Mitigation: use a session id or abort controller guard before applying each patch.
- Risk: repeated React re-renders for very large documents could be noisy.
  - Mitigation: first implementation emits ordered patches; batching/throttling can be added later without changing the segment snapshot law.
- Risk: preserving ToC generic behavior may be harder when labels update progressively.
  - Mitigation: keep projected label calculation in the heading processor and let ToC observe normal render state; do not add translation-mode branches to ToC.
- Risk: browser Translator failures on one segment could block the entire document.
  - Mitigation: record per-segment error state and continue when safe; hard capability/init failures still fail the whole session.

## Verification Strategy

- Add/update unit tests for the OpenSpec `MarkdownViewer` render plugin:
  - requirement headings expose `data-openspec-label="REQ-xx"`;
  - visible badge styling is driven from the label contract;
  - real semantic text still contains `Requirement:`;
  - scenario headings expose visual label `Scenario` without requiring visible `Scenario:`.
- Add/update unit tests for the document translation render plugin:
  - direct and bilingual modes use the same source/target segment attributes;
  - direct mode hides source from visual content while preserving source mapping;
  - bilingual mode displays source and target according to heading/list/prose layout rules;
  - ToC labels remain translated in direct mode and source-based in bilingual mode.
- Add/update tests for progressive translation:
  - translation session renders the first completed segment before later segments resolve;
  - final status becomes `translated` after all segments finish;
  - cancel aborts in-flight translation and clears partial output.
- Run focused tests:
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer.test.tsx src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/document-translation-action.test.tsx src/components/opsx/artifact-output-viewer.test.tsx src/lib/browser-translation.test.ts`
- Run affected package gates:
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter @openspecui/web build:ssg`
- Before archive or PR, run repository-level gates or document a scoped subset if unrelated workspace files still block global formatting.
