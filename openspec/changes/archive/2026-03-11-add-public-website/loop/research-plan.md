## Research Findings

- The repository already has a private Vite + React workspace pattern in `packages/app`, including Tailwind v4 setup, Vitest, and aliasing to `packages/web/src` for shared UI/style assets.
- Shared product tokens, fonts, dark-mode variables, and utility classes already live in `packages/web/src/index.css`; importing that stylesheet keeps the website visually aligned with OpenSpecUI.
- The public site requirements are intentionally narrow: a lightweight landing page, bilingual copy, and a few outbound links. A single-page React app is sufficient.
- Official i18next guidance supports `i18next + react-i18next + i18next-browser-languagedetector` with inline resources, `fallbackLng`, `supportedLngs`, and localStorage-backed language detection.
- Cloudflare Pages supports static header policies through `_headers`; HTML and service worker style entrypoints should revalidate, while hashed assets can be immutable.
- Workspace tooling (`pnpm-workspace.yaml`) already includes `packages/*`, so a new `packages/website` folder automatically joins install, typecheck, and test flows once it has standard scripts.

## Decision & Plan (For Approval)

- Create `packages/website` as a private Vite + React workspace with TypeScript, Vitest, and Tailwind v4.
- Implement i18n with `i18next`, `react-i18next`, and `i18next-browser-languagedetector`, using inline resource objects for English and Simplified Chinese.
- Reuse OpenSpecUI style tokens by importing `packages/web/src/index.css` from the website stylesheet and keeping the page visually compact rather than building a separate marketing system.
- Build a single-page layout with three practical concerns:
  - what OpenSpecUI is
  - how to launch it
  - where to go next (`app`, OpenSpec official site, GitHub)
- Add a workspace README plus Cloudflare-oriented `_headers` so the site is ready for static deployment on `www.openspecui.com`.
- Expose the new workspace in repo-level dev ergonomics with a dedicated dev script and an optional dev-tui task.

## Capability Impact

### New or Expanded Behavior

- Adds a dedicated public website workspace for static deployment.
- Adds bilingual client-side language switching for the website.
- Adds deployment documentation and cache headers for the public site.

### Modified Behavior

- Extends root developer ergonomics to run the website workspace locally.
- Updates repository documentation to mention the hosted app flow and public website entrypoints.

## Risks and Mitigations

- Risk: the public site drifts into generic marketing UI unrelated to the product.
  - Mitigation: reuse existing CSS tokens/components and keep content product-focused.
- Risk: language resources diverge between English and Chinese.
  - Mitigation: define a shared resource shape in TypeScript so both locales must satisfy the same keys.
- Risk: Cloudflare cache rules accidentally make HTML too sticky.
  - Mitigation: keep `_headers` simple and restrict `immutable` to hashed asset paths only.

## Verification Strategy

- Run workspace-local typecheck and tests for `@openspecui/website`.
- Run repo-level format, lint, typecheck, and test gates before PR.
- Verify the site renders both languages and keeps the OpenSpecUI visual tokens.
- Verify build output includes the expected static deployment files for Cloudflare Pages.
