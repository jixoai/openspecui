## Research Findings

- `packages/website` is currently a React 19 + Vite app with a single `src/app.tsx` page, `i18next` runtime localization, and `dist` Cloudflare Pages output.
- The website currently imports `../../web/src/index.css` to reuse OpenSpecUI product CSS tokens.
- Current deploy scripts use `wrangler pages deploy dist --project-name openspecui-website`; `wrangler.jsonc` points `pages_build_output_dir` at `./dist`.
- SvelteKit static generation is implemented with `@sveltejs/adapter-static` and `export const prerender = true`; SSR must stay enabled so prerendered pages contain real HTML.
- SvelteKit file routing gives the site a natural platform boundary for `/en/`, `/zh/`, `/en/hooks/`, and `/zh/hooks/`.
- Svelte 5 uses runes such as `$state`, `$derived`, and `$props`; SvelteKit layout props use snippet rendering through `children`.
- `mdsvex` is the Svelte ecosystem markdown preprocessor for documentation pages.
- Paraglide is the SvelteKit-recommended compiler-first i18n integration, but the generated integration can be heavier than this first static-site migration requires.

## Decision & Plan (For Approval)

- Replace the React/Vite app with a SvelteKit project inside the existing `@openspecui/website` workspace.
- Use `adapter-static({ pages: 'dist', assets: 'dist', strict: true })` and route-level prerendering.
- Use URL-level locales with canonical SvelteKit routes at `/[lang=locale]/` and `/[lang=locale]/hooks/`.
- Use a small typed local i18n/content layer for this first migration, while preserving a clean path to Paraglide when message extraction becomes valuable.
- Configure mdsvex for documentation-capable routing and put the hooks article in localized `.svx` routes.
- Keep deployment scripts and output directory stable for Cloudflare Pages.

## Capability Impact

### New or Expanded Behavior

- Website can grow from landing page to static documentation site without a framework rewrite.
- Hooks documentation becomes first-class public website content.
- Locale-specific pages become shareable and SEO-addressable URLs.

### Modified Behavior

- Language switching changes from query/localStorage state to URL navigation.
- Website tests move from React Testing Library to Svelte Testing Library and SvelteKit checks.
- Website build changes from `vite build` to `svelte-kit build`.

## Risks and Mitigations

- Risk: Paraglide integration may add generated files and routing hooks that are disproportionate for a two-locale static site.
  Mitigation: use typed local content now, keep locale boundaries and content keys compatible with later Paraglide adoption.
- Risk: mdsvex route typing can become brittle.
  Mitigation: keep mdsvex usage limited to documentation route pages and test generated static output.
- Risk: importing product CSS from `packages/web/src` can still couple website visuals to product tokens.
  Mitigation: preserve the existing coupling intentionally as visual token reuse, not runtime component reuse.

## Verification Strategy

- Run `pnpm --filter @openspecui/website typecheck`.
- Run `pnpm --filter @openspecui/website test`.
- Run `pnpm --filter @openspecui/website build`.
- Inspect generated `dist` routes and smoke-test the static pages in a browser.
