## Implementation State

- Planning approved in chat.
- Implementation complete on branch `website-sveltekit-static-docs`.

## Decisions Taken

- Treat SvelteKit as the website platform law, not as a line-by-line React rewrite.
- Keep Cloudflare Pages as static hosting and continue outputting to `dist`.
- Use localized SvelteKit routes for public language state.
- Use mdsvex for documentation pages and Svelte components for interactive homepage surfaces.
- Reuse shared product CSS tokens from `packages/web/src/index.css` without importing React runtime atoms.
- Keep `packages/website/static` as the SvelteKit static asset source so Cloudflare headers and icons continue to land in `dist`.
- Make `/` an automatic browser-language entrypoint: `navigator.languages` matching `zh` routes to `/zh/`, matching `en` routes to `/en/`, and unmatched languages default to `/en/`.
- Generate hook example code blocks with Shiki during SvelteKit prerender so the static site ships highlighted HTML instead of a browser highlighter.
- Reuse the existing `light | dark | system` theme contract from `@openspecui/web-src/lib/theme` for the website header switcher.

## Divergence Notes

- The approved plan mentioned Paraglide as the preferred SvelteKit i18n route. During implementation, a local typed content layer is used for the first static migration to avoid generated integration churn while keeping URL locale routing intact.
- The desktop homepage smoke test exposed a hero sidebar clipping issue at 1280px. The fix raised the wide inner-grid breakpoint instead of adding content-specific text hacks.
- The initial language picker at `/` was removed because the route should infer the best language from browser preferences instead of asking the user first.
- Shiki uses the `github-light-default` / `github-dark-default` pair because its keyword reds align with OpenSpecUI's primary red while keeping syntax contrast predictable in both themes.

## Verification Evidence

- 2026-05-12 14:43 CST: `pnpm format:check` passed.
- 2026-05-12 14:41 CST: `pnpm lint:ci` passed.
- 2026-05-12 14:43 CST: `pnpm typecheck` passed across the monorepo, including `svelte-check found 0 errors and 0 warnings` for `@openspecui/website`.
- 2026-05-12 14:43 CST: `pnpm test:ci` passed across the monorepo.
- 2026-05-12 14:37 CST: `pnpm --filter @openspecui/website test` passed with 7 files and 13 tests after adding Shiki, theme switcher, and theme bootstrap coverage.
- 2026-05-12 14:37 CST: `pnpm --filter @openspecui/website typecheck` passed with `svelte-check found 0 errors and 0 warnings`.
- 2026-05-12 14:37 CST: `pnpm --filter @openspecui/website build` passed and wrote SvelteKit static output to `packages/website/dist`.
- Static output includes `/`, `/en/`, `/zh/`, `/en/hooks/`, and `/zh/hooks/`.
- Browser smoke test passed against `vite preview` on `http://127.0.0.1:13009`.
- Browser smoke verified `/` language routing: `zh-CN -> /zh/`, `fr-FR -> /en/`.
- Browser smoke verified both locale home pages expose a page-level `h1`.
- Browser smoke verified `/en/hooks/` exposes a page-level `h1`, includes `onReadDocument`, and renders `.shiki-code .shiki`.
- Browser smoke verified stored `theme=dark` applies `.dark` before interaction, and Shiki dark code background is `rgb(13, 17, 23)`.
- Browser smoke verified header theme controls persist and apply `light`, `dark`, and `system`.
- `git diff --check` passed.

## Loopback Triggers

- If SvelteKit static output cannot preserve `dist` deployment compatibility.
- If mdsvex route generation blocks strict static prerender.
- If shared product CSS imports introduce browser/runtime coupling failures.
