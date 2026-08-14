# @openspecui/app

## 7.0.2

## 7.0.1

## 7.0.0

## 6.2.1

## 6.2.0

## 6.1.0

### Minor Changes

- 4755386: Reshape the App information architecture around Workspaces and Stores.
  - Workspaces becomes a path-first project launcher: fixed Home (Favorites +
    path-input + Recent + Task Manager), daemon-managed directory launch with
    canonical-path dedupe / exact Stop / restart restoration, direct favorite
    secondary navigation, Health + WebSocket verified Running evidence, and
    path-first labels (GitHub org/repo or folder basename + branch subtitle).
    Favorites and Recent are persisted by the user-level daemon and converge
    across App windows through invalidation Push followed by snapshot Pull.
  - Stores becomes the only other primary domain: Environment-scoped Store
    index with composite-identity Detail, demand-driven readonly Store-content
    (Specs/active Changes) Projection Work, and explicit Environment selection
    replacing backend-URL Store targeting.
  - App IA reset: retires the Connections, Environment, Store Manager
    (Inspector/Inventory/Context Matrix) routes and the backend selector without
    compatibility redirects. Candidate/open Workspace state is separated; an
    unchanged daemon snapshot no longer reopens a user-closed Workspace.
  - App distribution reset: retires PWA install prompts, manifest and icon
    assets, service-worker cache/update ownership, PWA launch roles, and PWA
    overlay chrome. Browser Web and OpenTray remain the supported App hosts; the
    sidebar brand now uses the canonical App logo.

## 6.0.1

## 6.0.0

### Major Changes

- 39ac6ce: Hosted environment protocol, backend Access Gate, and App Store Manager wiring.

  The backend now issues an opaque stable `envUri` (host identity + effective OpenSpec data home,
  SHA-256 hashed, non-dereferenceable) and a three-fact capability vocabulary
  (`stores.inspect`, `stores.mutate`, `contexts.inspect`) — compatibility facts, never permissions.
  Backend health carries `apiBaseUrl`, `cliVersion`, `envUri`, root summary, `hostedCapabilities`, and
  `accessGateEnabled`. Store mutations are backend-owned
  (`accepted -> running -> succeeded | failed | indeterminate`) with request-id deduplication; V1 has no
  Cancel and no retry.

  An optional whole-backend Access Gate is enabled by `--auth` (generates a 256-bit Bearer credential) or
  `--password` (normalizes an operator secret). When enabled, the gate protects every HTTP, tRPC, PTY
  WebSocket, file, terminal, and notification transport. HTTP uses the Authorization header; PTY WebSocket
  authenticates in its first message; rejected requests get a neutral 401 that never echoes the credential.
  Non-loopback gated deployments require HTTPS/WSS. Absent by default, the unguarded dev workflow is
  unchanged.

  The App Environment Center groups online backends by `envUri` and gates Store views through the
  `stores.inspect` capability; the Store Inspector fetches Inventory/Doctor through the hosted REST
  boundary. Store Manager remains explicitly experimental.

## 6.0.0-beta.1

## 6.0.0-beta.0

### Major Changes

- 39ac6ce: Hosted environment protocol, backend Access Gate, and App Store Manager wiring.

  The backend now issues an opaque stable `envUri` (host identity + effective OpenSpec data home,
  SHA-256 hashed, non-dereferenceable) and a three-fact capability vocabulary
  (`stores.inspect`, `stores.mutate`, `contexts.inspect`) — compatibility facts, never permissions.
  Backend health carries `apiBaseUrl`, `cliVersion`, `envUri`, root summary, `hostedCapabilities`, and
  `accessGateEnabled`. Store mutations are backend-owned
  (`accepted -> running -> succeeded | failed | indeterminate`) with request-id deduplication; V1 has no
  Cancel and no retry.

  An optional whole-backend Access Gate is enabled by `--auth` (generates a 256-bit Bearer credential) or
  `--password` (normalizes an operator secret). When enabled, the gate protects every HTTP, tRPC, PTY
  WebSocket, file, terminal, and notification transport. HTTP uses the Authorization header; PTY WebSocket
  authenticates in its first message; rejected requests get a neutral 401 that never echoes the credential.
  Non-loopback gated deployments require HTTPS/WSS. Absent by default, the unguarded dev workflow is
  unchanged.

  The App Environment Center groups online backends by `envUri` and gates Store views through the
  `stores.inspect` capability; the Store Inspector fetches Inventory/Doctor through the hosted REST
  boundary. Store Manager remains explicitly experimental.

## 5.0.0

## 4.1.0

## 4.0.2

## 4.0.1

## 4.0.0

## 3.12.0

## 3.11.6

## 3.11.5

## 3.11.4

## 3.11.3

## 3.11.2

## 3.11.1

## 3.11.0

## 3.10.0

## 3.9.0

## 3.8.0

## 3.7.2

## 3.7.1

## 3.7.0

## 3.6.1

## 3.6.0

## 3.5.2

## 3.5.1

## 3.5.0

## 3.4.1

## 3.4.0

## 3.3.0

## 3.2.3

## 3.2.2

## 3.2.1

## 3.2.0

## 3.1.2

## 3.1.1

### Patch Changes

- 86e9a8c: Harden hosted app shell upgrade flow so service-worker cache revisions follow shell content, idle shells auto-apply waiting updates, and legacy `?version=` launch semantics stay retired.

## 3.1.0

### Minor Changes

- 0658249: Simplify the hosted app architecture so `app.openspecui.com` acts only as a PWA shell that opens backend-owned OpenSpecUI pages via the new `/api/health` embedding contract.

## 3.0.1

## 3.0.0

## 2.3.7

## 2.3.6

## 2.3.5

## 2.3.4
