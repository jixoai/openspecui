# @openspecui/app

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
