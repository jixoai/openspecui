---
'openspecui': patch
'@openspecui/server': patch
'@openspecui/core': patch
'@openspecui/web': patch
'xterm-input-panel': patch
---

Move terminal InputPanel entry from floating FAB to the terminal toolbar, harden InputPanel remount lifecycle recovery, and improve schema-driven workflow compatibility by removing proposal/tasks/design hard assumptions from dashboard metadata paths.

Also evolve `opsx-collab-pr-loop` into dedicated loop artifacts under `loop/*` (intake, research-plan, implementation, checkpoints) with apply tracking on `loop/checkpoints.md`.
