---
'@openspecui/core': major
'@openspecui/server': major
openspecui: major
'@openspecui/app': major
---

Hosted environment protocol, backend Access Gate, and App Store Manager wiring.

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
