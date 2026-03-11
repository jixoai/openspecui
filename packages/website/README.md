# @openspecui/website

Public landing site for `www.openspecui.com`.

## Scope

This workspace is intentionally small:

- introduce OpenSpecUI
- show the primary launch commands
- link to the hosted app, OpenSpec official site, and GitHub
- support English and Simplified Chinese switching

It is not a docs portal or CMS.

## Local Development

```bash
pnpm --filter @openspecui/website dev
pnpm --filter @openspecui/website test
pnpm --filter @openspecui/website build
pnpm --filter @openspecui/website cf:dev
```

## Internationalization

The site uses:

- `i18next`
- `react-i18next`
- `i18next-browser-languagedetector`

Language detection order is:

1. `?lang=` query parameter
2. localStorage
3. browser language
4. document language

Supported languages:

- `en`
- `zh`

## Styling

The website reuses shared product tokens from `packages/web/src/index.css` so the public site stays visually aligned with OpenSpecUI.

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
- cache headers: `packages/website/public/_headers`

Custom domains remain a Cloudflare-side concern:

- `www.openspecui.com` serves this workspace output
- `openspecui.com` should redirect to `https://www.openspecui.com/*` via Cloudflare Redirect Rules

## Deployment

Build output is static and ready for direct upload to Cloudflare Pages.
