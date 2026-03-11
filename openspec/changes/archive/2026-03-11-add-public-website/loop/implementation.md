## Implementation State

- `packages/website` workspace has been created with Vite + React + TypeScript.
- The website now ships a bilingual single-page landing experience with English and Simplified Chinese switching.
- Translation runtime is backed by `i18next`, `react-i18next`, and `i18next-browser-languagedetector`.
- The website imports shared OpenSpecUI product tokens from `packages/web/src/index.css` instead of defining a separate visual system.
- Repo dev ergonomics were extended with `dev:website` and an optional dev-tui task.
- Deployment notes and cache headers were added for both the public website and the hosted app workspace.

## Decisions Taken

- Keep the public site as a static single-page app rather than introducing routing, SSR, or a CMS.
- Use inline translation resources because the content surface is intentionally small and product-focused.
- Reuse the existing OpenSpecUI style tokens and segmented-button patterns to keep the public site visually consistent.
- Keep Cloudflare deployment support file-based with `_headers` and document domain-level redirects separately.

## Divergence Notes

- The loop originally focused on the website only, but the same PR also needed hosted-app deployment/documentation cleanup so release artifacts stayed coherent.

## Loopback Triggers

- If the site needs product documentation, blog-style content, or dynamic content management, stop and create a new approved loop instead of expanding this one.
- If the shared product styles from `packages/web` prove insufficient or unstable for static website use, stop and re-evaluate the package boundary before adding bespoke styling infrastructure.
