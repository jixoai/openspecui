# Change: Add Hosted App Distribution and Hosted Workspace Shell

## Why

OpenSpecUI currently assumes the UI is served from the same local process that provides the backend service. The first hosted-app iteration proved that a single-domain deploy is feasible, but a one-shot root-shell redirect is the wrong interaction model for real use: one `app.openspecui.com` origin may need to connect to many local or remote OpenSpecUI services at the same time, and those sessions must not overwrite each other's browser state.

We need the hosted app to behave like a persistent workspace shell: each `openspecui --app` launch opens or restores a tab inside that shell, the shell keeps multiple backend connections visible at once, offline backends are clearly de-emphasized, and the actual OpenSpecUI frontend continues to come from versioned bundles resolved from published packages.

The next refinement is to move bundle-version selection fully into the hosted shell itself. The CLI should only need to provide the backend `api` endpoint. Once the shell can query backend metadata from `/api/health`, it can resolve the correct hosted bundle on demand, label tabs with the backend's project identity, and keep the chrome focused on the tabbed workspace instead of extra page-level framing.

This iteration explicitly prefers correctness and architectural clarity over compatibility. The hosted backend query contract will be standardized on `api`, and the previous `service` compatibility layer will be removed rather than carried forward.

## What Changes

- Keep the dedicated frontend `app` project and the `versions/<channel>/` output layout derived from published `openspecui` packages
- Turn the root app into a hosted workspace shell with multiple tabs instead of a one-shot redirect shell
- Treat each CLI launch as a request to open an initial hosted tab for one backend service inside that shell
- Keep the real OpenSpecUI UI in direct version entry pages such as `versions/v2.0/index.html`, rendered in isolated browsing contexts from the root shell
- Use `api` as the sole hosted backend query parameter for new behavior
- Resolve the hosted bundle version inside the shell from backend health metadata instead of requiring the CLI to preselect `?version=`
- Add session-scoped browser persistence so multiple hosted tabs on one origin do not overwrite each other's drafts, panel state, or other tab-local data
- Let the root shell track per-tab connectivity and gray out tabs whose backend is offline
- Use backend metadata to label each tab with project name as the primary title and API URL as the subtitle
- Simplify the hosted service worker so it focuses on static asset caching and update behavior rather than overriding root navigations into a version shell
- Reuse the existing `web` project's visual system, layout tokens, and UI components where practical so the hosted shell feels like the same product instead of a parallel UI stack
- Keep `appBaseUrl` and `openspecui --app[=<baseUrl>]`, including local workspace dev startup for bare `pnpm openspecui --app`

## Capabilities

### New Capabilities

- `hosted-app-distribution`: Build and package a single-domain hosted workspace shell, `versions/*` channel bundles, manifest metadata, and deployment documentation from published `openspecui` web distributions

### Modified Capabilities

- `cli-commands`: Add hosted workspace launch mode with configurable base URL, version resolution, and initial tab creation for `openspecui --app`
- `web-rendering`: Add hosted API override, direct version entry support, and session-scoped browser persistence for hosted tabs
- `opsx-ui-views`: Add hosted app base URL configuration to runtime settings

## Impact

- Affected code: root hosted app shell, shell tab/session state, hosted launch URL generation, hosted runtime query handling, browser storage keys, service-worker scope, runtime config/settings, app build and docs
- Affected systems: npm package resolution, static-host deployment layout, browser storage namespace, hosted shell lifecycle, multi-backend connectivity handling
- Breaking behavior: hosted launches and hosted runtime contract standardize on `api`, not `service`
- Dependencies: semver-aware version resolution, published `openspecui` package tarballs, hosted `version.json` metadata, per-tab service reachability checks
