# xterm-input-panel

## 1.2.1

### Patch Changes

- fcfb701: Move terminal InputPanel entry from floating FAB to the terminal toolbar, harden InputPanel remount lifecycle recovery, and improve schema-driven workflow compatibility by removing proposal/tasks/design hard assumptions from dashboard metadata paths.

  Also evolve `opsx-collab-pr-loop` into dedicated loop artifacts under `loop/*` (intake, research-plan, implementation, checkpoints) with apply tracking on `loop/checkpoints.md`.

## 1.2.0

### Minor Changes

- Improve terminal interaction reliability, including InputPanel state persistence and ghostty virtual cursor behavior.

## 1.1.0

### Minor Changes

- 7c7735b: Add OPSX compose workflow for change actions: actions now open a pop-area prompt editor with terminal target selection, copy/save-to-history controls, and send-to-terminal flow.

  Improve terminal input safety/feedback by surfacing write readiness and sanitizing generated payloads before dispatch.

  Enable InputPanel FAB usage on desktop while keeping touch-device keyboard suppression behavior.

  Refine compose dialog/editor layout controls and add route/navigation support for `/opsx-compose`.

## 1.0.0

### Major Changes

- Release all workspace packages to `1.0.0` for the new major release.
