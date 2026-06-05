# openspecui

## 3.11.6

### Patch Changes

- 13801a5: Stop preinstalling the Local-Transformers runtime at startup. The runtime is now installed only when the translation settings panel asks for it, so the default install graph no longer pulls in `@huggingface/transformers` or `onnxruntime-node` unless the user opts into that engine.

## 3.11.5

### Patch Changes

- a055d57: Fix translation reliability around managed local engines and markdown rendering.
  - preserve translation config writes without overwriting sibling defaults
  - honor global-first translation settings with project overrides
  - keep managed local engine readiness and selected download groups in sync
  - translate markdown table cells in bilingual/direct rendering
  - refine inline markdown code styling

## 3.11.4

### Patch Changes

- f66c98c: Bundle local mono fonts instead of loading Google Fonts at runtime, and restore persisted project navigation layout on initial load.
- c265719: Add shared terminal keybindings for OS copy/paste behavior, preserve terminal selection when switching InputPanel tabs, and translate terminal touch gestures into mouse events for mobile terminal interaction.
- b02c131: Improve translation reliability by enforcing per-item timeout/error handling across service-side translators, mapping managed-local memory budgets into runtime and worker execution strategy, and surfacing segment-level retry flows with configurable smoke-test timeouts in the settings UI.
- e078127: Keep the CT2 model download card in a loading state while artifact profiles are still resolving, ignore malformed translation segments before rendering translated Markdown, and surface unsupported local-llama GGUF groups as explicit runtime compatibility failures before translation starts.

## 3.11.3

### Patch Changes

- bc8e0a8: Add the managed `local-llama` translation engine across the shared core/server/web stack, with host-owned optional runtime installation for `node-llama-cpp` and GGUF model selection.

  Also tighten the managed-local translation UX by returning recommended models for empty search, preserving server/local panel truth before auto-refreshing artifacts, and fixing local translation state handling regressions surfaced by CT2 and segment patch flows.

## 3.11.2

### Patch Changes

- afedcb6: Add the Local-CT2 translation engine and lifecycle-managed runtime installation flow, and fix the managed-local/document-translation regressions discovered during real walkthroughs.

## 3.11.1

### Patch Changes

- c17d198: Fix the published runtime dependency graph so `openspecui` and `@openspecui/server`
  do not require `tsx` as an installed runtime dependency.

  Fix the shared file detail layout so the editor pane and file tree share one bounded
  height, keep their own internal scrolling, and restore HTML files to preview mode so
  their preview actions remain available by default.

- ec56e7f: Fix the published runtime package layout so `@huggingface/transformers` stays
  external to the CLI/server bundle and can resolve its native runtime
  dependencies from installed package dependencies.

  Unify Local-Transformers model profile state behind the server `panelState`
  source of truth so Settings chips render selection, download status, and file
  progress from the same model lifecycle snapshot.

- da4b8ee: Align Local-Transformers runtime identity between Translation Test and page translation
  so both paths persist the same selected model/profile snapshot.

  Block incompatible directional local models before document translation starts, including
  page-level detected source-language groups, instead of letting ONNX runtime fail later.

## 3.11.0

### Minor Changes

- eba707d: Add backend-backed folder file preview, edit, and dedicated HTML preview entries for changes and archives.

### Patch Changes

- Updated dependencies [eba707d]
  - @openspecui/core@3.11.0
  - @openspecui/server@3.11.0

## 3.10.0

## 3.9.0

## 3.8.0

### Minor Changes

- 4f43845: Switch translation engines to bundled dynamic imports and batch translation.

  Notable translation engine changes:
  - rename engine ids to `browser | local | openai`
  - rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
  - replace single `translate(...)` with `batchTranslate(...)`
  - remove engine install/cancel install flows and old `nmt/ai` config keys
  - add resumable Local-Transformers model downloads with byte-level progress recovery

## 3.7.2

### Patch Changes

- f679575: Unify the shared change and archive document detail UI, keep detail heading anchors aligned,
  normalize pnpm CLI argv separators, and tighten translation UX with unavailable-state buttons
  plus dark-mode-safe target language popovers.

## 3.7.1

### Patch Changes

- 9745b8f: Add development conditional exports so source-mode worktree runtimes resolve workspace TypeScript sources while published/default runtimes keep using dist artifacts.
- c2a5e29: Fix document translation cache in the packaged CLI by resolving the native SQLite binding from runtime dependencies.
- 9745b8f: Reject incompatible worktree handoff targets with a shared runtime capability contract and harden notification config defaults.

## 3.7.0

### Patch Changes

- b491529: Render archived OPSX entities from schema-neutral file detail instead of the legacy spec-driven change projection.

## 3.6.1

### Patch Changes

- 026e05d: Fix TopLayer entry button sizing and PopArea view-transition shell layering.

## 3.6.0

## 3.5.2

### Patch Changes

- 5e63308: Fix mobile floating input panel chrome and settings switch semantics.

## 3.5.1

## 3.5.0

## 3.4.1

## 3.4.0

### Minor Changes

- f9b63a0: Add terminal shell profiles and data-driven spawn commands with shared create-terminal flows.

## 3.3.0

### Minor Changes

- 1815ef5: Add project-local `openspec/openspecui.hooks.ts` support with `onReadDocument` and `onRunWorkflow` hooks, processed/source document projections for live/search/export, and OPSX workflow invocation preparation through the server runtime.

## 3.2.3

### Patch Changes

- 21d2393: Fix view transition masks for tabs and page navigation, and restore stable scrolling layouts in Config panels.

## 3.2.2

### Patch Changes

- 238976d: Fix the shared tabs chrome so the default underline indicator stays within the tab strip, restore the terminal tab active state so it visually joins the terminal content, and correct tab view-transition direction handling. Document the preferred local workflow of running `pnpm dev` first and using `pnpm openspecui` only to verify bundled CLI-served behavior.

## 3.2.1

### Patch Changes

- bdeb61d: Polish terminal theme application and terminal tab chrome so the terminal header matches the active terminal theme, tab overflow stays horizontally scrollable, and inactive tab motion uses a smoother iOS-style transform without causing vertical scroll jitter.

## 3.2.0

### Minor Changes

- b57eb85: Add configurable terminal light and dark themes, follow app or system theme selection, and reduce default markdown reading density to ease visual fatigue.

## 3.1.2

## 3.1.1

## 3.1.0

### Minor Changes

- 0658249: Simplify the hosted app architecture so `app.openspecui.com` acts only as a PWA shell that opens backend-owned OpenSpecUI pages via the new `/api/health` embedding contract.

## 3.0.1

### Patch Changes

- 2e2b59f: Add project-level OPSX agent invocation mode preference and support compose or command dispatch for eligible OPSX actions.

## 3.0.0

### Major Changes

- cc396b9: Release OpenSpecUI 3.0 aligned with OpenSpec CLI 1.3 workflows.
  - Establish OpenSpecUI 3.x as the OpenSpec CLI 1.3.x target line while accepting 1.2.x as legacy-compatible.
  - Block OpenSpec CLI versions outside `>=1.2.0 <1.4.0`.
  - Normalize `openspec instructions apply --json` context files to artifact-to-path-array mappings, matching OpenSpec CLI 1.3 while preserving legacy single-path output.
  - Sync AI tool metadata with OpenSpec CLI 1.3.1, including Bob Shell, ForgeCode, Junie, Lingma, Copilot detection paths, and OpenCode `.opencode/commands/`.
  - Update documentation, specs, and reference checks for the OpenSpec CLI 1.3 line.

## 2.3.7

## 2.3.6

## 2.3.5

## 2.3.4

## 2.3.2

### Patch Changes

- 6f24a96: Fix the Dashboard Specifications summary metadata to show relative time before the spec id.

## 2.3.1

### Patch Changes

- 74fb6b9: Polish dashboard card metadata layout and restore Safari-compatible bottom panel resizing.

## 2.3.0

### Minor Changes

- 2023e8b: Add native view-transition navigation for top-level routes, shared-element detail handoffs, and routed tab carousels, while restructuring Git detail loading for faster patch delivery and smoother bottom-panel interactions.

## 2.2.4

### Patch Changes

- 8823a45: Align dev dist output behavior and publish CLI patch alongside the web package update.
  - Update `@openspecui/web` `dev:dist` to use `--emptyOutDir true` in watch mode.
  - Publish a matching `openspecui` patch release so CLI consumers pick up the latest bundled web assets.

## 2.2.0

### Minor Changes

- abe56de: Add a dedicated live Git panel with changed-file detail, worktree switching handoff, and shared Git snapshot UI primitives.

## 2.1.7

### Patch Changes

- 750405c: Improve the dashboard Git Snapshot panel with chronological entry ordering, commit/uncommitted timestamps, and optional auto-refresh presets.

## 2.1.6

### Patch Changes

- bbf350d: Fix the CLI startup banner to show the current package version and prevent stale cross-project navigation state from breaking change detail pages.

## 2.1.5

### Patch Changes

- 6f2f1b3: Fix dashboard recency ordering and make local CLI dev prefer the latest web build.

## 2.1.4

### Patch Changes

- 164ab2c: Clarify the hosted app launch contract for `openspecui --app[=baseUrl]`, including same-scope PWA reuse, browser fallback behavior, and matching UI/docs messaging across the CLI, settings page, and website.

## 2.1.3

### Patch Changes

- cb76966: Improve init/settings ergonomics, reduce noisy config persistence, and keep local web assets in sync for CLI and dev workflows.

## 2.1.2

### Patch Changes

- 24bff06: Fix hosted app refresh and update reliability across deployed builds.
  - register the hosted app service worker as a module so versioned iframe routes stay on the correct channel shell after refresh
  - distinguish deployed app manifests and prewarm new hosted caches before prompting for reload
  - improve hosted app shell refresh/loading behavior and align website entry copy for the app mode

## 2.1.1

### Patch Changes

- a9df0b1: Fix hosted app shell synchronization, harden versioned service-worker navigation, and refine dashboard git snapshot interactions.

## 2.1.0

### Minor Changes

- 143b916: Add hosted app distribution support across the CLI, server, and web runtime.
  - add `openspecui --app` with configurable hosted app base URLs and local hosted-app dev mode
  - expose hosted session/bootstrap helpers so versioned frontend entries can reconnect to the correct backend
  - include hosted-app settings and faster dashboard overview loading for the web UI
  - scope xterm input-panel persisted state by hosted session to avoid cross-tab leakage

## 2.0.2

### Patch Changes

- 8ed4585: Move dashboard git refresh stamp into Git metadata (`.git`/worktree `gitdir`) so OpenSpecUI no longer creates `openspec/.openspecui-dashboard-git-refresh.stamp` in user projects.

  When Git metadata is unavailable, dashboard refresh becomes a no-op instead of writing a fallback project file.

## 2.0.1

### Patch Changes

- 3cccae3: Fix OPSX propose/verify routing and dialog flow, and apply theme bootstrap on app initialization so settings theme works immediately without visiting settings first.

## 2.0.0

### Major Changes

- 5edd6b1: Release OpenSpecUI 2.0 aligned with OpenSpec 1.2 workflows.
  - Require OpenSpec CLI >= 1.2.0 in UI compatibility gate.
  - Add OpenSpec 1.2 profile/sync visibility and update actions in Settings.
  - Support OpenSpec 1.2 tool set updates (including Kiro and Pi) and new workflow skills.
  - Update init flow to support auto-detect mode and profile override semantics.
  - Refresh docs with versioned 1.x references and new 2.x root README guidance.

## 1.6.2

### Patch Changes

- fcfb701: Move terminal InputPanel entry from floating FAB to the terminal toolbar, harden InputPanel remount lifecycle recovery, and improve schema-driven workflow compatibility by removing proposal/tasks/design hard assumptions from dashboard metadata paths.

  Also evolve `opsx-collab-pr-loop` into dedicated loop artifacts under `loop/*` (intake, research-plan, implementation, checkpoints) with apply tracking on `loop/checkpoints.md`.

## 1.6.1

### Patch Changes

- 9966b7a: Refactor code editor config shape from `codeEditorTheme` to `codeEditor.theme`, and keep GitHub as the default editor theme.

## 1.6.0

### Minor Changes

- 1f2ad09: Improve dashboard and schema workflows with better static/live parity.
  - enhance dashboard cards and historical trend plumbing with git-backed static data mapping
  - improve schema file explorer interactions: robust context-menu anchoring, read-mode properties action, and mobile current-file menu
  - improve static export UX and path display mapping, including project/npm scoped display paths
  - add safer CLI export package resolution behavior and test coverage for local/dev package ranges

## 1.5.1

### Patch Changes

- 9b8d4bd: Fix SSG export package resolution by dynamically reading `@openspecui/web` from nearest `package.json` and treating local package protocols (`workspace:`, `file:`, `link:`) as local/dev mode.

## 1.5.0

### Minor Changes

- 67d7d16: Finalize the dashboard live workflow iteration with stronger operational context and static parity:
  - redesign Dashboard top section into objective `Workflow Progress` + `Git Snapshot`
  - add git snapshot model/refresh lifecycle and compact diff-focused rendering
  - harden objective trend windowing and availability semantics
  - archive and sync the `dashboard-live-workflow-status` OpenSpec change artifacts
  - export and consume OpenSpecUI config in static snapshots for consistent Settings/Dashboard behavior

### Patch Changes

- a29c5a8: Improve dashboard with a new objective overview data model and reactive subscription:
  - add backend `dashboard` get/subscribe API
  - include spec/requirement counts and active/completed/in-progress change metrics
  - show per-spec requirement breakdown and per-change task progress in UI
  - support static export mode via dashboard overview mapping

## 1.4.0

### Minor Changes

- Improve terminal interaction reliability, including InputPanel state persistence and ghostty virtual cursor behavior.

## 1.3.0

### Minor Changes

- 7c7735b: Add OPSX compose workflow for change actions: actions now open a pop-area prompt editor with terminal target selection, copy/save-to-history controls, and send-to-terminal flow.

  Improve terminal input safety/feedback by surfacing write readiness and sanitizing generated payloads before dispatch.

  Enable InputPanel FAB usage on desktop while keeping touch-device keyboard suppression behavior.

  Refine compose dialog/editor layout controls and add route/navigation support for `/opsx-compose`.

## 1.2.0

### Minor Changes

- Add a full pop-area based `/opsx:new` creation flow and unify terminal close lifecycle with callback metadata.
  - Replace dashboard/changes prompt-based creation with `/_p=/opsx-new` workflow UI.
  - Add advanced argument chips on `/opsx-new` while keeping official `new change` flags.
  - Extend PTY create/list protocol with `closeTip` and `closeCallbackUrl` metadata.
  - Execute close callbacks from a single terminal close path after process exit (internal route push or external URL open).
  - Add tests for new pop route mapping, command assembly, and terminal close callback behavior.

## 1.1.2

### Patch Changes

- Refactor OPSX config data flow to use a single `configBundle` subscription path.
  - unify config/schemas page schema metadata loading through one reactive bundle
  - remove deprecated split schema subscriptions from server and web hooks
  - optimize kernel-backed read lifecycle for faster first paint in config views

## 1.1.1

### Patch Changes

- Improve static export UX and reliability.
  - Move static snapshot status from the top banner into the bottom status bar.
  - Keep static-mode status semantics consistent (`Static` instead of `Offline`).
  - Fix static OPSX data adapters so `/changes` and change detail artifact content render from `data.json`.

## 1.1.0

### Minor Changes

- Release a minor version focused on platform reliability and search/productivity upgrades:
  - Add reactive search architecture with shared provider-based search engine and pop-area search UX.
  - Improve pop dialog lifecycle to make open/close behavior deterministic across routes and interactions.
  - Enhance CLI execution-path detection/config flow and related runtime diagnostics.
  - Improve terminal/session behavior and cross-platform compatibility, including Windows execution fixes.

## 1.0.4

### Patch Changes

- 74afc3f: Improve CLI configuration initialization and developer workflow stability.
  - Fix config persistence bootstrap by creating `openspec/` before writing `.openspecui.json`, so missing project config paths are no longer misreported as CLI-unavailable errors.
  - Improve dev workflow with a Bun/OpenTUI multi-tab `pnpm dev` experience and terminal rendering pipeline upgrades for PTY-style output, color-preserving display, and more reliable task lifecycle handling.
  - Fix Windows PTY startup defaults by resolving shell command from `ComSpec` (fallback to `cmd.exe`) instead of unix-only `/bin/sh`, and return structured `PTY_CREATE_FAILED` errors when PTY session creation fails.

## 1.0.3

### Patch Changes

- 74afc3f: Improve CLI configuration initialization and developer workflow stability.
  - Fix config persistence bootstrap by creating `openspec/` before writing `.openspecui.json`, so missing project config paths are no longer misreported as CLI-unavailable errors.
  - Improve dev workflow with a Bun/OpenTUI multi-tab `pnpm dev` experience and terminal rendering pipeline upgrades for PTY-style output, color-preserving display, and more reliable task lifecycle handling.

## 1.0.2

### Patch Changes

- Improve CLI configuration reliability and in-app recovery flow.
  - Add strict `execute-path` behavior: when user-configured, it is used as the only runner candidate (no implicit fallback), so invalid paths are surfaced immediately.
  - Improve command parsing for `execute-path` with robust quoted/Windows-path handling and `command + args` persistence.
  - Unify config write path on `config.update`, keep `config.subscribe` as the single reactive config stream, and fix reactive config push after writes.
  - Upgrade the `OpenSpec CLI Required` modal to support inline `execute-path` input/save/recheck and auto-close on successful availability checks.
  - Improve dev workflow so root `pnpm dev` also watches and rebuilds `@openspecui/core`, with server dev watching core dist changes.

## 1.0.1

### Patch Changes

- Fix CLI runtime PTY loading in `bunx`/`npx` installs by externalizing `@lydell/node-pty` from the bundle and resolving it from runtime dependencies.

## 1.0.0

### Major Changes

- Release all workspace packages to `1.0.0` for the new major release.

## 0.9.5

### Patch Changes

- fix @openspecui/web version

## 0.9.4

### Patch Changes

- Fix preview server command to use correct package manager exec syntax

## 0.9.3

### Patch Changes

- optimize SSG export implementation

## 0.9.2

### Patch Changes

- Fix export command for production use
  - Production HTML export now shows instructions instead of failing
  - JSON export works in both development and production

## 0.9.1

### Patch Changes

- Add --format option to export command
  - Support `--format=html` (default) for full static site export
  - Support `--format=json` for data-only export
  - Fix local dev mode SSG workflow

## 0.9.0

### Minor Changes

- 28db01c: Refactor SSG to use Vite official pattern
  - Simplified SSG implementation using Vite's official pre-rendering approach
  - Added `prerender.ts` script that uses HTML template from `vite build`
  - Removed complex runtime Vite build from old `cli.ts`
  - Removed ai-provider dependency from server and cli packages
  - Added Changesets for version management
