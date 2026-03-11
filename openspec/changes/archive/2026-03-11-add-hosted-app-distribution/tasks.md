## 1. Keep valid foundation

- [x] 1.1 Keep the dedicated frontend `app` workspace, `versions/<channel>/` layout, and build-time channel extraction from published `openspecui` packages
- [x] 1.2 Keep root `version.json` generation, `appBaseUrl` settings, and local workspace hosted-app dev startup support

## 2. Hosted workspace shell

- [x] 2.1 Replace the one-shot root bootstrap with a tabbed hosted workspace shell that can open an initial tab from the backend `api` launch parameter
- [x] 2.2 Persist hosted shell tabs and restore them on reload without losing the active tab
- [x] 2.3 Add per-tab reachability state and gray out tabs whose backend is offline
- [x] 2.4 Reuse `packages/web` styling tokens and UI components for the hosted shell instead of creating a separate visual system

## 3. Version entry and session isolation

- [x] 3.1 Load versioned OpenSpecUI entry pages directly from `versions/<channel>/index.html` inside isolated browsing contexts instead of relying on root navigation override
- [x] 3.2 Canonicalize hosted backend override on `api` and remove the legacy `service` compatibility path
- [x] 3.3 Generate hosted session IDs and namespace tab-local browser persistence by session so multiple hosted tabs on one origin do not overwrite each other's drafts, panel state, or other tab-local data
- [x] 3.4 Remove or simplify the first-control reload and service-worker navigation override logic that is no longer part of the final architecture

## 4. CLI and launch integration

- [x] 4.1 Update `openspecui --app` to open the root hosted shell with an initial backend tab request instead of a whole-page version handoff
- [x] 4.2 Keep base-URL resolution and workspace local-dev behavior compatible with the new shell launch contract

## 5. Validation and docs

- [x] 5.1 Add tests for hosted shell tab creation, active-tab restoration, offline state rendering, and shell/component reuse boundaries
- [x] 5.2 Add tests for `api`-based launch handling and session-scoped browser persistence
- [x] 5.3 Update hosted app documentation to explain the workspace shell, multi-backend tabs, and version entry embedding model

## 6. Dev loop polish

- [x] 6.1 Start `@openspecui/app` inside the root `pnpm dev` TUI and seed it with the local backend so the hosted shell is visible during normal development
- [x] 6.2 Make the hosted shell chrome more explicit in the single-tab case so developers can tell they are in the tabbed app shell

## 7. Metadata-driven shell simplification

- [x] 7.1 Move hosted bundle resolution from the CLI to the shell by querying backend health metadata and the hosted `version.json` manifest
- [x] 7.2 Simplify the shell chrome so the tab strip becomes the primary surface, with refresh and add-backend actions inline at the tab end
- [x] 7.3 Label each hosted tab with backend project name as the title and API URL as the subtitle, while keeping long values truncated
