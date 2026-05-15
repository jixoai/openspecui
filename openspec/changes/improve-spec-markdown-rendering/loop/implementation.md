## Implementation State

Implemented locally through the parser, server raw Markdown route, static provider,
and shared web rendering primitive. Verification is complete for the scoped gates
and the change is ready for user walkthrough.

Completed platform-first slices:

1. Added parser regression tests that demonstrate the current issues from `tmp/issue-139-140-repro`.
2. Fixed core parsing so requirement body content remains requirement body content and scenario parsing starts only from explicit `#### Scenario:` headings.
3. Added `SpecMarkdownDocument` as the spec-aware Markdown rendering primitive in the web package.
4. Routed live spec detail rendering through processed raw Markdown plus structural enhancement.
5. Routed static spec detail rendering through the same processed Markdown render source.
6. Updated ToC/spec rendering tests for semantic markers and href/id alignment.
7. Added a changeset for release-impacting package changes.
8. Fixed the shared ToC atom so narrow sticky mode scrolls inside the ToC panel instead of overflowing the viewport.
9. Added a Requirements heading count chip as parsed-structure enhancement while keeping ToC labels and Markdown source text unchanged.
10. Promoted badge/chip geometry into a shared `Badge` / `CountBadge` atom and migrated Requirements, notification entry, terminal unread, notification aggregate counts, Git file counts, and workflow phase chips to it.

## Decisions Taken

- Spec detail visual rendering will be Markdown-first: processed Markdown is the source of rendered content.
- Structural parsing remains required, but it is an enhancement/data layer instead of the visual reconstruction layer.
- CSS may style OpenSpec semantic markers, but parser/AST metadata must remain the source of objective counts and anchors.
- The fix must not add a new hooks API; `onReadDocument` already supplies the processed Markdown document.
- Live and static modes must share the same spec Markdown rendering component.

## Divergence Notes

- Earlier pure-structure model replacement was superseded by a hybrid law: direct Markdown rendering plus structural enhancement.
- The current `opsx-collab-pr-loop` schema does not create delta spec files directly. This loop records the implementation contract through intake, research-plan, implementation, and checkpoints.
- The parser schema now separates requirement/scenario `title` and `bodyMarkdown` while preserving `text`/`rawText` as objective full-text fact fields for validation, search, and existing statistics.
- The server `spec.getRaw` / `spec.subscribeRaw` path now uses `DocumentService.readSpecRaw(..., "processed")`, so hook-processed Markdown is the live detail render source.
- The static provider now returns snapshot `content` before `sourceContent` for `getSpecRaw`, so static detail rendering uses the same processed Markdown law as live mode.
- `MarkdownViewer` gained a generic heading transform extension point. `SpecMarkdownDocument` uses it to mark OpenSpec headings without adding a new hook API or a second Markdown pipeline dependency.
- `MarkdownViewer` heading transforms now support a visible `suffix` slot. `SpecMarkdownDocument` uses that slot for the Requirements count chip, while the ToC collector continues to receive the plain `Requirements` label.
- The Requirements count chip is driven by parsed `Spec.requirements.length`; CSS only styles the already-attached semantic marker and does not own the business fact.
- The shared `Toc` atom now separates sticky ownership from scroll ownership: `.toc-root` remains sticky, and `.toc-scroll` panels own overflow in narrow and wide layouts.
- User walkthrough is served from a temporary OpenSpec project at `http://localhost:13003/specs/toc-overflow` and `http://localhost:13003/specs/rich-requirement-body`; the web server proxies to the temporary backend on port `13140`.
- Browser evidence for the narrow ToC and Requirements chip verified `hasHorizontalOverflow: false`, internal ToC scrolling, `Requirements 12` in the document heading, and plain `Requirements` in ToC labels.
- Existing chip-like needs split into two stable groups: generic badge geometry and numeric count formatting. `Badge` owns visual geometry and allows domain-owned semantic colors through `tone="custom"`; `CountBadge` owns count formatting and `99+` capping. Requirements count, notification counts, terminal unread badges, Git file counts, and workflow phase chips now share `packages/web/src/components/badge.tsx`.

## Related Surface Investigation

- `packages/web/src/components/change-overview.tsx` already renders proposal, design, and delta spec content through `MarkdownViewer`; it builds page section shells, but does not reconstruct requirement/scenario body Markdown from parsed facts.
- `packages/web/src/components/opsx/artifact-output-viewer.tsx` already renders artifact output and file content as raw Markdown strings; the file wrapper is only a grouping shell.
- `packages/web/src/routes/config.tsx` uses `MarkdownViewer` for config/schema Markdown previews and is not reconstructing OpenSpec requirement bodies.
- Current conclusion: `spec-view.tsx` was the only confirmed surface where parsed requirement/scenario facts were used as the primary visual reconstruction source. Other Markdown surfaces can later gain domain-specific semantic markers, but they do not need the #139/#140 repair pattern now.

## Loopback Triggers

- If Markdown rendering requires capabilities beyond the current `react-markdown` component override layer, return to research before adding a new Markdown AST pipeline dependency.
- If ToC cannot represent both normal Markdown headings and OpenSpec structures without duplicate or unstable ids, return to research and redesign the ToC collector API.
- If static export cannot share the live rendering path without snapshot shape changes, return to research and update the snapshot contract explicitly.
