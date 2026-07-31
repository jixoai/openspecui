---
'@openspecui/core': minor
'@openspecui/server': minor
'@openspecui/app': major
openspecui: minor
---

Reshape the App information architecture around Workspaces and Stores.

- Workspaces becomes a path-first project launcher: fixed Home (Favorites +
  path-input + Recent + Task Manager), daemon-managed directory launch with
  canonical-path dedupe / exact Stop / restart restoration, running-backend
  secondary navigation, and path-first labels (GitHub org/repo or folder
  basename + branch subtitle).
- Stores becomes the only other primary domain: Environment-scoped Store
  index with composite-identity Detail, demand-driven readonly Store-content
  (Specs/active Changes) Projection Work, and explicit Environment selection
  replacing backend-URL Store targeting.
- BREAKING App IA: retires the Connections, Environment, Store Manager
  (Inspector/Inventory/Context Matrix) routes and the backend selector without
  compatibility redirects. Candidate/open Workspace state is separated; an
  unchanged daemon snapshot no longer reopens a user-closed Workspace.
- BREAKING App distribution: retires PWA install prompts, manifest and icon
  assets, service-worker cache/update ownership, PWA launch roles, and PWA
  overlay chrome. Browser Web and OpenTray remain the supported App hosts; the
  sidebar brand now uses the canonical App logo.
