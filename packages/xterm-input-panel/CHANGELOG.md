# xterm-input-panel

## 1.1.0

### Minor Changes

- 7c7735b: Add OPSX compose workflow for change actions: actions now open a pop-area prompt editor with terminal target selection, copy/save-to-history controls, and send-to-terminal flow.

  Improve terminal input safety/feedback by surfacing write readiness and sanitizing generated payloads before dispatch.

  Enable InputPanel FAB usage on desktop while keeping touch-device keyboard suppression behavior.

  Refine compose dialog/editor layout controls and add route/navigation support for `/opsx-compose`.

## 1.0.0

### Major Changes

- Release all workspace packages to `1.0.0` for the new major release.
