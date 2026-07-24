<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Record the pre-apply review baseline and work-package ownership for delivery-gap closure.
2. Define the evidence order that prevents recurrence of mock-only or terminal-only proof.
3. Preserve external loading-change ownership and manager-only final walkthroughs.
4. List the exact loopback conditions that require a new owner decision.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-19): "不要在 6.11 这个任务上徘徊了。你得把它拆开成多个独立的小问题，然后把阻塞的问题发给我，我来决策推进。"
-->

## Implementation State

### Pre-apply baseline

At its 2026-07-23 baseline, this Change contained planning artifacts only. Later P1/P2 candidates are
recorded below; review baseline remains `24c313c...HEAD`.

The prior `target-openspec-cli-16-line` Change entered review at `109/131`; the later correction below
reopens three overstated claims, leaving `106/131` and 25 unchecked obligations. It remains unarchived.
`accelerate-live-projection-loading` was independently archived/replaced by
`refine-live-projection-experience`; its server emission regression remains an external hard blocker.

### P1 execution start: 2026-07-24 Asia/Shanghai

`GOAL.md` authorizes only P1 Hosted identity, real Access Gate admission, and locator-scoped launch
credentials. The main agent remains review/Change-only and does not edit production or test code.

The independent `gpt-5.6-terra` red-evidence worker was attempted three times before production work;
each attempt failed at the local model gateway with `503 Service Unavailable` before reading or editing the
workspace. No test result or code artifact was produced. To avoid infrastructure-only idle time, two
`gpt-5.6-sol` high-reasoning workers were authorized to capture their own fixed-point red evidence before
implementing the non-overlapping Server/Core and App owners. Their self-tests are implementation evidence,
not independent test acceptance. A recovered Terra worker or equivalent independent reviewer must still
re-run the focused P1 evidence before checkpoint `2.8` can close.

No P1 checkbox is closed by this orchestration decision. Full gates, P2+, PR update, archive, merge,
release, and manager-owned browser walkthroughs remain forbidden until focused P1 review accepts the
actual candidate.

### P1 initially accepted candidate, browser delivery later reopened: 2026-07-24 Asia/Shanghai

Production commits:

- `56cead6 fix(server): enforce hosted identity and websocket gate`
- `801c819 fix(app): scope hosted credentials by backend locator`

Fixed-point red evidence:

- A guarded real `startServer -> applyWSSHandler -> system.status` query with no connection credential
  resolved to the real router payload including `projectDir` before the Server correction. It was not a
  direct helper call or downstream mock.
- 401/403 health responses were classified as `offline`; one global session credential could not represent
  two locator owners; launch parsing had no combined bind-before-strip owner.

Implemented owner boundaries:

- Server host identity defaults to normalized `node:os.hostname()` and is injectable for deterministic
  tests. `createServer` computes one opaque `envUri` from that host identity and the effective data home;
  health, HTTP/WS Context, and Store mutation admission receive the exact value. Project-derived Store URI
  construction and its public branding seam were removed.
- tRPC WebSocket `createContext` accepts either valid connection params or a supported Authorization header
  and throws `UNAUTHORIZED` before router Context is returned. Missing/invalid, reconnect, guarded HTTP,
  guarded PTY, valid, and unguarded cases cross their production adapters.
- App launch consumption binds the fragment to normalized `apiBaseUrl` before visible query/fragment
  removal. Credentials live in a process-memory locator map; health and every existing hosted HTTP/RPC
  client resolve their own locator at dispatch. 401/403 is `authentication-required`; persisted tab state,
  URL state, localStorage, and relay acknowledgements carry no credential. The existing same-origin PWA
  relay transfers the locator-bound credential transiently without introducing an App WebSocket client or
  P2 selection semantics.

Mutation-resistance evidence:

- Removing the Server `createContext` gate made the same unauthorized WS test receive the real
  `system.status`/`projectDir` payload.
- Restoring a project-path Store URI made the Store operation URI differ from the health-issued URI.
- Replacing locator lookup with the registry's first value made three App assertions fail: backend B's
  registry, health request, and HTTP/RPC requests all received A's credential.

Independent reviewer verification:

- `pnpm --filter @openspecui/app test` -> 21 files, 100 tests passed.
- `pnpm --filter @openspecui/app typecheck` -> passed.
- `pnpm --filter @openspecui/server exec vitest run --reporter=verbose --no-file-parallelism src/hosted-admission.test.ts src/access-gate.test.ts src/store-mutation-service.test.ts` -> 3 files, 19 tests passed.
- `pnpm --filter @openspecui/core exec vitest run src/hosted-protocol.test.ts` -> 9 tests passed.
- `pnpm --filter @openspecui/server typecheck` -> all five checked TypeScript projects passed.

Four Terra worker launches failed at the local model gateway with `503 Service Unavailable` before the
worker could inspect or edit the repository. The main reviewer therefore performed the equivalent focused
rerun and source review. Those results accept Server admission, identity, and App-native credential scope
only. The later product-chain review below reopens complete P1 acceptance; it is not final browser
acceptance and P3/P4 remain forbidden.

Residual facts retained for later packages:

- Renaming the operating-system hostname intentionally changes `envUri`.
- The PWA credential relay is a same-origin transient message, not persistence or transport
  confidentiality; the Access Gate remains a shared-secret guard rather than an account/permission model.
- App still selects the first online backend and Context Matrix still observes only that backend. Those are
  P2 defects, not P1 regressions.

### Execution ledger

| Order | Package                                  | State                                                | Production owner                                                                                    | Required focused proof before next package                                                                                                                                 |
| ----- | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | P1 Hosted identity + Gate                | Partial; browser delivery correction open            | Core hosted contract; Server bootstrap and tRPC WS context; CLI/App/Web credential handoff          | Existing Server admission/identity proof plus real gated Direct/App Project Web HTTP RPC, subscription, and PTY proof.                                                     |
| 2     | P2 Connection selection + Context Matrix | Candidate rejected; correction open                  | App credential registry, reachability, selected tab generation, Environment Center / Context Matrix | Exact tab/generation action guard plus source-labelled Root error and two-source Reference provenance.                                                                     |
| 3     | P3 Store mutation ledger                 | Not started                                          | Server StoreMutationService/router; App operation subscription and Inspector                        | Delayed real CLI fixture observes accepted then running before terminal; denied pre-start call creates no mutation; removing transition publication fails.                 |
| 4     | P4 Typed/static/reactive repair          | Not started                                          | Core schemas; App decoder; static provider; Server reactive Git stamp; affected tests               | Malformed envelope cannot become current; static has no fabricated live evidence; removing physical/reactive settlement fails; all changed TS/TSX headers/types are valid. |
| 5     | P5 Delivery recovery + acceptance        | Blocked on P1--P4 and independent loading regression | Loading-change owner; reviewer; manager                                                             | Exact server emission failures are green in their own Change, then one complete local gate run and manager walkthrough ledger.                                             |

Every package must use the following order. A green assertion from a fake control, direct downstream
callback, disabled state, transpile-only test, or terminal result alone is not proof.

```text
real public or mutation owner
            |
            v
named pre-fix red case -> review accepts cause -> implementation
            |                                      |
            +--------------------------------------+---> green case
                                                       |
                                                       v
                  remove exact guard/transition -> same test red -> restore
```

### Required source boundaries

- P1 uses the URL launch request parsed before it is stripped as the credential's one permitted locator.
  `#credential` without a corresponding launch locator must not be silently assigned to an arbitrary
  retained connection; report an actionable authentication configuration state instead.
- P1's server host identity defaults to a Server-resolved host fact, not project path/port/PID. It must be
  injectable for deterministic tests and passed unchanged to `computeEnvUri`; the exact issued `EnvUri`
  is held by Server context and injected into Store mutation start.
- P1's WebSocket gate runs through tRPC `createContext` with `info.connectionParams`; it rejects before
  a procedure or subscription can obtain `Context`. Unguarded mode remains a true pass-through.
- P2 owns all App connection observations. Credentials remain session-only and are keyed by normalized
  API base URL; persisted tabs retain no credentials. Selected environment is an explicit current tab
  fact, never `tabs.find(online)` fallback.
- P3's operation ledger is not Store inventory. The Server owns all lifecycle records and client
  subscription/rejoin behavior; Store/Context facts refresh only through their existing invalidation/pull
  path. A UI holds no synthetic lifecycle state.
- P4 shares schemas and source-aware mapping rather than adding untyped REST decoders or static copies of
  CLI evidence. Git refresh inputs use the existing physical/reactive write mechanism and complete only
  after reactive state settles.

## Decisions Taken

1. Current App route state is not adequate evidence of environment choice. The correction uses a selected
   tab/environment state, with a non-authoritative block when it is absent, stale, unsupported, offline,
   or authentication-required.
2. A protected endpoint that returns 401/403 is reachable but not authorized. The product state is
   `authentication-required`, distinct from `offline`; no automatic retry or authorization invention is
   permitted.
3. `indeterminate` is only a loss of terminal truth after admission. It cannot be returned for a missing
   credential, HTTP rejection, invalid request, malformed payload, or a request known not to start.
4. `envUri` equality is host identity plus effective data home. A server test seam can provide host
   identity, but the App and router never construct the URI or parse it for display.
5. The manager owns every final visual/end-to-end walkthrough. Agents may supply only focused Vitest and
   basic component/fixture Playwright preparation evidence.
6. The original Change may be archived as an explicitly partial/superseded record after its 25 unchecked
   items are mapped and the manager confirms. Transfer never marks them complete; this corrective Change
   remains responsible for its own proof, gates, walkthrough, merge, and later archive.

## Divergence Notes

- P1/P2 implementation candidates now exist. Their independently confirmed gaps are recorded below and
  are reopened rather than hidden as residual risk.
- `refine-live-projection-experience` is a concurrently created separate Change. This Change must not
  modify its files or reclassify its regression as fixed without its own focused result.
- The prior scoped server command was intentionally terminated after it reproduced the documented
  no-emission hang. It is negative evidence, not a passing test result and not a substitute for the
  independent regression repair.
- The current worktree includes concurrent archive/replacement edits under `accelerate-live-projection-loading`,
  `refine-live-projection-experience`, and `live-projection-work`; they are explicitly out of this
  Change's staging scope.

## Loopback Triggers

Return to `research-plan.md` and obtain a manager decision before implementation proceeds if any of these
conditions appears:

1. A cross-platform stable host identity cannot be provided without storing a new operator-managed
   identifier or changing the intended equality semantics of `envUri`.
2. tRPC connection parameters cannot be authenticated before application context/procedure exposure using
   the installed adapter, requiring a different transport or a user-visible protocol change.
3. Binding an auto-launch fragment to its parsed launch API URL cannot survive the existing App/PWA relay
   without exposing the credential through persisted tabs, localStorage, URL query, logs, or another
   backend request.
4. A Store lifecycle stream requires retaining operation records beyond the current backend process,
   introduces cancel/retry behavior, or becomes a second Store inventory truth.
5. The loading-change regression cannot be repaired without changing P1--P4 contracts, weakening its
   exact failing assertion, or expanding into the independent UI-experience/Kanban scope.
6. A required owner walkthrough reveals a behavior that contradicts the written fixed points rather than
   merely a missing test or implementation defect.

### P1/P2 independent correction review: 2026-07-24 Asia/Shanghai

Review baseline:

- P1 production: `56cead6`, `801c819`.
- P2 candidate: `1c014b1` (`1b7e1ad..1c014b1`). Later `ca1db28` and `652c1fd` belong to the independent
  loading/visual Change and are preserved but do not prove P1/P2.
- P2 worker evidence: App 23 files / 107 tests and App typecheck passed. The independent Terra worker
  returned `503 Service Unavailable` before producing a repository result.

Accepted facts:

- Server rejects missing/invalid guarded tRPC WS credentials before router Context and preserves valid,
  reconnect, PTY-first-message, HTTP-header, and unguarded cases.
- Server issues one `envUri` from host identity plus effective data home and Store mutation consumes it.
- App-native health/HTTP requests use locator-scoped runtime credentials and classify 401/403 as
  `authentication-required`.
- P2 introduces a shared all-tab observation owner, explicit `activeTabId`, selected Store dispatch, and
  removed/re-added generation retirement.

Rejected completion claims and exact reasons:

1. **CLI/App Project Web credential delivery is absent.** CLI builds Direct/App launch URLs without the
   resolved credential. The App iframe URL carries only `api` and `session`; whole-backend middleware gates
   `/` before Project Web JavaScript can load. This invalidates complete P1 acceptance.
2. **Project Web transport supply is absent.** Its tRPC HTTP link has no Authorization supplier, tRPC WS has
   no `connectionParams`, and PTY sends `list` before auth. Raw protected fetch/resource paths have no one
   audited owner. Server rejection tests prove the gate, not that the product can use it.
3. **Selected authority is locator-only.** P2 collapses tabs by normalized URL and joins selection by URL,
   so a duplicate/replaced same-locator tab may inherit prior `current` authority. The existing test covers
   remove -> empty -> re-add, not the same-locator real Store action fixed point.
4. **Root error evidence is dropped.** A typed Root error becomes `rootStatus: error` with null detail, then
   Context Matrix renders every non-ready state as `stale`. Existing route evidence asserts only two project
   names and proves neither distinct Reference provenance nor error truth.
5. **Observation ownership has two writers.** AppLayout's Provider observes persisted shell state while
   HostedShell separately writes local shell tabs into the same owner. This is a structural risk; eliminate
   it if the exact-generation correction can do so without expanding into unrelated shell redesign.

Correction packages:

```text
P1-B1 CLI -> Direct/App fragment -> matching iframe bootstrap
P1-B2 public static shell -> one Web memory credential owner -> HTTP/WS/PTY/raw protected paths
P2-C  exact selected tab + observation generation -> real Store action
P2-D  source-labelled Root error + exact two-source Reference/group provenance
```

Each package needs one real fixed-point red, green, and removal/bypass mutation result. P1-B and P2-C/D
may be implemented in parallel because their production files are independent; focused review must accept
all four before any P3/P4 work or broad workspace gate.

### P1/P2 second correction boundary: 2026-07-24 Asia/Shanghai

Reviewed candidates:

- P1 browser delivery candidate: `40519c4..d041a34`.
- P2 selected-provenance candidate: `40519c4..72b0b14`.
- Worker-reported focused evidence: Web 2 tests, App 1 test, P1 package typechecks; App 24 files / 115
  tests and App typecheck for P2. A broader accidental Web suite is not focused product-chain evidence.

Accepted implementation facts:

- Direct/App fragments, matching App iframe fragments, public immutable shell/assets, one Web in-memory
  credential owner, tRPC HTTP/WS supply, PTY auth-first, and raw resource bridging now exist.
- Selected authority now carries exact `activeTabId` plus observation generation; same-locator tabs retain
  distinct generations; Store mutations share one dispatch owner; typed Root errors and A/B Reference
  sources are represented; observation publication has one writer.

Focused acceptance remains rejected for these exact reasons:

1. The Service Worker can borrow the first credential returned by any window when the initiating client is
   absent. This violates per-client authority and invalidates `2.10`.
2. Worktree worker/process child Servers do not inherit the parent Gate and the readiness probe is
   unauthenticated. A protected parent can therefore hand off to an unprotected child. Conversely, merely
   protecting the child leaves Project Web unable to use it because `server-handoff.ts` navigates to a bare
   child URL after the credential fragment has been consumed into page memory. Child admission, readiness,
   and target-only fragment handoff must close together; `2.8--2.11` remain open.
3. P1 tests remain separate helper/transport proofs. No real gated Direct/App Project Web fixture crosses
   private launch, public shell, protected HTTP, subscription, and PTY; per-supplier mutation removal is
   absent. `2.11--2.12` remain open.
4. P2 refresh can retain old Root/Reference data while marking it non-stale, and transport failure does not
   restore stale. Retained offline evidence is filtered from Context Matrix. `3.3--3.4` remain open.
5. P2 warning diagnostics are reinterpreted as healthy or hidden by a root title, and duplicate tabs at
   one locator inflate connected-project counts. `3.4` remains open.
6. P2 generation and Remove tests call/inject downstream authority helpers instead of crossing the real
   Register/Remove mutation owner. They do not prove the exact guard; `3.5--3.6` remain open.

Correction stop rule:

```text
P1 correction = client-bound resource authority + inherited usable child Gate + terminating product-chain proof
P2 correction = honest stale/warning/group projection + real Register/Remove guard mutation proofs
```

Each lane gets its own production commit and focused evidence. Do not mark any P1/P2 checkbox, run broad
gates, begin P3/P4, update the PR, or request manager browser acceptance until the main reviewer accepts
both corrected SHAs.

### P2 third correction boundary: 2026-07-24 Asia/Shanghai

Reviewed candidate: `e22f960`.

Worker evidence independently rerun before review:

- App: 24 files / 121 tests passed.
- App typecheck passed.
- Removing the selected-tab check or observation-generation check reportedly turns the real Register or
  Remove route fixture red.

Focused acceptance remains rejected. Passing tests do not cover these production defects:

1. A refresh creates a new observation generation while retaining old Root/Reference evidence. Derivation
   then relabels the retained evidence with the new generation, new health/envUri, and a new timestamp.
2. The authority resolver checks old observation identity only by tab id and locator, then borrows
   session/creation identity from the newly selected replacement tab. This hybrid can pass before passive
   tab synchronization retires the old observation.
3. One guard test mutates a committed `disabled` DOM property; React does not dispatch the click, so the
   asserted non-mutation never reaches the production guard.
4. The production Store Inspector exposes internal generation fields solely as test instrumentation.
5. `StoreRemoveDialog` permits a missing mutation owner and leaves a retired destructive submit visibly
   enabled, both of which degrade into silent rejection instead of an explicit interaction boundary.

Required P2 correction:

```text
P2-E  full tab identity <-> generation atomic correlation
P2-F  retained Root evidence keeps original generation/envUri/observedAt
P2-G  real Register/Remove guard proof without disabled-DOM bypass or production test data
```

One scoped production commit plus focused App tests and App typecheck are required. `3.1--3.6` remain
unchecked. P1 continues independently; P3/P4, broad gates, PR update, archive, merge, release, and browser
walkthrough remain forbidden until both corrected lanes pass main-agent review.

### P1 third correction review: 2026-07-24 Asia/Shanghai

Reviewed candidate: `acd092c`.

Independent rerun:

- Web resource/handoff: 2 files / 3 tests passed.
- CLI worktree manager: 1 file / 16 tests passed.
- Server terminating fixture: 1 file / 1 test passed.
- CLI typecheck and checked P1 fixture typecheck passed.

Accepted and closed:

- `2.9`: the immutable Project Web shell is publicly loadable while health/data surfaces reject a missing
  Gate. This is static admission only and grants no data authority.

Rejected completion claims:

1. Production always chooses `createWorktreeServerWorker`, but the bundle's translation and worktree
   handlers both claim any non-main thread. The translation handler throws on Worktree data before the
   guarded child Server can start. The process-only integration test bypasses this production path.
2. The terminating fixture manually combines `startServer`'s callback credential with URL builders. It
   does not execute `cli.ts`'s real callback-to-opened-target owner, so deleting that production binding
   leaves the fixture green.
3. The Service Worker fixture does not cover a non-empty retired initiating-client id. Deleting the exact
   missing-client transition is therefore not mutation-resistant evidence.

Correction atoms:

```text
P1-C1 typed worker-kind envelope -> real worker -> guarded child health
P1-C2 real CLI start owner -> requested Direct/App browser target
P1-C3 non-empty retired resource client -> no borrowed credential
```

`2.8`, `2.10`, `2.11`, and `2.12` remain unchecked. Each atom needs its own exact red/green/removal result;
do not rerun broad gates or restart already accepted HTTP/WS/PTY implementation.

### P2 fourth correction review: 2026-07-24 Asia/Shanghai

Reviewed candidate: `cf57f76`.

Independently accepted:

- `3.1`: selected authority now correlates tab id, normalized locator, session id, creation identity, and the
  current observation generation atomically.
- `3.2`: App-native locator credentials remain isolated; Project Web supply stays owned by P1.
- `3.5`: real Register/Remove route fixtures turn red when active-tab, session/creation, or generation
  checks are removed. No disabled-DOM bypass or production test instrumentation is involved.
- Candidate App evidence passed 24 files / 125 tests, App production typecheck, and `git diff --check`.

Focused acceptance remains rejected for `3.3`, `3.4`, and therefore `3.6`:

1. `projectRootObservation()` constructs one impossible hybrid record: retained A contributes tab,
   generation, locator, health/envUri, Root/Reference data, and observation time, while current B contributes
   `rootStatus/rootError`. Context Matrix then renders B's failed refresh as A's Root error without exposing
   B provenance.
2. The central provenance fixture is a `*.test.ts` excluded by the inherited TypeScript configuration. Its
   passing Vitest transpilation is not typed public-boundary evidence.

Required P2 correction:

```text
Root projection
├─ evidence: A full source + A health/envUri + A Root/References + A observedAt
└─ attempt:  B full source + B health/envUri when known + B status/error + B observedAt
```

Both source identities contain tab id, session id, API locator, tab creation identity, and generation. A
ready `env:a/genA/at101` followed by a failed `env:b/genB/at202` refresh must preserve A as a stale evidence
row and visibly attribute the latest failure to B. Hiding B or hanging its error on A is invalid. The exact
fixture and its UI projection must enter a narrow checked P2 test-typecheck lane and fail if the hybrid join
is restored. No P3/P4, broad gate, PR update, archive, merge, release, or browser walkthrough may start
before this correction passes main-agent review.

### P1 final focused acceptance: 2026-07-24 Asia/Shanghai

Accepted correction commits:

- `d34edca` (`P1-C1`): typed worktree/translation worker-kind envelopes; the real
  `createWorktreeServerWorker` enters `startServer`, rejects missing child health authority with 401, and
  accepts only the exact inherited parent Gate with 200.
- `a565594` (`P1-C2/C3`): the `cli.ts`-invoked production browser-target coordinator receives the actual
  `startServer` callback credential for Direct/App targets, and a non-empty retired Service Worker client
  cannot borrow another window's Authorization.

Independent focused rerun:

- CLI target/builders: 2 files / 5 tests.
- App matching iframe delivery: 1 file / 1 test.
- Server guarded Project Web HTTP/subscription/PTY chain: 1 file / 1 test.
- Web credential/HTTP/WS/PTY/resource/handoff: 6 files / 52 tests.
- Real worktree worker: 1 file / 18 tests; translation routing: 1 file / 7 tests.
- CLI, App, Server, and P1 checked-fixture typechecks passed.

Mutation evidence is exact-owner evidence: removing Direct or App credential supply loses the required
fragment; bypassing the retired-client guard borrows another client's Bearer value; removing foreign-kind
routing makes the real worktree fixture fail from translation payload collision. Existing supplier removal
evidence continues to cover matching iframe, Web HTTP/WS/PTY, raw resources, and child handoff. Therefore
`2.8`, `2.10`, `2.11`, and focused-review gate `2.12` are closed. This does not close manager-only browser
walkthroughs `6.7/6.8`, broad gates, PR delivery, merge, or release.

### P2 final focused acceptance: 2026-07-24 Asia/Shanghai

Accepted correction commit: `83933d5`.

The production projection now preserves two non-interchangeable records:

```text
Root observation
├─ evidence: A full tab source + health/envUri + Root/References + observedAt
└─ attempt:  B full tab source + health/envUri + lifecycle/error + observedAt
```

The exact `env:a/gen1/at101` ready evidence followed by `env:b/gen2/at202` failed attempt remains one
stale A row with A's Root and direct Reference, while the latest failure visibly exposes B's locator,
generation, environment, timestamp, and typed error. The route uses an accessible description list rather
than production test-only attributes. Restoring the old hybrid join makes both the central projection and
route fixture fail because B becomes A or disappears.

Independent focused evidence:

- App exact affected files: 3 files / 31 tests passed.
- App production typecheck and checked P2-test typecheck passed.
- Scoped Prettier and Oxlint passed with zero warnings/errors; `git diff --check` passed.
- Checked fixtures contain no `as any`, `as never`, suppression, or fabricated non-null public state.

Therefore `3.3`, `3.4`, and focused-review gate `3.6` are closed. Manager-only multi-environment and Context
Matrix walkthroughs `6.9/6.11` remain open; no broad-gate or browser-acceptance claim is made.

### P3 research boundary: 2026-07-24 Asia/Shanghai

No manager decision loopback is required. P3 is split into four independently reviewed atoms:

```text
P3-A  Server per-instance ledger + early admission + typed lifecycle transport
P3-B  App locator-scoped reconnect/rejoin projection
P3-C  Inspector lifecycle rendering + invalidation-driven Store/Context pulls
P3-D  Terra focused Vitest/basic component Playwright preparation evidence
```

P3-A starts alone. `createServer` owns one `StoreMutationService` and injects it into HTTP/WS Context;
Router module-global ownership is removed. Operation fields are decoded before admission. `start` returns
or rejoins `accepted` before terminal settlement, publishes `accepted -> running -> one terminal`, dedupes
one `requestId` to one CLI spawn, and invalidates Store/Context before terminal publication. The ledger is
process-local, has no persistence/Cancel/retry, and never becomes Store inventory truth.

The checked real-transport fixed point uses `startServer`, HTTP tRPC, WS subscription, and a delayed Node
CLI child. Before releasing that child, HTTP must already return `accepted` and WS must observe
`accepted -> running`; duplicate start writes one spawn marker. After release, invalidation precedes exactly
one terminal record. Restoring terminal-await, removing transition publication, or deleting dedup must make
that same fixture fail. Only the mutation runtime decoder portion of `5.1` may move forward with P3-A;
health, Store inventory, and Root decoders remain P4 work.

### P3-A first candidate rejected: 2026-07-24 Asia/Shanghai

Reviewed candidate: `0d6a36b`.

The candidate establishes the intended per-Server service, early admission, request-id ownership,
mutation-only schemas, HTTP/WS injection, pre-admission operation validation, invalidation-before-terminal
ordering, and a delayed real CLI transport fixture. These are useful implementation facts, but they do not
close `4.1--4.3`: the public consumer contract, lost-terminal state machine, and checked evidence boundary
are not yet sound.

```text
HTTP start response                     Lost-terminal transition
-------------------                     ------------------------
mutation fields + rejoined              accepted  -- forbidden --> indeterminate
        |                               running   -- server loss -> indeterminate
        +-- existing App remains usable              |
                                                    +-- late CLI result is ignored
```

Independent review rejected the candidate for five exact reasons:

1. `stores.mutate` changed from the flat mutation record consumed by the current App to
   `{ record, rejoined }`. P3-A may add `rejoined`, but it must preserve the flat record shape as
   `{ ...record, rejoined }`; changing App decoding belongs to P3-B and cannot be used to hide this
   regression.
2. `markIndeterminate()` can settle an operation while it is only `accepted`, which suppresses the queued
   CLI start and fabricates lost terminal truth. A Server-only loss transition must require an actually
   `running` admitted operation. An accepted-phase attempt must reject or no-op without preventing the CLI;
   a late real result after a valid running-phase loss still publishes no second terminal.
3. The checked Server transport lane currently fails with 15 TypeScript errors: ES2022 has no
   `Promise.withResolvers`, and the untyped Router `observable(...)` makes lifecycle `onData` values
   `unknown`. The public subscription must carry the explicit lifecycle event type, and fixtures must use
   an ES2022-compatible deferred helper.
4. Core's mutation protocol fixture is excluded from the standard
   `pnpm --filter @openspecui/core typecheck` command. The narrow config must be part of that standard
   package lane. Server transport evidence likewise remains in the standard Server typecheck path.
5. Exit-zero contract drift is only hand-authored at the service layer. The delayed real CLI must exit 0
   with a malformed Store payload and prove `CLIExecutor -> Router -> HTTP/WS -> exactly one failed`
   while retaining `contractError`, diagnostics, stdout/stderr, payload, and exit status.

Candidate mutation-resistance results, recorded as worker evidence pending corrected independent rerun:

- restoring terminal-await made both real service/router transport tests time out at 5000 ms; the
  early-admission case stopped before writing its release file; restoration returned `2/2` green;
- reordering invalidation made the ordering assertion fail;
- removing `running` publication made the lifecycle assertion fail;
- bypassing request-id deduplication produced two CLI spawns;
- bypassing active/settled retirement published `indeterminate -> succeeded`.

The correction must retain those exact-owner checks, add the real exit-zero malformed-payload case, and
make both package-standard typechecks green. No P3 checkpoint is checked, and P3-B/P3-C/P3-D, P4, broad
gates, PR delivery, archive, merge, release, and browser walkthrough remain outside this correction.

### P3-A final focused acceptance: 2026-07-24 Asia/Shanghai

Accepted correction commit: `915de0b` after initial candidate `0d6a36b` and review record `993e00e`.

The public start response is flat `{ ...StoreMutation, rejoined }`, so the existing App still receives
`status` while a repeated request id exposes rejoin truth. Rejoin returns the operation's current record;
it does not force a running operation back to accepted. Server ownership is explicitly
`accepted | running | settled`. A loss report during accepted is a no-op and cannot suppress the queued
CLI; only a running operation can become indeterminate, and its late real result cannot publish a second
terminal.

The real transport fixture now crosses `startServer -> CLIExecutor -> Router -> HTTP + WebSocket` with a
delayed configured CLI runner. It proves flat early admission, accepted/running ordering, one spawn after
rejoin, Store/Context invalidation before one terminal, pre-admission rejection with no record, and a real
exit-zero malformed Store payload becoming one failed terminal while retaining exit 0, raw stdout/stderr,
diagnostics, raw payload, and `contractError`.

Worker mutation-resistance evidence, each restored before the accepted commit:

- terminal-await timed out the early-admission fixture before release;
- removing running publication timed out the lifecycle assertion;
- bypassing deduplication wrote two spawn markers;
- publishing terminal before invalidation exposed `terminalInvalidationObserved=false`;
- bypassing settled retirement published `indeterminate -> succeeded`;
- weakening the accepted/running loss guard converted accepted into indeterminate.

Independent main-agent rerun:

- Core focused: 2 files / 11 tests passed.
- Server focused: 3 files / 16 tests passed.
- Core standard typecheck, Server standard typecheck, and Server transport typecheck passed.
- Scoped Oxlint reported zero warnings/errors; Prettier, commit diff check, and strict Change validation
  passed.

Independent Terra source/test review accepted `4.1--4.3` at exact HEAD `915de0b`: Core 11/11, Server
16/16, Core and Server transport checked lanes, scoped Oxlint/Prettier, and commit diff checks passed. Terra
did not independently replay the destructive mutants; their red results remain worker evidence accepted by
the main source review. Broad gates and all browser acceptance remain deliberately unrun. The Vite+ staged
hook still lacks repository configuration; the worker used `--no-verify` only after the focused checks.

### P3-B research boundary: 2026-07-24 Asia/Shanghai

P3-B owns only the App's backend-locator mutation observation kernel and mutation admission decoding. One
normalized locator owns one tRPC WebSocket subscription even when multiple tabs point to it. The transport
reads only that locator's in-memory Gate credential, runtime-decodes every lifecycle event, and exposes a
process-memory snapshot suitable for later Store UI composition.

```text
retained App tabs -- normalize/dedupe --> locator owner --> tRPC WS lifecycle stream
                                                |
                                                +-- snapshot replaces process ledger
                                                +-- changed advances cursor/record
                                                +-- reconnect retains display-only evidence

HTTP mutation start --> flat runtime decoder --> accepted/rejoined OR concrete request error
```

Connection callbacks are valid only for the current locator epoch. `connecting`, `pending`, transport
error, stop, and complete make retained records non-current; only a newly decoded snapshot makes them
current again. That snapshot replaces prior records, including with an empty list, because Server records
are process-local and disappear on restart. Changed-before-snapshot, non-monotonic cursor, malformed data,
retired callbacks, or another locator can never relabel or publish into the current ledger.

P3-B adds no persisted mutation database, UI lifecycle rendering, Store/Context refresh, Cancel, mutation
retry, or browser walkthrough. P3-C will consume the owner in Store Inspector and perform terminal-driven
invalidation pulls; P3-D will add focused component preparation evidence. `4.4--4.7` therefore remain open.

### P3-B first candidate rejected: 2026-07-24 Asia/Shanghai

Reviewed candidate: `f48d854`.

The candidate establishes the locator-deduplicated owner, snapshot/cursor/reconnect/epoch state machine,
flat admission decoder, typed request/contract errors, React provider, Core browser subpath, and a real
guarded Server-to-App WebSocket fixture. Independent main and Terra reruns passed App `17/17`, Core `2/2`,
Server `3/3`, App standard plus checked P3-B typecheck, scoped lint/format/diff, and strict Change
validation. Those green results do not yet close the internal P3-B package.

Independent source review rejected the candidate for two exact boundary gaps:

1. Production uses `TRPCUntypedClient` and the string `stores.subscribeMutations`. Runtime event decoding
   is correct, but a procedure rename or input/output drift bypasses compile-time Router evidence. The
   production module must use a type-only `AppRouter` import and the typed tRPC client while retaining the
   Core runtime decoder and no Server runtime import.
2. The controlled two-locator fixture proves transport deduplication and record isolation but carries no
   credentials. The real guarded fixture proves missing/wrong/matching credentials only for one locator in
   sequence. It therefore cannot detect a global/latest-credential implementation that passes all current
   cases. Add one checked A+B fixture with distinct simultaneous credentials and ledgers; borrowing either
   credential must reject only the mismatched locator. Resolve the credential inside `connectionParams`
   for each handshake so reconnect cannot retain an obsolete captured value.

The worker-recorded destructive mutations for deduplication, credential lookup, snapshot replacement, and
epoch retirement remain useful pending the corrected exact fixture. No checkpoint changes: P3-C/P3-D,
`4.4--4.7`, broad gates, browser acceptance, PR delivery, merge, archive, and release remain open.

### P3-B final focused acceptance: 2026-07-24 Asia/Shanghai

Accepted production commit `f48d854` plus correction `c5eb44d`; rejection evidence is recorded in
`1c59a95`.

The App now owns one process-memory mutation observation projection per normalized backend locator. Its
public snapshot carries revision plus locator, owner epoch, lifecycle, current authority, cursor, records,
error, and observation time. Initial/reconnect snapshots replace the complete process-local ledger;
strictly advancing changes replace one request-id record. Connection/error/terminal states retain records
as display-only evidence, and every retired locator epoch callback is inert.

Production uses the typed `AppRouter` tRPC subscription with a type-only Server import, then runtime-decodes
every event through the Core browser-safe schema. `connectionParams` resolves only that locator's current
in-memory credential on every handshake. HTTP mutation admission separately decodes the flat
`StoreMutationStartResponse`; request/auth/validation and contract failures throw typed errors and never
synthesize mutation records or `indeterminate` outcomes.

Focused evidence accepted by main and independently by Terra at `c5eb44d`:

- App direct files: 3 files / 18 tests passed; Core protocol: 1 / 2; Server ledger transport: 1 / 3.
- App standard typecheck, including the checked P3-B lane, passed.
- Scoped Oxlint reported zero warnings/errors; Prettier, commit diff check, and strict Change validation
  passed.
- The real A+B guarded fixture proves one transport for duplicate A tabs, distinct credentials and ledgers,
  then rejects a borrowed A credential during B reconnect while A remains current and uncontaminated.

Worker mutation-resistance evidence, restored before the accepted commits:

- removing locator deduplication created a second A transport;
- bypassing locator credential lookup timed out the guarded A snapshot in the strengthened A+B fixture;
- merging rather than replacing a reconnect snapshot retained A after an empty B snapshot;
- bypassing epoch retirement let a removed A callback overwrite the replacement ledger.

P3-B is an accepted internal package only. P3-C must compose this owner into Store Inspector and perform
terminal-driven Store/Context pulls; P3-D owns component preparation evidence. Therefore `4.4--4.7` remain
open, and no broad-gate, browser-acceptance, PR, merge, archive, or release claim is made.

### P3-C research boundary: 2026-07-24 Asia/Shanghai

P3-C owns the production join between the accepted P3-B locator ledger and the real Store Inspector
controls. It does not change Server lifecycle semantics or put lifecycle records back into Store inventory.
The existing `store-inspector.tsx` already carries five orthogonal intents, so lifecycle classification,
terminal-edge bookkeeping, and presentation must live in focused physical modules rather than enlarging
that route into a second state kernel.

```text
real form/dialog submit -- exact authority --> HTTP admission
        |                                      |
        | rejected ----------------------------+--> typed error; keep repair UI; no record
        |
        + accepted --> locator ledger --> running --> terminal
                              |                      |
                              | display-only while  +--> once: Store pull + matching Context refresh
                              | disconnected
                              +--> active/recent evidence in Store Inspector
```

The lifecycle composer baselines an initial current snapshot so historical terminal records do not cause
mount-time refresh storms. It then recognizes each newly observed transition into
`succeeded | failed | indeterminate` exactly once. Retained records remain visible through connecting,
pending, reconnecting, error, stopped, complete, and contract-error states, but a non-current projection
cannot emit a fresh terminal settlement. A reconnect snapshot may settle a request that was previously
observed as accepted/running; that replacement current snapshot must emit the terminal once. All retained
tabs for the exact normalized locator receive a Context refresh; other locators are untouched.

The HTTP start response is admission evidence, never completion evidence. Setup, register, unregister, and
remove remain pending until their request id is observed in the Server ledger. A rejected auth, validation,
HTTP, or contract request shows its concrete error without synthesizing `indeterminate`. In particular the
Remove dialog stays open with its confirmation/repair path after rejection, stays bound to its captured
authority, and closes automatically only after an observed `succeeded` terminal. Failed or indeterminate
terminals remain visible evidence and do not imply retry or cancellation.

P3-C evidence must cover the production lifecycle composer and the real Remove form behavior. Removing the
terminal-edge gate must expose premature/repeated pulls; restoring the current HTTP-admission refresh must
expose a pull before terminal; and turning a typed rejected request into a record or dialog close must fail
the named case. Tests must be compile-checked and must not use fake buttons, manually call a downstream
handler in place of the real form submit, or add production-only test instrumentation. P3-C runs only its
focused App tests, checked test lane, scoped format/lint/diff, and strict Change validation. P3-D, broad
gates, owner browser walkthroughs, PR delivery, merge, archive, and release remain outside this slice.

### P3-C first candidate rejected: 2026-07-24 Asia/Shanghai

Reviewed candidate: `3e18654`.

The candidate correctly separates Store inventory from lifecycle evidence, removes admission-time pulls,
renders retained active/recent/connection evidence, keeps HTTP rejection repairable, and closes Remove only
from a matching succeeded ledger record. Independent focused rerun passed App `25/25`, App standard plus
P3-B/P3-C checked typechecks, scoped Oxlint/Prettier/diff, and strict Change validation. Those green results
do not close P3-C because the composer loses one production-valid settlement window:

```text
route mounts while ledger has no current snapshot
        |
HTTP admission accepts a new request
        |
first current ledger snapshot already contains its terminal record
        |
composer treats every terminal as historical baseline -> no Store/Context pull
```

The distinction cannot come from `baselined` alone. The Store surface must correlate the admitted request id
with its exact normalized locator through the real dispatcher. HTTP response delivery and the WebSocket
snapshot have no cross-transport ordering guarantee: correlation must work both when admission becomes
visible before the first current snapshot and when the first current snapshot already contains terminal R
before the admission Promise resumes. Unrelated terminal history remains baseline-only. Accepted/running to
terminal, terminal first seen after baseline, disconnect/rejoin, duplicate emission, route locator change,
and admission rejection must all preserve one terminal-driven pull and no fabricated record. Pending ids
from locator A must never settle from B; retired/unmounted composition must not publish late work.

The correction may keep the accepted HTTP record only as correlation evidence; it must not render it into
the Server ledger, refresh, close Remove, or invent terminal status. The real setup/register/unregister and
Remove dispatch paths must call the same registration owner. Add checked red cases for both HTTP-first and
WebSocket-first terminal correlation, and show that deleting the correlation transition makes them fail.
Preserve the accepted evidence and mutations already recorded for `3e18654`. P3-C/P3-D, `4.4--4.7`, broad
gates, browser acceptance, PR delivery, merge, archive, and release remain open.

### P3-C second review correction: 2026-07-25 Asia/Shanghai

Independent review accepts the request-id + normalized-locator correlation added by `c8bf256` as the right
answer for the two legal HTTP/WebSocket orderings, but finds one remaining lifecycle boundary in its React
owner. `useStoreMutationLifecycle` has a raw `apiBaseUrl` layout-effect dependency and cleanup:

```text
pending R at normalized A
        |
raw A -> raw A/ rerender (same normalized locator)
        |
old layout cleanup: setLocator(null) -> clears pending R
        |
new layout setup: setLocator(A) -> terminal R is historical again
```

Normal App ingress currently canonicalizes launch, persisted, and manual URLs, but
`applyHostedLaunchRequest` remains a raw-input internal boundary. The hook must therefore derive and depend
on canonical locator identity before its layout effect instead of relying on all callers forever preserving
that invariant. Equivalent raw formatting is a no-op and retains pending correlation; invalid/absent input,
a changed normalized locator, and unmount still retire it. The proof must mount the real hook/provider,
admit R, execute the equivalent raw rerender, then emit current terminal R. It must fail when the raw
cleanup path is restored and pass only with one Store pull plus one exact-locator Context pull. This is still
P3-C only: no checkpoint closes, and P3-D, broad gates, owner browser walkthroughs, PR delivery, merge,
archive, and release remain outside the correction.

### 7.3 old Change partial archive: 2026-07-24 Asia/Shanghai

The manager confirmed the documented supersession boundary. Strict validation of
`close-openspec-cli16-delivery-gaps` passed before the archive. The old Change's planning artifacts were
complete, its corrected checkpoint state was `106/131`, and its 25 unresolved items remained mapped by the
archived `loop/supersession.md`; no item was rewritten as complete.

`openspec archive target-openspec-cli-16-line -y --skip-specs` reported the intentional incomplete-task
warning, skipped no delta-spec synchronization, and moved the Change to
`openspec/changes/archive/2026-07-24-target-openspec-cli-16-line/`. Archive closes the former active
planning folder only. P3--P5, focused/full gates, manager walkthroughs, protected merge, and release remain
open in this successor.
