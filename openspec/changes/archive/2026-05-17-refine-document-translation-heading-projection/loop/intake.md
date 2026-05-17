## User Input

- The current translated heading structure renders OpenSpec semantic heading labels such as `Requirement:` as visible real nodes after migrating away from pseudo-content.
- The visual label should still render like the prior design: requirement headings should visually show labels such as `REQ-03`, and scenario headings should visually show `Scenario` without a colon.
- `Requirement:` can still be translated for accessibility; it does not need to be visually visible.
- `REQ-03` can remain a pseudo-element rendered from the existing label node because it is a visual marker, or it can be rendered as nested real nodes such as `<span><span>REQ-03</span><span>Requirement: </span></span>`.
- The current translation waits for the full document translation result before updating the page.
- Translation should be optimized toward asynchronous iterative updates so long documents do not require waiting for every segment before showing translated content.
- Because translation is Markdown-oriented rather than HTML-oriented, the translation plugin architecture needs a way to emit multiple updates over time.

## Objective Scope

- Refine OpenSpec semantic heading projection so visual badges, accessibility semantics, and translated title content are separate concerns.
- Preserve the visual heading badge behavior for requirement and scenario headings while keeping semantic labels available to accessibility and translation projection.
- Define a stable translation segment projection shape that can represent source text, translated text, language metadata, and segment status without requiring separate direct and bilingual DOM structures.
- Extend the document translation architecture so translation sessions can progressively emit segment updates while the Markdown render pipeline consumes a current translation snapshot.
- Keep ToC behavior generic: ToC continues to consume projected labels through the existing label contract rather than branching on translation-specific state.

## Non-Goals

- Do not reintroduce pseudo-elements as the primary visible document text for headings or titles.
- Do not build a general-purpose HTML page translation engine.
- Do not classify or skip ambiguous numeric tokens such as `1.2` in this loop.
- Do not persist translated text as a second source document truth.
- Do not add translation-specific branching into the shared ToC component.
- Do not require concurrent translation batching in the first progressive implementation; ordered iterative updates are acceptable.

## Acceptance Boundary

- Requirement headings visually render their existing OpenSpec badge label, such as `REQ-03`, rather than visibly rendering only `Requirement:`.
- Scenario headings visually render `Scenario` without a trailing colon.
- Semantic labels such as `Requirement:` and `Scenario:` remain available as real text for accessibility and translation projection.
- Heading title source and target content share a stable segment structure that can support both direct and bilingual display modes.
- Direct and bilingual display modes can be controlled from the same segment model without duplicating translation-specific document structures.
- Document translation can update the rendered document incrementally as segment translations complete, and users can still abort an in-flight translation session.
- Existing `data-toc-label` projection semantics remain generic and continue to drive ToC labels without coupling ToC to translation modes.
