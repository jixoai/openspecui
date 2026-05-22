# @openspecui/core

## 4.0.0

### Major Changes

- 70e8a79: Switch translation engines to bundled dynamic imports and batch translation.

  Breaking changes:
  - rename engine ids to `browser | local | openai`
  - rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
  - replace single `translate(...)` with `batchTranslate(...)`
  - remove engine install/cancel install flows and old `nmt/ai` config keys

## 3.7.2

## 3.7.1

### Patch Changes

- 9745b8f: Fix document translation projection for OpenSpec headings, code-like spans, and nested list items.
- 9745b8f: Add development conditional exports so source-mode worktree runtimes resolve workspace TypeScript sources while published/default runtimes keep using dist artifacts.
- 106534f: Upgrade document translation to a HAST-stage projection pipeline with shared SQLite cache controls.
- 9745b8f: Reject incompatible worktree handoff targets with a shared runtime capability contract and harden notification config defaults.

## 3.7.0

### Minor Changes

- b491529: Add the document translation platform, including translation settings, Markdown reading pipeline ordering, Chrome Translator integration, ToC translation actions, and direct/bilingual document projection modes.

### Patch Changes

- b491529: Render archived OPSX entities from schema-neutral file detail instead of the legacy spec-driven change projection.

## 3.6.1

## 3.6.0

### Minor Changes

- 30d7af0: Render spec detail pages from processed Markdown while using parsed OpenSpec structure as semantic enhancement data.

## 3.5.2

## 3.5.1

## 3.5.0

### Minor Changes

- ecfccd2: Add the in-memory web notifications platform with terminal bell/OSC producers, PopArea notification panel, notification settings, sound previews, and a rolling browser Notification bridge.

## 3.4.1

## 3.4.0

### Minor Changes

- f9b63a0: Add terminal shell profiles and data-driven spawn commands with shared create-terminal flows.

## 3.3.0

### Minor Changes

- 1815ef5: Add project-local `openspec/openspecui.hooks.ts` support with `onReadDocument` and `onRunWorkflow` hooks, processed/source document projections for live/search/export, and OPSX workflow invocation preparation through the server runtime.

## 3.2.3

## 3.2.2

## 3.2.1

### Patch Changes

- bdeb61d: Polish terminal theme application and terminal tab chrome so the terminal header matches the active terminal theme, tab overflow stays horizontally scrollable, and inactive tab motion uses a smoother iOS-style transform without causing vertical scroll jitter.

## 3.2.0

### Minor Changes

- b57eb85: Add configurable terminal light and dark themes, follow app or system theme selection, and reduce default markdown reading density to ease visual fatigue.

## 3.1.2

### Patch Changes

- 99e74c1: Complete reactive artifact output tracking for nested and globbed outputs.

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

### Patch Changes

- 7be50a7: Promote deleted-worktree recovery into a platform-level handoff flow. The watcher runtime now reports project-root eviction state, the server resolves fallback worktrees from cached Git common-dir metadata, and the web shell auto-switches to an existing default-branch worktree while preserving the current route.

## 2.3.5

## 2.3.4

## 2.3.3

### Patch Changes

- 4b11a8a: Fix CLI runner probing and execution when `spawn()` throws synchronously for invalid commands.
  This prevents delayed `ReferenceError` failures and keeps CLI availability checks stable for the web and server integrations.

## 2.3.0

### Minor Changes

- 2023e8b: Add native view-transition navigation for top-level routes, shared-element detail handoffs, and routed tab carousels, while restructuring Git detail loading for faster patch delivery and smoother bottom-panel interactions.

## 2.2.0

### Minor Changes

- abe56de: Add a dedicated live Git panel with changed-file detail, worktree switching handoff, and shared Git snapshot UI primitives.

## 2.1.7

### Patch Changes

- 750405c: Improve the dashboard Git Snapshot panel with chronological entry ordering, commit/uncommitted timestamps, and optional auto-refresh presets.

## 2.1.5

### Patch Changes

- 6f2f1b3: Fix dashboard recency ordering and make local CLI dev prefer the latest web build.

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

### Patch Changes

- 1f2ad09: Improve dashboard and schema workflows with better static/live parity.
  - enhance dashboard cards and historical trend plumbing with git-backed static data mapping
  - improve schema file explorer interactions: robust context-menu anchoring, read-mode properties action, and mobile current-file menu
  - improve static export UX and path display mapping, including project/npm scoped display paths
  - add safer CLI export package resolution behavior and test coverage for local/dev package ranges

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

## 1.0.0

### Major Changes

- Release all workspace packages to `1.0.0` for the new major release.

## 0.9.0

### Minor Changes

- 28db01c: Refactor SSG to use Vite official pattern
  - Simplified SSG implementation using Vite's official pre-rendering approach
  - Added `prerender.ts` script that uses HTML template from `vite build`
  - Removed complex runtime Vite build from old `cli.ts`
  - Removed ai-provider dependency from server and cli packages
  - Added Changesets for version management
