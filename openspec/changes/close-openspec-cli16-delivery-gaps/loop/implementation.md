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

| Order | Package | State | Production owner | Required focused proof before next package |
| --- | --- | --- | --- | --- |
| 1 | P1 Hosted identity + Gate | Partial; browser delivery correction open | Core hosted contract; Server bootstrap and tRPC WS context; CLI/App/Web credential handoff | Existing Server admission/identity proof plus real gated Direct/App Project Web HTTP RPC, subscription, and PTY proof. |
| 2 | P2 Connection selection + Context Matrix | Candidate rejected; correction open | App credential registry, reachability, selected tab generation, Environment Center / Context Matrix | Exact tab/generation action guard plus source-labelled Root error and two-source Reference provenance. |
| 3 | P3 Store mutation ledger | Not started | Server StoreMutationService/router; App operation subscription and Inspector | Delayed real CLI fixture observes accepted then running before terminal; denied pre-start call creates no mutation; removing transition publication fails. |
| 4 | P4 Typed/static/reactive repair | Not started | Core schemas; App decoder; static provider; Server reactive Git stamp; affected tests | Malformed envelope cannot become current; static has no fabricated live evidence; removing physical/reactive settlement fails; all changed TS/TSX headers/types are valid. |
| 5 | P5 Delivery recovery + acceptance | Blocked on P1--P4 and independent loading regression | Loading-change owner; reviewer; manager | Exact server emission failures are green in their own Change, then one complete local gate run and manager walkthrough ledger. |

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
