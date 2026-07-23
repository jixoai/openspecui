<!--
Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
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
| The old Change remains unfinished. | The initial audit reported `109/131`; independent correction reopens overstated 8.12/9.4/9.5, so current status is `106/131` with 25 unchecked entries. | Its transfer ledger is complete, but partial archive still requires strict validation and manager confirmation. |
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

### P1/P2 independent correction review (2026-07-24)

The first P1/P2 candidates prove Server admission and App-native requests, but they do not prove the
advertised gated Project Web product chain. The following are independent fixed points and must not be
closed by one broad App test:

| Fixed point | Current production evidence | Review decision |
| --- | --- | --- |
| CLI to browser credential | `packages/cli/src/cli.ts:143-148` builds Direct/App browser URLs from only the Server URL; `startServer()` resolves and prints the gate credential internally but `RunningServer` exposes no launch credential. | Reopen P1 browser delivery. The generated/manual credential must reach the exact Direct/App launch fragment without query, storage, or log persistence. |
| App to Project Web bootstrap | `packages/core/src/hosted-app.ts:161-169` and `packages/app/src/lib/shell-state.ts:243-248` put only `api` and `session` in the iframe URL. `packages/server/src/server.ts:385-386` gates static navigation before the shell can load. | Make static shell admission physically distinct from protected data authority, then bootstrap only the matching iframe from a fragment that Project Web consumes and removes. |
| Project Web transports | `packages/web/src/lib/trpc.ts:38-100` supplies neither HTTP Authorization nor WS `connectionParams`; `terminal-controller.ts:1548-1562` sends `list` before PTY auth; several raw fetch/resource paths have no shared credential owner. | One Web in-memory owner must supply every protected HTTP/tRPC WS/PTY/raw resource path. Real gated transport fixtures and mutation-resistance are required. |
| Selected authority provenance | `connection-observation.tsx:213-245` collapses retained tabs by normalized locator; `use-active-backend.ts:43-49` joins by URL without exact `tabId`/generation. Duplicate/replaced same-locator tabs can inherit retired authority. | P2 remains open. Bind selected authority to exact tab identity plus current generation and prove the real Store action fails if that guard is removed. |
| Root/Reference error truth | `connection-observation.tsx:181-195` records typed Root error as `rootStatus: error` while dropping its message; `context-matrix.tsx:46-59` renders every non-ready Root as `stale`. Existing route tests assert only project names. | Preserve source-labelled typed errors and exact Reference provenance. Add two-source evidence; a stale label cannot replace error evidence. |

The owner interview produced no unresolved product decision: the existing contract already fixes neutrality,
no permissions model, `envUri` semantics, backend-owned mutations, push-then-pull reactivity, and
owner-only final browser acceptance. The implementation may choose the concrete server host-identity
provider only if it keeps the stated equality relation; it may not use project path, port, process ID, or
a new client-side identifier.

### P1/P2 second independent review after `d041a34` and `72b0b14`

The candidates now implement most intended production owners, but focused acceptance remains rejected.
The remaining defects are narrower than the original packages and require correction, not a redesign.

| Fixed point | Current evidence | Required correction |
| --- | --- | --- |
| Browser resource credential isolation | `packages/web/src/access-gate-resource-worker.ts` falls back from an absent `event.clientId` to all window clients and accepts the first credential response. | Remove cross-client fallback. A protected resource either receives the credential from its initiating client or fails with the real gated response. Prove one authenticated and one unauthenticated/retired client cannot lend authority to each other. |
| Worktree child admission and browser handoff | `WorktreeServerWorkerData` and process launch plans carry project/port only; child `startServer` receives no parent Gate, while `assertWorktreeServerCompatible` sends no Authorization. `server-handoff.ts` then navigates to a bare child URL after the current page already stripped its credential fragment into module memory. | Propagate the exact parent Gate through worker and process child launch, keep it out of argv/logs, authenticate readiness, and bind the current Project Web credential only to the target child fragment. The child consumes/removes it; `GitWorktreeHandoff`, query, storage, and logs remain credential-free. |
| Gated product-chain evidence | Existing tests prove helper fragments and individual Web suppliers, but no terminating fixture crosses actual CLI/private launch, public shell, Project Web consumption, protected HTTP, tRPC WS, and PTY. | Add one real Direct/App integration fixture. Independently removing CLI/iframe binding, HTTP supplier, WS params, or PTY auth-first must fail its named assertion. |
| Root freshness | `connection-observation.tsx` retains prior Root data, sets `stale:false` at refresh start, and does not restore stale after transport failure. `ContextMatrixRoute` filters retained offline observations. | Retained Root/Reference evidence remains display-only and explicitly stale through checking, refresh, offline, auth failure, and transport error until replacement Root data commits. |
| Store action evidence | Register crosses the form only for a replacement-tab case, while generation evidence calls `dispatchStoreMutation` directly; Remove injects a hand-authored `isCurrent`. | Use real Register and Remove surfaces. Removing/bypassing exact tab identity or generation retirement must make the same fixture dispatch incorrectly and fail for that intended reason. |
| Reference warning truth | `use-environment.ts` rewrites every non-error Reference diagnostic as `healthy`; Context Matrix can replace diagnostic text with the root title. | Preserve Store id, root, diagnostic severity/code/message, and source label neutrally. Warnings remain visible and do not become errors or healthy claims. |
| Connected-project count | Environment grouping counts duplicate same-locator tabs as separate connected projects. | Keep observation generations tab-distinct for authority, but deduplicate the environment-level connected-project projection by normalized backend/project locator. |

These findings do not require manager interview: the existing contract already forbids cross-client
credential leakage, ungated advertised surfaces, stale authority, diagnostic reinterpretation, and
same-locator authority inheritance. P1 and P2 corrections may proceed in parallel over disjoint owners.

## Decision & Plan (For Approval)

### P1: Hosted identity and Access Gate

**Production owners:** Core hosted protocol; Server bootstrap/WS context; CLI launch credential handoff.

1. Inject one Server-issued opaque `envUri` into all hosted surfaces. Its equality inputs are stable backend
   host identity and effective data home. Store mutation receives this issued value, never a path-derived
   surrogate.
2. Require the existing tRPC `connectionParams` handshake for gated browser WebSockets. tRPC's installed
   adapter calls `createContext({ info.connectionParams })` before procedures, so the gate belongs there;
   HTTP headers remain valid for non-browser clients.
3. Deliver the resolved gate credential into a Direct/App launch fragment, then bind it to one normalized
   `apiBaseUrl` in session memory. The App passes it only to the matching iframe bootstrap; Project Web
   consumes and strips it before rendering.
4. Keep the static Project Web shell loadable without data authority. All protected HTTP RPC, tRPC WS,
   PTY, file, notification, and raw resource paths consume one Web credential owner. `401/403` becomes
   `authentication-required`; no credential enters URL query, persisted tabs, logs, or another locator.

**Red / green / mutation resistance:** the accepted Server-side admission proof remains necessary but is
not sufficient. A real gated Direct/App Project Web must load its shell and reach one HTTP RPC, one
subscription, and one PTY operation. Missing/invalid credentials remain rejected. Removing each transport
supplier or iframe-locator binding must make the corresponding fixture fail. Two Server projects with
same host/data home still produce equal opaque URI, and Store mutation uses that exact issued URI.

### P2: App connection and Context projection

**Production owners:** App connection state; reachability client; Environment Center / Context Matrix.

1. Retain backend locations without credentials, but keep a session-only credential map keyed by normalized
   `apiBaseUrl`.
2. Promote selected tab/environment to an exact `tabId` plus current observation-generation fact.
   Environment-scoped views and mutations remain non-authoritative until that same tab generation is
   online and protocol-compatible; a duplicate/replaced same-locator tab cannot inherit authority.
3. Independently probe every connected backend, then collect current Root Contexts for all online,
   credential-matched entries. Preserve typed Root errors and exact per-source Reference provenance. The
   Context Matrix groups only these observed facts and retains no machine-wide completeness claim.

**Red / green / mutation resistance:** with two online tabs, an unselected first tab must not receive a
mutation or credential intended for B. Replacing B at the same locator must retire the old generation.
Removing the exact tab/generation guard must fail the real action-owner test. A two-source fixture must
distinguish Root error from stale/loading and render both sources' Reference provenance.

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
2. Reconcile all 25 old tracker entries by exact proof link or explicit transfer. After manager
confirmation, archive the old Change as partial/superseded with `--skip-specs` without changing its
unchecked facts. Its loop artifacts are complete but it has no delta specs, so standalone strict change
validation cannot pass without fabricating history; archive's own delta validation remains enabled and
simply has no delta to inspect. This is history management, not a completion claim.
3. After P1--P4 are independently accepted, run the full local gates once and update PR evidence. The
manager then performs the real end-to-end walkthroughs. Only after that may this corrective Change verify,
merge, archive, and enter optional release sequencing.

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
| Public shell admission is mistaken for data authorization. | Exempt only immutable shell entry assets; keep every data/file/RPC/WS/PTY/notification boundary gated and prove missing credentials cannot reach them. |
| Browser transport repair covers tRPC but leaves a raw fetch/resource bypass. | Inventory every Web network path first and route protected traffic through one credential supplier; record any deliberately public asset path explicitly. |
| Same-locator tab replacement inherits old authority. | Join on exact tab identity plus observation generation and make the real Store action mutation test fail when either check is removed. |
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
