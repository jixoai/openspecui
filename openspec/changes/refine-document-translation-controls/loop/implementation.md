## Implementation State

Implementation is complete for the code-level scope and focused verification has passed.

Completed construction:

1. Added semantic ToC header action descriptors and root ownership semantics.
2. Moved translation ToC contribution to the `document-translation` action slot.
3. Added a sessionStorage-backed translation activation atom.
4. Bound translation button actions to the session activation atom and made eligible document sessions auto-start from it.
5. Added the supported translation language catalog and search helpers.
6. Replaced the Settings target-language `Select` with a focused searchable language combobox.
7. Fixed cancel semantics so the busy translation button also turns the session activation off.
8. Added focused unit tests and synchronized checkpoints.
9. Refined the Settings language combobox to use native `popover="auto"` lifecycle, preserve committed labels on open, expose an explicit quick-clear button, and restore the previous valid label on dismissed empty drafts.
10. Reordered Settings' shared `Toc` before `.toc-page-content` so the existing narrow/wide `Toc` atom can render a collapsible narrow control above content.

## Decisions Taken

- The ToC remains generic. It may own semantic action slots, but it must not branch on translation mode or know browser Translator details.
- A semantic action slot is not a feature flag. It is an ownership key that lets multiple document atoms contribute the same logical action to one ToC surface without multiplying controls.
- `document-translation` is the first semantic ToC action slot.
- Translation session activation is browser-session user intent and belongs in `sessionStorage`, not project config.
- Project translation config remains the hard capability gate. Session activation cannot override `translation.enabled === false`.
- The translation button is the only UI surface that writes the session activation state for this loop.
- Canceling an in-flight translation through the translation button writes `source`, because cancel is also a user request to stop the session-level simulated behavior.
- Language catalog storage values remain language codes.
- Language options are sorted by code.
- Language labels use English plus native/target-language display text.
- Language search reuses the shared search engine rather than introducing a new fuzzy-matching library.
- The language picker is a focused Settings atom rather than a broad rewrite of the shared `Select` component.
- `@openspecui/search` now accepts generic string document kinds so small local indexes, such as translation language search, can reuse the same engine without pretending to be a spec/change/archive document.
- Automatic session activation starts only from `source` status. Translation failures do not loop indefinitely; manual button clicks remain the retry path.
- Settings language selection keeps committed config as the only stored value; empty query text is an uncommitted draft and is discarded on popover dismissal.
- The final Settings language picker shape is a committed trigger button outside the popover, with search input and quick-clear inside the popover; the button only reflects the committed language.
- Settings ToC compatibility is a layout-order fix, not a new ToC mode.
- Shared ToC sticky positioning now keeps a default top offset via `--toc-sticky-top` instead of pinning to `top: 0`, so sticky state preserves the page's normal breathing room.
- Narrow shared ToC now owns its dismissal behavior: outside pointer interactions, focus leaving the ToC, and Escape collapse the narrow panel across every page that uses `Toc`.
- ToC anchor targets now share `toc-anchor-target` and `scroll-margin-top`; custom `viewer-scroll` hash navigation reads that computed margin instead of using a fixed offset.
- ToC link navigation collapses the narrow panel after a successful anchor jump, so the expanded menu does not cover the target section.

## Divergence Notes

- Broadening `@openspecui/search` document kinds was small and passed search/web/server typechecks, so no adapter layer was needed.
- The original plan allowed auto-start from `source` or `error`. Implementation narrowed that to `source` to avoid repeated automatic retries after a failed translation.

## Loopback Triggers

- If semantic ToC action slots cannot be added without breaking existing wide/narrow ToC header rendering, return to research-plan and redefine the header action contract.
- If session auto-start causes repeated translation loops or unbounded re-entry under React effects, return to research-plan and define a stricter activation lifecycle.
- If browser `sessionStorage` access creates SSR/static rendering issues, return to research-plan and specify the static-mode fallback.
- If language search cannot reuse `@openspecui/search` without unsafe type casts or broad package breakage, return to research-plan before adding a new search library.
- If the language combobox requires rewriting the global `Select` atom to be correct, return to research-plan before widening the shared component contract.
- If native popover support needs a browser fallback, add it as a shared top-layer compatibility atom rather than reintroducing page-local outside-click logic.
