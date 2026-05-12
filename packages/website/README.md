# @openspecui/website

Public landing site for `www.openspecui.com`.

## Scope

This workspace is a small static website and documentation entrypoint:

- introduce OpenSpecUI
- show the primary launch commands
- document stable project-facing features such as `openspecui.hooks.ts`
- link to the hosted app, OpenSpec official site, and GitHub
- support English and Simplified Chinese URL routes

It is not a dynamic docs CMS. Content is versioned with the repository and prerendered as
static HTML.

## Stack

- Svelte 5
- SvelteKit
- `@sveltejs/adapter-static`
- mdsvex for documentation-capable pages
- Tailwind CSS v4 through the shared OpenSpecUI token stylesheet

## Local Development

```bash
pnpm --filter @openspecui/website dev
pnpm --filter @openspecui/website typecheck
pnpm --filter @openspecui/website test
pnpm --filter @openspecui/website build
pnpm --filter @openspecui/website cf:dev
```

## Internationalization

The public language state is URL-based:

- `/en/`
- `/zh/`
- `/en/hooks/`
- `/zh/hooks/`

Locale content lives in `src/lib/i18n/locales`. Keep route URLs stable because they are
the shareable and SEO-addressable contract.

## Content Model

- Use Svelte components for interactive product surfaces.
- Use `.svx` route pages for documentation content that benefits from Markdown authoring.
- Keep reusable copy in typed locale content so both English and Chinese pages stay aligned.

The hooks documentation currently lives at:

- `src/routes/[lang=locale]/hooks/+page.svx`
- `src/lib/pages/hooks-guide.svelte`
- `src/lib/components/hook-reference.svelte`

## Styling

The website reuses shared product tokens from `packages/web/src/index.css` so the public site stays visually aligned with OpenSpecUI.

The website must not import React components from `packages/web`. Cross-package reuse is
limited to design tokens and small framework-neutral helpers.

## Deploy with Wrangler

One-time setup:

```bash
pnpm --filter @openspecui/website cf:project:create
```

Production deploy:

```bash
pnpm --filter @openspecui/website cf:deploy
```

Required auth:

- `wrangler login`, or
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`

Source of truth:

- deploy config: `packages/website/wrangler.jsonc`
- cache headers: `packages/website/static/_headers`

Custom domains remain a Cloudflare-side concern:

- `www.openspecui.com` serves this workspace output
- `openspecui.com` should redirect to `https://www.openspecui.com/*` via Cloudflare Redirect Rules

## Deployment

Build output is static and ready for direct upload to Cloudflare Pages.

SvelteKit static output is configured to write both pages and assets into `dist` so the
existing Cloudflare Pages deployment command remains stable.
