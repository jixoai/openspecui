> Orthogonal intents (maintained 2026-09-06 Asia/Shanghai): website deploy
> automation (CI → Cloudflare Pages).
>
> Original request (2026-09-06 Asia/Shanghai): openspecui 已经是纯粹静态，
> 部署挪回 CI（方案 A：GitHub Actions + wrangler + repo secrets）。

## Why

The website deploys only when someone runs `cf:deploy` manually — three
merged PRs (registry adoption, mobile fixes, consumer upgrades) are still
not live because nobody deployed. CI deployment makes main = production.

## What Changes

- Add `.github/workflows/deploy-website.yml`: website-affecting pushes to
  main (`packages/website/**` + the workflow) and `workflow_dispatch` →
  filtered pnpm install → build → artifact shape checks →
  `wrangler pages deploy dist --project-name openspecui-website --branch
  main` authenticated by the Owner-configured repo secrets
  (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- The existing project, custom domain (www.openspecui.com), `_headers`,
  and `wrangler.jsonc` stay untouched; the local `cf:deploy` remains as a
  manual fallback. Output contract unchanged (dist).

## Capabilities

### Modified Capabilities

- `website-surface`: deployment is CI-driven; dist/_headers contract
  unchanged.

## Non-goals

- No site code changes, no registry surface changes, no DNS changes.
