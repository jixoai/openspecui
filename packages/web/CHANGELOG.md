# @openspecui/web

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

## 1.0.0

### Major Changes

- Release all workspace packages to `1.0.0` for the new major release.

## 0.9.3

### Patch Changes

- optimize SSG export implementation

## 0.9.0

### Minor Changes

- 28db01c: Refactor SSG to use Vite official pattern
  - Simplified SSG implementation using Vite's official pre-rendering approach
  - Added `prerender.ts` script that uses HTML template from `vite build`
  - Removed complex runtime Vite build from old `cli.ts`
  - Removed ai-provider dependency from server and cli packages
  - Added Changesets for version management

### Patch Changes

- Updated dependencies [28db01c]
  - @openspecui/server@0.9.0
