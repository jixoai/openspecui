---
"openspecui": minor
"@openspecui/web": minor
"xterm-input-panel": minor
---

Add OPSX compose workflow for change actions: actions now open a pop-area prompt editor with terminal target selection, copy/save-to-history controls, and send-to-terminal flow.

Improve terminal input safety/feedback by surfacing write readiness and sanitizing generated payloads before dispatch.

Enable InputPanel FAB usage on desktop while keeping touch-device keyboard suppression behavior.

Refine compose dialog/editor layout controls and add route/navigation support for `/opsx-compose`.
