## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Option A platform-law plan selected
- [x] 1.4 Option B local patch documented and rejected

## 2. Platform Updates

- [x] 2.1 ToC header action registry supports semantic action slots
- [x] 2.2 Root ToC renders at most one action per semantic slot
- [x] 2.3 Translation action uses the `document-translation` slot
- [x] 2.4 Existing non-slotted ToC header actions keep working

## 3. Translation Session Behavior

- [x] 3.1 Session activation atom reads and writes `sessionStorage`
- [x] 3.2 Translation button writes active state when the user starts translation
- [x] 3.3 Translation button writes inactive state when the user returns to source
- [x] 3.4 Eligible document sessions auto-start when session activation is active
- [x] 3.5 Disabled project translation still routes to Settings and does not auto-start

## 4. Language Catalog and Settings

- [x] 4.1 Supported language catalog contains all requested language codes
- [x] 4.2 Catalog labels include English and native/target-language text
- [x] 4.3 Catalog/options sort by language code
- [x] 4.4 Language search matches code, English label, and native label using the shared search engine
- [x] 4.5 Settings target language control is searchable/autocomplete-style
- [x] 4.6 Settings still stores only the selected language code
- [x] 4.7 Settings target language control preserves the committed label when opened
- [x] 4.8 Settings target language control exposes an explicit quick-clear action
- [x] 4.9 Settings target language control restores the previous valid label when a cleared draft is dismissed
- [x] 4.10 Settings target language control uses native HTML popover lifecycle

## 5. Settings ToC Layout

- [x] 5.1 Settings renders the shared ToC before page content like other ToC pages
- [x] 5.2 Settings narrow screens can use the shared collapsible ToC control

## 6. Verification

- [x] 6.1 Unit tests cover nested/merged ToC translation action dedupe
- [x] 6.2 Unit tests cover sessionStorage activation on, off, and auto-start
- [x] 6.3 Unit tests cover language catalog completeness and search
- [x] 6.4 Settings tests cover searchable language selection and persisted code value
- [x] 6.5 Settings tests cover language selector open/clear/dismiss behavior and ToC narrow-compatible ordering
- [x] 6.6 Focused web tests pass
- [x] 6.7 Typecheck passes for affected packages
- [x] 6.8 Rendered QA confirms one translation button and shared session state on real pages

## 7. Workflow Gates

- [x] 7.1 Implementation progress synchronized with this artifact
- [x] 7.2 Unexpected issues loop back to intake/research-plan before continuing
- [x] 7.3 Changeset included for release-impacting package changes
- [x] 7.4 CI-equivalent local checks pass or scoped exceptions are documented
- [ ] 7.5 PR checks pass before merge
- [ ] 7.6 OpenSpec archive flow completed after acceptance

## Verification Notes

- `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/settings.test.tsx`: 6 tests passed after the Settings language selector and ToC follow-up refinement.
- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer.test.tsx src/components/document-translation-action.test.tsx src/lib/document-translation-session-state.test.tsx src/lib/translation-languages.test.ts src/routes/settings.test.tsx`: 33 tests passed.
- `pnpm --filter @openspecui/search test`: 4 tests passed.
- `pnpm --filter @openspecui/web typecheck && pnpm --filter @openspecui/search typecheck && pnpm --filter @openspecui/server typecheck`: passed.
- `pnpm lint:ci`: passed.
- `pnpm --filter @openspecui/web exec vitest run --project unit src/entry-client-static.test.tsx src/lib/static-data-provider.opsx.test.ts`: 10 tests passed.
- `pnpm --filter @openspecui/web build:ssg`: passed with existing CSS pseudo-element and dynamic import warnings.
- Rendered QA on `http://127.0.0.1:13003` passed for Settings language search, session-shared translation activation, and a temporary active `spec-driven` glob-artifact fixture; the fixture was deleted after QA.
- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/anchor-scroll.test.ts src/components/markdown-viewer.test.tsx src/routes/settings.test.tsx`: 24 tests passed after shared ToC sticky offset, narrow dismissal, link-collapse, and anchor scroll-margin refinement.
- Rendered QA on `http://127.0.0.1:13003/settings` confirmed shared ToC `top: 16px`, narrow outside-click dismissal, narrow link-collapse, and `#settings-translation` target `scroll-margin-top: 64px`.
- `pnpm format:check` is blocked by unrelated dirty files: `openspec/changes/evaluate-vite-node-runtime-build/loop/intake.md` and `packages/cli/src/dev-conditional-exports.test.ts`. Task-owned files pass `prettier --check` and `git diff --check`.
- `pnpm --filter @openspecui/web test -- src/entry-client-static.test.tsx src/lib/static-data-provider.opsx.test.ts` does not forward file filters through this package script and ran the full web unit suite; unrelated terminal invocation tests failed there. The targeted static tests were re-run with direct `vitest` and passed.
