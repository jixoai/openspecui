<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Record verified review findings at the hosted protocol, App projection, static, and delivery boundaries.
2. Split correction into independently reviewable production-owner packages.
3. Preserve the old Change and independent loading Change as separate sources of truth.
4. Define focused automated evidence and manager-owned walkthrough evidence.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-21): "每项先明确一个生产 owner、一个精准红例、一个绿例。focused review 未通过，不跑全量门禁。"
-->

## Research Findings

### Review baseline and delivery truth

| Fact | Evidence | Consequence |
| --- | --- | --- |
| The reviewed range is large and not covered by current PR evidence. | `git diff 24c313c...HEAD` has 23 commits / 114 files / +13,082 -958. PR #207's green checks predate it. | No merge, archive, or completion claim can rely on the existing PR status. |
| The old Change remains unfinished. | `openspec status --change target-openspec-cli-16-line --json` reports `109/131`, with 22 unchecked 8.x--11.x entries. | It is frozen, not archived. New proof later reconciles it by explicit link. |
| Full gates are currently not green. | `pnpm format:check` fails on four concurrent documentation files; focused server Vitest for `git-repository-binding-router.test.ts` produced no results and remained live until terminated. `implementation.md:9365-9412` attributes the known emission failures to the separate loading Change. | The regression is a delivery blocker. It needs its own repair owner; this Change only consumes its green result. |

### Confirmed product and security defects

| Fixed point | Production evidence | Required correction |
| --- | --- | --- |
| tRPC WebSocket Access Gate | `packages/server/src/server.ts:570-579` installs `applyWSSHandler` without a connection-param check. Upgrade handling at `:619-630` rejects an invalid header only when a header exists. `checkWebSocketConnectionParams` is only defined/tested in `access-gate.ts:90-99`. | Authenticate the tRPC connection context before any router procedure or subscription begins. Missing, invalid, reconnect, and valid credentials all require real WS integration evidence. |
| Auto-launch credential reachability | `server.ts:377-395` gates `/api/health`; `packages/app/src/lib/reachability.ts:27-40` sends no credential and maps all non-OK responses to `offline`; `use-connections.ts:134-139` and `use-active-backend.ts:56` use it. | Scope a session-only credential to the intended API locator; send it for health/HTTP/WS. Expose a reachable 401 as an authentication-required state, never as offline or a successful environment. |
| Environment identity | `server.ts:181-185` passes `host:${config.projectDir}` to `computeEnvUri`, although `research-plan.md:65` requires same host + data home to survive project/port/process variation. `stores.mutate` separately constructs `openspecui-env://1/${ctx.projectDir}` in `router.ts:3249-3254`. | Resolve a stable server host identity once, compute the opaque URI once, and inject the issued value into health and Store mutation ownership. No App or router reconstruction. |
| Explicit environment selection | `use-active-backend.ts:41-42` selects `tabs.find(...)`; its own header calls this "first online" while checkpoint 9.5 requires explicit selection. | Make selected tab/environment a first-class session state. Operations require a selected current online tab; no arbitrary fallback. |
| Multi-project Context Matrix | `context-matrix.tsx:28-44` sends only the active backend to `useEnvironmentObservation`; 8.6 therefore cannot join all connected online project contexts. | Observe all online tabs, credential-scope each request, and group only received backend-issued `envUri` / Root Context facts. |
| Store lifecycle and error truth | `StoreMutationService.start()` records transitions but awaits the CLI before returning (`store-mutation-service.ts:74-128`); `router.ts:3249-3260` and `backend-client.ts:160-196` expose only terminal HTTP results. `use-store-data.ts:104-105` always returns empty mutation arrays. Any HTTP non-OK is fabricated as `indeterminate`. | Start returns `accepted`; a typed backend subscription/rejoin stream publishes `running` and terminal results. Pre-start auth/validation/transport failures remain typed request errors, while `indeterminate` is post-start terminal uncertainty only. |
| Typed client boundary | `backend-client.ts:68,77,102,111,124,127,185,196`, `use-environment.ts:49,102-110`, and `use-store-data.ts:72,80` cast JSON into public contracts. | Publish browser-safe Zod schemas with the hosted contract, decode one tRPC envelope helper, and make malformed payloads typed contract failures. |
| Static and reactive truth | `static-data-provider.ts:617-630` synthesizes CLI success/exit/stdout evidence from static policy. `dashboard-git-projection.ts:96,111-112` uses native read/write filesystem calls for a reactive refresh input. | Static variants carry no live CLI evidence; reuse the shared mapping. Git refresh write settles via the physical/reactive writer and reactive observation. |
| Evidence hygiene | `access-gate.test.ts:22-30` uses `as any`; 12 changed TS/TSX files lack required headers. | Use checked HTTP/WS fixtures and add exact timestamped headers to every changed source/test file. |

The owner interview produced no unresolved product decision: the existing contract already fixes neutrality,
no permissions model, `envUri` semantics, backend-owned mutations, push-then-pull reactivity, and
owner-only final browser acceptance. The implementation may choose the concrete server host-identity
provider only if it keeps the stated equality relation; it may not use project path, port, process ID, or
a new client-side identifier.

## Decision & Plan (For Approval)

### P1: Hosted identity and Access Gate

**Production owners:** Core hosted protocol; Server bootstrap/WS context; CLI launch credential handoff.

1. Inject one Server-issued opaque `envUri` into all hosted surfaces. Its equality inputs are stable backend
   host identity and effective data home. Store mutation receives this issued value, never a path-derived
   surrogate.
2. Require the existing tRPC `connectionParams` handshake for gated browser WebSockets. tRPC's installed
   adapter calls `createContext({ info.connectionParams })` before procedures, so the gate belongs there;
   HTTP headers remain valid for non-browser clients.
3. Bind an auto-launch credential to one normalized `apiBaseUrl` in session memory. Health probing, HTTP
   RPC, and tRPC WS use only that entry's credential. `401/403` becomes `authentication-required`, not
   `offline`; the credential itself never enters URL, persisted tabs, logs, or another backend's request.

**Red / green / mutation resistance:** a raw WS with no connection params reaches a subscription before
the fix; it must fail after the gate is present. Removing the context check must make that same test fail.
Two Server projects with same host/data home must produce equal opaque URI, and changing either equality
input must not. A Store mutation must report that exact issued URI.

### P2: App connection and Context projection

**Production owners:** App connection state; reachability client; Environment Center / Context Matrix.

1. Retain backend locations without credentials, but keep a session-only credential map keyed by normalized
   `apiBaseUrl`.
2. Promote selected tab/environment to a current App fact. Environment-scoped views and mutations render
   a non-authoritative blocked state until their selected backend is online and protocol-compatible.
3. Independently probe every connected backend, then collect current Root Contexts for all online,
   credential-matched entries. The Context Matrix groups only these observed facts and retains no
   machine-wide completeness claim.

**Red / green / mutation resistance:** with two online tabs, an unselected first tab must not receive a
mutation or credential intended for B. Removing the selection guard must fail the real action-owner test.
A gated tab with its matched fragment credential must become online; the same tab without it must be
`authentication-required`, not offline.

### P3: Observable Store mutation lifecycle

**Production owners:** Server `StoreMutationService` / stores router; App typed backend stream and Store
Inspector controls.

1. Separate start admission from CLI settlement: record and return `accepted` without awaiting the run;
   rejoin the same request ID without a duplicate CLI. Add a backend-owned observable query/subscription
   that first emits known records then updates.
2. The App derives active/recent mutation state exclusively from this stream and uses terminal settlement to
   trigger invalidation-driven Store/Context refresh. It cannot locally fabricate `running` or terminal
   records.
3. Request rejection before admission reports its concrete auth/validation/transport error. Only an
   admitted operation whose terminal result cannot be recovered is `indeterminate`.

**Red / green / mutation resistance:** delay a CLI run and prove a real router/App subscriber observes
`accepted`, then `running`, before terminal. Removing the stream publish or making start await terminal
must fail that test. A denied call must prove that no mutation record exists and no destructive dialog
pretends it may have completed.

### P4: Contract truth and reactive/static repair

**Production owners:** Core hosted schemas; App backend client; Web static provider; Server Git refresh
writer; typed test fixtures.

1. Define shared browser-safe envelope/result schemas and a one-path decoder. Preserve upstream evidence
   verbatim only after parsing; surface schema drift as typed contract evidence.
2. Make static reference provenance explicitly no-live-evidence and share source-aware catalog mapping
   instead of constructing fake CLI result objects.
3. Replace native data-bearing Git stamp I/O with the existing reactive writer/read settlement path.
4. Repair prohibited test casts and missing headers before attempting broad gates.

**Red / green / mutation resistance:** malformed response data must not become an available Store/Root
projection; static output must contain no fabricated success/exit/stdout; removing the reactive settle
transition must fail the refresh invalidation proof.

### P5: Delivery recovery, old-tracker reconciliation, and owner walkthrough

**Production owners:** loading-change repair owner for the known server emission regression; this
Change's reviewer for gate evidence and tracker reconciliation; manager for final walkthrough.

1. Do not repair the independent loading Change incidentally. Require its focused regression proof and
passing affected server tests before P1--P4 broad gates run.
2. After P1--P4 are independently accepted, run the full local gates once, update PR evidence, and
reconcile the 22 old tracker entries only with explicit completed-proof links.
3. The manager then performs the real end-to-end walkthroughs recorded below. Only after that may strict
OpenSpec verification, merge approval, old/new archive consideration, and optional release sequencing
begin.

## Capability Impact

### New or Expanded Behavior

- Gated backend reachability gains an explicit authentication-required state and per-backend ephemeral
  credentials.
- Store mutations gain an observable, reconnectable lifecycle projection with exact admitted-operation
  semantics.
- Context Matrix observes all currently connected online project backends rather than one arbitrary tab.
- Hosted response contracts gain runtime validation and static reference provenance gains a no-live-evidence
  variant.

### Modified Behavior

- `envUri` no longer varies by project path and all Store mutation records use the actual backend-issued
  identity.
- WebSocket subscriptions reject missing or invalid credentials before router access.
- Environment-scoped actions no longer target the first online backend.
- Delivery completion no longer treats old green PR checks, local casts, or owner walkthrough placeholders
  as completion evidence.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Changing WS admission breaks unguarded development or non-browser clients. | Maintain the absent-gate pass-through contract; test both header and connection-param clients against the real adapter. |
| Host identity implementation regresses multi-project grouping. | Make identity injectable in server tests; forbid projectDir/port/PID inputs and test its equality law explicitly. |
| A lifecycle stream becomes a competing client Store database. | The stream is an operation ledger only; Store inventory/doctor/context remain push-invalidation then typed pull projections. |
| Auto-launch credential leaks to another configured backend. | Associate it with one normalized locator; test two backend URLs and assert only the matched request carries Authorization. |
| Loading-change regression is misattributed or silently masked. | Run its exact failing tests before and after its own correction; record stdout and do not weaken timeouts/assertions to pass. |
| Owner walkthrough waits on unrelated visual work. | Record only required behavioral checks here; visual/loading redesign remains in `refine-live-projection-experience`. |

## Verification Strategy

1. For P1--P4, begin with the named real public/mutation owner red case. Record the pre-fix failure and
   mutation-resistance result before the green result. Do not run broad gates while focused review is open.
2. Use checked Vitest fixtures plus basic component-level Playwright only for real HTTP/WS/Server/App
   boundaries. No fake button, downstream-handler invocation, disabled-control assertion, `as any`, or
   transpile-only proof counts as defect evidence.
3. Static changes require focused static-provider tests and a clean
   `pnpm --filter @openspecui/web build:ssg` rebuild.
4. After focused acceptance and the independent loading regression repair, run once:
   `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and
   `pnpm test:browser:ci`.
5. Manager-only walkthrough ledger: a gated auto-launch project, WS reconnect with valid/missing/invalid
   credential, two selected project tabs on one environment, distinct environments, Store lifecycle plus
   disconnect/rejoin, Context Matrix observed-only grouping, static Reference output, and desktop/mobile
   App layout. Automated results are preparation evidence, never a replacement.
