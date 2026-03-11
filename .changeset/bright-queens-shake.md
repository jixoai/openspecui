---
'openspecui': minor
'@openspecui/core': minor
'@openspecui/server': minor
'@openspecui/web': minor
'xterm-input-panel': patch
---

Add hosted app distribution support across the CLI, server, and web runtime.

- add `openspecui --app` with configurable hosted app base URLs and local hosted-app dev mode
- expose hosted session/bootstrap helpers so versioned frontend entries can reconnect to the correct backend
- include hosted-app settings and faster dashboard overview loading for the web UI
- scope xterm input-panel persisted state by hosted session to avoid cross-tab leakage
