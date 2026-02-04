# Change: Add Static Export Command for CI Workflows

## Why

OpenSpecUI currently runs as a local development server, requiring a Node.js runtime to view specifications. This creates friction for teams wanting to:

- Generate static documentation for deployment to GitHub Pages, Netlify, or S3
- Integrate specification viewing into CI/CD pipelines
- Share read-only snapshots of specs without running a server

GitHub issue #7 requests this capability to enable CI workflow integration.

## What Changes

- Add `openspecui export -o <output-dir>` CLI command that generates a static website
- Pre-render all routes (dashboard, specs, changes, archive) at build time
- Generate standalone HTML files that work without a WebSocket server
- Support dynamic routes by enumerating specs and changes at export time
- Include all assets (CSS, JS, fonts) as self-contained bundles
- Provide fallback for interactive features that require server connectivity
- Document export workflow for CI integration (GitHub Actions example)
- Support custom base paths with automatic normalization (e.g., `/docs`, `/docs/`, `docs` all normalize to `/docs/`)
- Configure router with base path for proper client-side navigation
- Reference all assets (including logos) relative to the configured base path
- Suppress file watcher warnings during static export mode

### Static Mode Implementation Details

**Static Mode Detection:**

- Detect static mode by checking for presence of `data.json` file
- Set mode flag during app initialization before React renders
- All modules check `isStaticMode()` synchronously

**Data Loading Architecture:**

- Create `static-data-provider.ts` module for loading from `data.json`
- Implement all data fetching functions matching tRPC subscription signatures
- Cache snapshot in memory for performance
- Return simplified data structures (no full parsing of markdown in browser)

**WebSocket Prevention:**

- Lazy WebSocket client creation (only when needed)
- Skip WebSocket creation entirely in static mode
- Prevent all subscription attempts when in static mode
- Use static data provider instead of tRPC subscriptions

**Subscription Hooks:**

- Update all 16+ subscription hooks to accept optional `staticLoader` parameter
- Check static mode flag and use appropriate data source
- Maintain backward compatibility with dynamic mode

**UI Adaptations:**

- Disable health check polling (`/api/health`) in static mode
- Hide non-functional settings (CLI, API, Project, File Watcher, Initialize)
- Show only Appearance settings (theme) in static mode
- Display "Static Snapshot" banner with generation timestamp
- Set document title to "OpenSpec UI (Static)"

## Impact

**Affected specs:**

- `cli-commands` - New export command capability
- `web-rendering` - Static rendering mode alongside existing SPA mode
- `build-pipeline` - New export build target

**Affected code:**

- `packages/cli/src/cli.ts` - Add export command
- `packages/cli/src/export.ts` - Export logic (new file)
- `packages/web/src/main.tsx` - Static mode detection on startup
- `packages/web/src/lib/static-mode.ts` - Mode detection utilities
- `packages/web/src/lib/static-data-provider.ts` - Static data loading (new file)
- `packages/web/src/lib/trpc.ts` - Conditional WebSocket client creation
- `packages/web/src/lib/use-subscription.ts` - Hybrid subscription hooks
- `packages/web/src/lib/use-server-status.ts` - Skip health checks in static mode
- `packages/web/src/routes/settings.tsx` - Hide non-relevant settings in static mode
- `packages/web/src/components/StaticModeBanner.tsx` - Static mode indicator (new file)
- `packages/web/src/components/layout/root-layout.tsx` - Show static banner
- Build scripts and documentation

**Breaking changes:** None - this is a purely additive feature
