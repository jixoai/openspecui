# @openspecui/app

## 12.0.0

### Major Changes

- d272b1f: OpenSpecUI 12: adapt the OpenSpec CLI 1.12 line.
  - Compatibility window: OpenSpec CLI `>=1.12.0 <1.13.0` (single-series; stable 1.12.x current and
    recommended). CLI `1.10.x`/`1.11.x` (the OpenSpecUI 11 window) and older lines are blocked by default;
    prereleases and `>=1.13.0` remain blocked.
  - `validate --report findings` is a new capability-gated typed contract and validation evidence surface:
    findings-only items with preserved full-run totals and exit codes; `invalid_validation_report_request`
    request errors flow through the shared diagnostic envelope.
  - Merge-conflict advisory findings (`Archive would refuse this delta` / `Could not check archive merge
conflicts`) render as a first-class informational (INFO) class without changing validity evidence.
  - Agent delivery adds SourceCraft Code Assistant (`.codeassistant`, natural-language skill references,
    commands at `.codeassistant/commands/opsx-<id>.md`, no IDE restart, no migration) for 1.12 sessions;
    generator staleness rotates to the 1.12.0 baseline.
  - Pinned executable fixtures: `openspec-cli-112` proves the new contracts; the retained
    `openspec-cli-111` proves capability-boundary rejections.

## 11.1.0

### Minor Changes

- 97aca09: Expose spec-scope validation on the Specifications surfaces: a shared
  read-only evidence component at the all-specs header and the owned-spec
  detail header, with typed transport and report schemas, contract-drift
  and static degradation, making spec-level findings such as the 1.11
  Purpose-placeholder warning reachable in the UI.

## 11.0.0

### Major Changes

- 56e20c8: OpenSpecUI 11 adapts OpenSpec CLI 1.10 and 1.11 in one release line: stable `>=1.10.0 <1.12.0` is admitted with the 1.11 line current and recommended and the 1.10 line supported non-current, while CLI `<1.10.0` (including 1.9.x and older), every prerelease, `>=1.12.0`, and unparseable versions stay blocked by default behind the session-scoped version-bypass dialog. 1.11 sessions load the full change status list through one `openspec status --all --json` spawn behind a capability gate — 1.10 keeps the serial per-change path — with partial-failure batches preserved as per-change diagnostics instead of failing the whole status projection. Change Detail MODIFIED deltas render the CLI's own `openspec show --diff` unified diff body and exact upstream warnings as separate evidence without recomputing or backfilling the local delta projection, `openspec init --language` passes through on both admitted lines, and validate surfaces the Purpose-placeholder warning class. The Agent delivery registry is rebuilt from the pinned 1.11 inventory: Zed joins from 1.10 (skills-only at `.agents/skills`, shared-root owner candidate), Antigravity declares `.agents` current with `.agent` legacy/migration evidence from 1.11 only while 1.10 keeps `.agent` current, opencode command templates carry the `**Provided arguments**` passthrough, and per-tool IDE-restart guidance follows actually written artifacts. Pinned 1.10.0/1.11.0 executable fixtures prove every accepted contract plus both capability-boundary rejections, and the references/openspec pin advances to verified v1.11.

  The 10.0.0 base version is consumed without a release so this major changeset publishes as OpenSpecUI 11.0.0: the v11 line deliberately skips a separate 1.10-only OpenSpecUI 10 release while still taking on every 1.10 protocol obligation.

### Minor Changes

- de39f9c: Present the Change Detail Evidence tab as a container-responsive list-detail workspace:
  evidence rows in the decision-plane layer order with fact-derived status chips, a detail
  pane that owns the tab's reading surface, and a crowded drill with a back affordance that
  keeps settled evidence mounted — replacing the stacked full-width accordions. Evidence
  semantics, CLI provenance, and typed degradation are unchanged.

### Patch Changes

- 4cc5289: Consume the 10.0.0 base version without a release so the pending major
  changeset publishes OpenSpecUI as 11.0.0 (the v11 line skips a separate
  10.x release, the same base-consumption the v9 release performed).

## 9.0.3

## 9.0.2

## 9.0.1

## 9.0.0

### Major Changes

- dfd04b8: OpenSpecUI 9 adapts OpenSpec CLI 1.8 and 1.9 in one release line: stable `>=1.8.0 <1.10.0` is admitted with the 1.9 line current and recommended and the 1.8 line supported non-current, while CLI `<1.8.0`, every prerelease, `>=1.10.0`, and unparseable versions stay blocked. Workflow Status projects the explicit `isPlanningComplete` planning fact and keeps `instructions apply` progress authoritative even when the actionable task list omits blank-description or indented checkboxes; `schemas --json` decodes as a success-array or selected-Root failure sum type so root-resolution failures keep their diagnostics instead of becoming an empty catalog; `validate --archived --json` is available as typed CLI evidence without repair or automatic archive. The Agent delivery registry is rebuilt from the official 1.9 inventory — Command Code, MiniMax Code user-global skills, Rovo Dev CLI, the available Shared `.agents` skills target, Codex at `.agents` with `.codex` as legacy migration evidence, and declared IDE restart requirements — with user-global roots observed but never cleaned or migrated locally. Pinned 1.8.0/1.9.0 executable fixtures prove every accepted contract, and the references/openspec pin moves to verified v1.9.0.

  The 8.0.0 base version is consumed without a release so this major changeset publishes as OpenSpecUI 9.0.0: the v9 line deliberately skips a separate 1.8-only OpenSpecUI 8 release while still taking on every 1.8 protocol obligation.

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
