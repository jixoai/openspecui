## Implementation State

Implementation completed the approved three-part plan:

1. Add parsed scenario step metadata.
2. Add a semantic SPEC reading model and renderer.
3. Apply purpose, requirement, scenario, step, and mobile ToC reading improvements.

## Decisions Taken

- Keep Markdown-first rendering as the governing law.
- Add scenario steps as parsed facts, not CSS-owned string decorations.
- Use `MarkdownViewer` builder mode for semantic wrappers and nested `MarkdownViewer collectToc={false}` for body fragments.
- Preserve authored Markdown that is outside the canonical Purpose/Requirements structure:
  - non-standard top-level sections before or after `## Requirements` render as Markdown fragments;
  - prose under `## Requirements` before the first requirement renders as intro Markdown;
  - scenario body lines that are not parsed step items render below step badges.
- Extend `MarkdownViewer` builder headings with `tocLabel` so visible heading adornments, such as count badges, do not pollute ToC text.
- Keep the ToC overflow behavior in the shared `Toc` surface, so narrow mode constrains the panel to the viewport and scrolls internally.

## Divergence Notes

- The original plan warned that semantic rendering could drop authored Markdown. During implementation this became a concrete issue, so the reading model was expanded to include raw Markdown context and residual scenario body content instead of reconstructing only parsed OpenSpec facts.
- Browser validation used Playwright fallback because the Browser plugin's required JavaScript control tool is not exposed in this environment. The walkthrough still verified the rendered local app with desktop and narrow viewports.

## Verification Evidence

- `cd packages/core && pnpm exec vitest run src/parser.test.ts src/validator.test.ts` passed: 2 files / 21 tests.
- `cd packages/web && pnpm exec vitest run --project unit src/components/spec-reading-model.test.ts src/components/spec-markdown-document.test.tsx src/components/markdown-viewer.test.tsx` passed: 3 files / 13 tests.
- `pnpm --filter @openspecui/core typecheck` passed.
- `pnpm --filter @openspecui/web typecheck` passed.
- `pnpm format:check` passed.
- `pnpm --filter @openspecui/web test -- src/lib/static-data-provider.dashboard.test.ts src/lib/static-data-provider.spec.test.ts` completed the web unit project: 75 files / 335 tests passed.
- Playwright walkthrough passed against `http://localhost:13006` with backend `http://localhost:13141` using `tmp/issue-139-140-repro/project`.
  - Desktop fixture: `/specs/rich-requirement-body`, screenshot `/tmp/openspecui-rich-spec-desktop.png`.
  - Narrow fixture: `/specs/toc-overflow`, screenshot `/tmp/openspecui-toc-mobile-expanded.png`.
  - Verified purpose zone, `REQ-01`/`REQ-02`, scenario cards, `WHEN`/`THEN`/`AND` badges, plain `Requirements` ToC label, no narrow horizontal overflow, and internal ToC scrolling.
  - Console only reported the existing Lit dev-mode warning in development.

## Loopback Triggers

- If semantic builder rendering cannot preserve authored Markdown fragments, return to research before continuing.
- If scenario step parsing needs a full Markdown AST dependency, return to research before adding it.
- If mobile ToC requires changing the shared ToC contract, return to research before editing page-local CSS.
