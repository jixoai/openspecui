## Context

`openspecui` currently starts a local HTTP/WebSocket server and, by default, opens a same-origin web app served from that process. The hosted delivery model adds a second path:

- the repository ships a dedicated frontend `app` project
- versioned OpenSpecUI bundles are published under `versions/<channel>/`
- the browser app connects back to a local or remote OpenSpecUI service through the `api` query parameter
- the hosted shell resolves the correct frontend bundle after querying backend metadata from `/api/health`

The first hosted-shell implementation already proved that a persistent root shell is the right direction, but two rough edges remained:

- the shell chrome still looked like a separate page wrapped around the tabs instead of the tabs being the product surface
- the CLI still preselected `?version=` even though the shell already had the backend `api` and could resolve compatibility itself

## Goals / Non-Goals

**Goals:**

- Keep a dedicated hosted `app` workspace and `versions/<channel>/` bundles resolved from published packages.
- Keep the root app as a persistent hosted workspace shell with multiple tabs.
- Make the tab strip the primary shell chrome.
- Let the CLI launch the shell with `?api=` only.
- Resolve the compatible hosted bundle inside the shell from backend health metadata plus the root `version.json` manifest.
- Label tabs with backend project name and API URL.
- Keep session-scoped browser persistence for hosted tabs.
- Surface per-tab offline state at the shell level.
- Reuse the existing `web` project's visual system and component patterns as the default shell UI language.

**Non-Goals:**

- Replace the existing local web serving mode.
- Build a server-side deployment control plane or synchronized multi-user tab service.
- Fork the hosted UI into a separate application unrelated to published OpenSpecUI web bundles.
- Guarantee cross-window tab synchronization in the first iteration.
- Preserve the legacy `service` hosted query contract.
- Keep the CLI-side `?version=` resolution flow.

## Decisions

### 1. The root `app` remains a persistent hosted workspace shell

The root `index.html` stays responsible for:

- the hosted tab strip
- session persistence
- active-tab selection
- connection status badges
- initial-tab creation from the launch URL
- manual API entry from the tab strip actions

A CLI launch such as:

- `https://app.openspecui.com/?api=http://localhost:13000`

means “open one hosted tab in the shell”, not “navigate the whole origin into `versions/<channel>/index.html`”.

### 2. Hosted bundle resolution moves from the CLI into the shell

The CLI now only chooses the hosted shell base URL and backend API URL. The shell does the rest:

1. fetch `/api/health` from the backend
2. read `openspecuiVersion` and `projectName`
3. fetch the hosted root `version.json`
4. resolve the compatible channel such as `v2.0`
5. load `/versions/<channel>/index.html?api=...&session=...` in the tab iframe

Why this is better:

- the launch contract becomes simpler and more future-proof
- a manually added API tab follows the exact same resolution path as a CLI-opened tab
- compatibility logic lives next to the actual hosted bundles instead of being duplicated in the launcher

### 3. The real UI stays in direct version entry pages under `versions/`

Each channel continues to emit a full entry page under:

- `/versions/latest/index.html`
- `/versions/v2/index.html`
- `/versions/v2.0/index.html`

The hosted workspace shell renders the active tab inside an isolated browsing context, expected to be an iframe, pointing at that channel entry page.

Why this is better:

- channel bundles stay self-contained and statically deployable
- the root shell and the versioned product UI are clearly separated
- different versions can coexist inside the same hosted shell

### 4. `api` is the only hosted backend query parameter

The hosted runtime standardizes on:

- `api=<service-origin>` for the backend endpoint

The previous `service` parameter remains removed, and the previous `version` launcher contract is no longer required for the normal path.

### 5. The shell assigns session IDs and the embedded UI namespaces browser persistence by session

Each hosted tab gets a generated session identifier. The shell passes it into the embedded version entry page, and the embedded UI uses that session identifier to namespace browser-persisted state that should remain tab-local.

Examples of tab-local state include:

- input drafts
- active input panel mode
- terminal-related local state
- transient route-local UI state that should not leak between hosted tabs

App-wide settings that are intentionally shared, such as explicit global theme choice, remain shared by design.

### 6. The shell owns tab reachability and backend identity

The hosted workspace shell tracks whether each tab's backend is reachable and reads backend identity from `/api/health`.

That metadata provides:

- `projectName` for the tab title
- `openspecuiVersion` for hosted bundle resolution
- baseline server status needed before the iframe is loaded

When a backend is unreachable:

- the tab remains visible
- the tab is visually muted or grayed out
- the shell can expose reconnect actions
- if the tab already resolved a bundle, the iframe stays mounted and simply becomes muted

### 7. The shell chrome is reduced to the tab surface itself

The root shell should not look like a nested card or dashboard page. The visual hierarchy is:

- tabs first
- content second
- add / refresh actions inline at the tab strip end

The shell therefore removes extra page headers, padded wrappers, and decorative cards that do not improve the multi-tab workflow.

### 8. The hosted service worker remains cache-focused

The service worker may still cache root-shell assets, `version.json`, and versioned static assets, but it should not become the place that decides which bundle a backend needs.

The hosted shell itself owns compatibility resolution and iframe URL construction.

## Risks / Trade-offs

- **Health payload becomes part of the hosted compatibility contract** → keep it minimal and objective: project name plus OpenSpecUI version.
- **The shell still depends on both backend health and hosted manifest availability** → when either side is unavailable, render an explicit inline error instead of silently guessing a bundle.
- **Embedding version bundles in iframes still shares origin-level storage by default** → session-aware key namespacing remains mandatory.
- **The root shell becomes a real product surface** → keep it intentionally small and avoid duplicating deep product functionality that belongs inside the embedded OpenSpecUI app.

## Migration Plan

1. Keep the valid foundation: app workspace, channel extraction, `versions/*`, and `version.json`.
2. Stop requiring the CLI to fetch `version.json` or append `?version=`.
3. Extend `/api/health` with the hosted metadata the shell needs.
4. Let the shell resolve bundle channels after querying backend health.
5. Reduce shell chrome so the tab strip becomes the main UI surface.
6. Keep session-scoped browser state and offline tab handling unchanged.
7. Add tests for metadata-driven bundle resolution, API-only launch URLs, and the simplified shell chrome.
