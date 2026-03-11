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

## Deployment

Build output is static and can be deployed to Cloudflare Pages.

Recommended custom-domain setup:

- `www.openspecui.com` serves this workspace output
- `openspecui.com` redirects to `https://www.openspecui.com/*` via Cloudflare Redirect Rules

The included `public/_headers` file keeps HTML revalidating while allowing hashed assets to stay immutable.
