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

As of 2026-07-23 Asia/Shanghai, this Change contains planning artifacts only. It has not changed
production, test, CSS, static-export, or dependency source. Review baseline is `24c313c...HEAD`.

The prior `target-openspec-cli-16-line` Change remains active at `109/131`, frozen as an evidence source;
it is neither merged nor archived. Its 22 unchecked delivery obligations are not checked here by assertion.
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

### P1 accepted candidate: 2026-07-24 Asia/Shanghai

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
rerun and source review. This execution deviation does not weaken the named public-boundary evidence and
does not claim final browser acceptance. Checkpoints `2.1`--`2.8` are accepted; P2 begins under a new Goal.

Residual facts retained for later packages:

- Renaming the operating-system hostname intentionally changes `envUri`.
- The PWA credential relay is a same-origin transient message, not persistence or transport
  confidentiality; the Access Gate remains a shared-secret guard rather than an account/permission model.
- App still selects the first online backend and Context Matrix still observes only that backend. Those are
  P2 defects, not P1 regressions.

### Execution ledger

| Order | Package | State | Production owner | Required focused proof before next package |
| --- | --- | --- | --- | --- |
| 1 | P1 Hosted identity + Gate | Accepted 2026-07-24 | Core hosted contract; Server bootstrap and tRPC WS context; App launch credential handoff | Real guarded HTTP/WS fixtures prove missing/invalid/reconnect rejection before router execution; exact same host/data-home URI equality; Store mutation receives issued URI. |
| 2 | P2 Connection selection + Context Matrix | Ready | App credential registry, reachability, selected environment, Environment Center / Context Matrix | Two-backend fixture proves per-locator credential isolation, `authentication-required`, explicit selection, all-online observed Context aggregation. |
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
6. The reviewer will not close the original Change merely to shrink context. Its migration is an evidence
   reconciliation performed only after the new Change's proof and gates are complete.

## Divergence Notes

- No implementation has started and no divergence from `research-plan.md` exists.
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
