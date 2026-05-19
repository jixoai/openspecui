## Research Findings

- `MarkdownViewer` already exposes a shared render-plugin contract. `useDocumentTranslationRenderPlugin()` contributes processors, block annotations, and a `tocHeaderAction` through this contract.
- Root and nested document viewers share one `TocCollector`. Nested viewers call `registerHeaderAction(viewerId, key, action)`, and the root viewer merges every registered action into the single ToC header.
- Glob/change artifact pages render one root `MarkdownViewer` builder and then render one nested `MarkdownViewer` per file. Each nested viewer receives `translationConfig`, so each file contributes its own translation button into the root ToC header.
- The current header-action registry is keyed by physical viewer id. It has no semantic slot or ownership rule, so it cannot say "there may be many translated documents, but only one translation action for this ToC surface."
- The current translation session state lives inside each `useDocumentTranslation(markdown, config)` call. Clicking the translation button starts, cancels, or resets only that viewer session. There is no session-scoped user intent shared across document pages.
- `sessionStorage` is the right persistence boundary for the requested behavior because it models same-session user intent without changing durable project config.
- Translation enablement remains a project setting. Session activation should not make disabled translation silently run; if project translation is disabled, the button should still route to Settings.
- Settings currently defines `TRANSLATION_TARGET_LANGUAGE_OPTIONS` inline with only seven English-only labels: `zh`, `en`, `ja`, `ko`, `fr`, `de`, and `es`.
- The shared `Select` atom is a Base UI select wrapper and currently has no search input or autocomplete behavior. Adding autocomplete to this generic atom would widen the shared control contract for every caller, not just the language picker.
- `@openspecui/search` already provides `buildSearchIndex()`, `searchIndex()`, `normalizeText()`, and weighted matching across `title`, `path`, and `content`. It can be reused as the language picker search engine by mapping language code, English label, and native label into search documents.
- The existing `opsx-ui-views` spec already says the ToC must stay generic and consume projected labels rather than branch on translation mode. The new behavior should preserve that law: ToC may know about semantic action slots, but it should not know translation algorithm details.

## Decision & Plan (For Approval)

### Option A: Platform-Law Upgrade (Recommended)

Upgrade the document reading control plane with three small, reusable laws:

1. **ToC action slot ownership**
   - Replace physical-only header action aggregation with semantic action descriptors.
   - A root ToC surface renders at most one action per semantic slot, for example `document-translation`.
   - Nested viewers may still register actions, but the root registry deduplicates by slot and chooses one owner deterministically.
   - This keeps change/glob pages from accumulating one translation button per merged file while preserving future support for other ToC header actions.

2. **Session-scoped translation activation**
   - Add a browser-only session state atom backed by `sessionStorage`.
   - Translation button clicks update this atom when the user asks to translate or return to source.
   - `useDocumentTranslation()` observes that atom and auto-starts when the current document is eligible, project translation is enabled, and the session state is active.
   - Canceling an in-flight translation remains local to the current document unless the user explicitly toggles back to source.

3. **Searchable language catalog atom**
   - Move the supported translation languages into a dedicated catalog module.
   - Store and sort by language code.
   - Display bilingual labels as English plus native/target-language name.
   - Build language search with `@openspecui/search`, indexing code, English label, and native label.
   - Implement a focused `LanguageCombobox` for Settings rather than forcing every shared `Select` caller to become searchable.

### Option B: Local Patch (Rejected)

- Hide duplicate translation buttons only inside change/glob artifact pages.
- Add per-page effects that start translation on navigation.
- Replace the Settings language array with a longer English-only `Select`.

This would fix the immediate screenshot but would pollute feature pages with translation-specific behavior, keep the ToC action registry physically keyed, and create a second local truth for language search. It would also fail future merged document surfaces that are not change pages.

## Capability Impact

### New or Expanded Behavior

- A single ToC surface renders at most one translation action for the document-translation slot, even when many nested Markdown files are merged into that surface.
- A user's translate/source choice is remembered in `sessionStorage` and shared by supported document pages in the same browser session.
- Settings exposes the full supported language catalog with bilingual labels.
- The language picker supports autocomplete-style fuzzy filtering over language code, English label, and native label.

### Modified Behavior

- Nested document viewers no longer directly append unlimited React action nodes into the ToC header. They register semantic actions that the root surface owns.
- Translation start/reset behavior becomes button-bound user intent rather than only per-viewer local state.
- Settings no longer owns the supported translation language list inline.

## Risks and Mitigations

- Risk: Deduplicating by slot could hide non-translation actions in future nested viewers.
  Mitigation: model the registry as semantic slots, not a translation boolean; only actions that explicitly share a slot replace each other.
- Risk: Auto-start can create repeated translation work when navigating quickly.
  Mitigation: keep the existing abortable session controller and only start when status is `source` or `error`.
- Risk: A stale sessionStorage value could auto-start when translation is disabled.
  Mitigation: project config remains the hard gate; disabled translation still sends users to Settings.
- Risk: Language native names can be controversial across locale variants.
  Mitigation: catalog entries are explicit and code-owned; storage remains the language code.
- Risk: `@openspecui/search` document kinds are currently spec/change/archive.
  Mitigation: either broaden the search package kind type to support generic local indexes, or add a small typed adapter if broadening the package would be too disruptive.

## Verification Strategy

- Add unit coverage for ToC header action slot ownership using a root `MarkdownViewer` with multiple nested translatable `MarkdownViewer` instances.
- Add unit coverage for session-scoped translation activation:
  - clicking Translate writes the active session state;
  - a later document auto-starts translation when the state is active;
  - clicking Show source writes the inactive state.
- Add unit coverage for the translation language catalog:
  - all requested language codes are present;
  - options are sorted by code;
  - labels include English plus native/target-language text;
  - search matches code, English label, and native label.
- Add Settings component coverage that the target language control renders a searchable combobox and stores the selected language code.
- Run focused web unit tests around `markdown-viewer`, `document-translation-action`, language catalog/search, and Settings.
- Run `pnpm --filter @openspecui/web typecheck` and package-level checks affected by any search package type change.
- Perform rendered QA on a change/glob artifact page to confirm one visible translation button and session-shared behavior across pages.

## Follow-up Research Findings: 2026-05-19

- `TranslationLanguageCombobox` in `packages/web/src/routes/settings.tsx` used local `open` state plus an absolutely positioned `div`, not a native HTML popover. That meant browser light-dismiss was not the source of truth.
- The same component cleared the query on focus, so opening the selector destroyed the visible committed label before the user typed.
- Settings already has a native popover precedent in `FontFamilyEditor`, using `popover="auto"` and `hidePopover()`.
- The shared `Toc` component already renders both `.toc-narrow` and `.toc-wide`; Settings blocked the useful narrow ordering by placing `<Toc>` after `.toc-page-content`.
- `MarkdownViewer` places `<Toc>` before `.toc-page-content`, letting narrow mode appear above content while CSS grid ordering still puts the sidebar on the right for wide containers.

## Follow-up Decision

- Keep the language selector as a focused Settings atom, but align it with the platform top-layer law by using `popover="auto"` and the native `toggle` event as the close signal.
- Separate committed value from draft search text. Opening preserves the committed label; typing or the explicit clear button starts a draft search; closing without a selection restores the last valid committed label.
- Do not change the shared `Toc` atom. Move Settings' existing `<Toc>` before `.toc-page-content` so it follows the same structural law as other ToC pages.
