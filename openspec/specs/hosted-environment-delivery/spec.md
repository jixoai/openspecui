<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Specify opaque hosted environment identity and full inherited Access Gate admission.
2. Specify credential-scoped connection reachability and explicit App environment selection.
3. Specify the observable backend-owned Store mutation lifecycle.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
Review correction (2026-07-24): A protected parent must not spawn an unprotected worktree backend, and a browser resource request must not borrow another client credential.
Review correction (2026-07-24): Retained Root evidence keeps the identity that produced it; a new pending generation cannot relabel old evidence or combine with a replacement tab identity.
Review correction (2026-07-24): Production worker kinds must not claim each other's payloads, and browser evidence must cross the CLI start-command target owner.
-->

# hosted-environment-delivery Specification

## Purpose

Define opaque hosted environment identity, complete Access Gate admission, explicit App operation targeting, and
the observable backend-owned Store mutation lifecycle.

## Requirements

### Requirement: Opaque Environment Identity and Complete Access-Gate Admission

The system SHALL issue one opaque `envUri` from a stable backend-host identity plus effective OpenSpec
data home. Project path, API port, and backend process lifetime MUST NOT affect this identity. Health,
Store-operation records, and App grouping SHALL consume the Server-issued value. When an Access Gate is
configured, every advertised HTTP and WebSocket procedure/subscription surface SHALL reject missing or
invalid credentials before application procedure execution; the unguarded configuration SHALL remain
pass-through.

#### Scenario: Same environment projects share one identity without exposing inputs

- **GIVEN** two backend projects run on the same host with the same effective OpenSpec data home
- **WHEN** each publishes health or a Store mutation record
- **THEN** they SHALL carry the same opaque `envUri`
- **AND** the URI SHALL expose neither host identity nor data-home/project path
- **AND** changing host identity or effective data home SHALL produce a distinct URI

#### Scenario: Gated WebSocket is rejected before a subscription runs

- **GIVEN** a backend has an Access Gate
- **WHEN** a WebSocket client connects with missing or invalid connection credentials
- **THEN** the system SHALL reject it before any application procedure or subscription observes a context
- **AND** a valid connection-parameter or supported non-browser Authorization credential SHALL proceed
- **AND** a reconnect SHALL repeat the same admission rule
- **AND** a worktree backend spawned by that protected backend SHALL inherit the same Access Gate policy
- **AND** parent readiness checks SHALL authenticate to that child rather than weakening child admission
- **AND** a Project Web handoff to that child SHALL transfer the current in-memory credential only through
  the target child fragment, which the child SHALL consume and remove before rendering
- **AND** the handoff payload, query state, storage, and logs SHALL remain credential-free

#### Scenario: Worktree and translation workers cannot claim each other's payloads

- **GIVEN** the shipped runtime contains more than one worker protocol
- **WHEN** a worktree Server worker receives its typed launch payload
- **THEN** only the worktree worker owner SHALL consume and validate it
- **AND** unrelated worker handlers SHALL NOT reject, mutate, or execute that payload
- **AND** the real worker SHALL start a child Server whose health rejects missing Gate credentials and
  accepts the inherited parent Gate

### Requirement: Credential-Scoped Reachability and Explicit Environment Selection

The App SHALL retain backend locators without credentials and hold any launch credential only in session memory
associated with its normalized API locator. A protected reachable backend that returns 401 or 403 SHALL be
represented as `authentication-required`, not `offline`, current, or unsupported. Store reads and operations SHALL
require an explicitly selected backend-issued Environment identity and an internally resolved exact current online
source observation from that same `envUri` and generation. The App SHALL NOT select the first Environment, cross an
Environment identity, fall back to a same-locator retired tab, or expose backend URL selection as the normal Store
product interaction. The App SHALL observe Root Context only for currently connected, protocol-compatible backend
entries, preserve typed source-labelled errors and Reference provenance, and remain an observed-only,
non-machine-wide projection.

#### Scenario: Two online connections require an explicit operation target

- **GIVEN** backend A and backend B are online
- **WHEN** B is selected for an environment-scoped Store operation
- **THEN** the operation SHALL target B even when A appears first in connection order
- **AND** without a selected current online backend the operation SHALL remain unavailable
- **AND** replacing B with another tab or generation at the same locator SHALL retire the prior authority
- **AND** a Root refresh or transport failure SHALL keep retained evidence explicitly stale until a
  replacement Root emission commits
- **AND** retained Root and Reference evidence SHALL preserve the observation generation, backend-issued
  `envUri`, health source, and observation time that produced it; a pending generation SHALL NOT relabel it
- **AND** Reference warnings SHALL remain visible upstream evidence rather than being rewritten as healthy
- **AND** duplicate tabs for one backend/project locator SHALL remain authority-distinct while counting as
  one connected project in environment-level grouping

#### Scenario: Launch credential reaches only its intended backend

- **GIVEN** an App launch URL supplies an API locator and credential fragment
- **WHEN** the App consumes and strips the fragment
- **THEN** it SHALL associate the credential only with that normalized locator in session memory
- **AND** Direct Web or the matching App iframe SHALL consume and remove the fragment before rendering
- **AND** the static Project Web shell MAY load without data authority while protected HTTP RPC, WebSocket, PTY,
  file, and notification traffic SHALL supply the same credential from one in-memory owner
- **AND** a browser resource bridge SHALL accept a credential only from the initiating client and SHALL NOT fall
  back to another open window or tab
- **AND** persisted candidates, open-Workspace presentation, route state, logs, and other backend locators SHALL
  NOT receive it

#### Scenario: Multiple Environments require an explicit Store scope

- **GIVEN** more than one current Environment is observed
- **WHEN** no valid Environment is selected for Stores
- **THEN** the App SHALL require an explicit Environment choice
- **AND** SHALL NOT choose the first Environment or derive identity from URL, path, port, or process lifetime
- **AND** selecting one Environment SHALL keep same-id Stores in other Environments separate

#### Scenario: One Environment has multiple current backend sources

- **GIVEN** backend A and backend B publish the same `envUri` and current compatible observations
- **WHEN** that Environment is selected for Store inspection
- **THEN** the Environment authority owner SHALL retain one deterministic exact source while it remains current
- **AND** MAY resolve another current source in the same Environment only before an action draft is pinned
- **AND** every Store read SHALL preserve the exact source that produced its evidence
- **AND** every Store action SHALL pin full tab, session, creation, locator, Environment, and generation identity
- **AND** the existing synchronous dispatch owner SHALL revalidate that full authority
- **AND** no backend URL selector SHALL be required in the normal Store UI

#### Scenario: Same-Environment sources disagree

- **GIVEN** multiple current sources carrying one `envUri` have independently settled non-equivalent Store
  identity, root, or Doctor evidence
- **WHEN** the App composes the Environment Store projection
- **THEN** it SHALL preserve each source-labelled result and expose a direct conflict
- **AND** SHALL NOT silently choose conflicting evidence, merge it, or rewrite it as healthy, offline, or unknown
- **AND** affected Store mutations SHALL remain unavailable until objective current evidence converges

#### Scenario: Same-identity tab replacement cannot form hybrid authority

- **GIVEN** an Environment-selected source A has current observation and a Store action draft
- **AND** App state replaces it with another tab using the same id and locator but a different session or creation
  identity
- **WHEN** the operation is attempted before the replacement observation commits
- **THEN** the action SHALL have no current authority
- **AND** it SHALL NOT combine A's observation generation with the replacement tab's identity
- **AND** another current source in the Environment SHALL NOT substitute for the already-pinned draft

#### Scenario: Refresh retains evidence without rewriting its source

- **GIVEN** generation A produced Root, Reference, Store, or content evidence for Environment A
- **WHEN** generation B starts, fails, or reports a different backend-issued Environment identity before replacement
  data commits
- **THEN** A's evidence MAY remain visible only as stale display evidence
- **AND** its generation, Environment identity, health source, and observation time SHALL remain those of A
- **AND** B alone MAY authorize new current work after its own observation commits
- **AND** Reference warnings SHALL remain visible upstream evidence rather than being rewritten as healthy

#### Scenario: Duplicate tabs remain authority-distinct

- **GIVEN** duplicate tabs address one backend/project locator
- **WHEN** Environment and Usage projections compose them
- **THEN** they SHALL remain full-identity-distinct for authority and retained evidence
- **AND** MAY count as one connected project only in explicitly deduplicated Environment-level presentation

### Requirement: Observable Backend-Owned Store Mutation Lifecycle

The Server SHALL own Store mutation admission, request-id deduplication, lifecycle records, and terminal
evidence. An admitted mutation SHALL be observable as `accepted`, then `running`, then `succeeded`,
`failed`, or `indeterminate`; start callers SHALL NOT wait for terminal CLI settlement to observe the
first state. `indeterminate` SHALL mean only that terminal truth was lost after admission. Rejected or
malformed requests SHALL expose their concrete request error and SHALL NOT fabricate an operation record
or `indeterminate` result. Store inventory, Doctor, and Context remain separate invalidation-and-pull
projections rather than a client-owned operation database.

#### Scenario: Delayed mutation publishes nonterminal lifecycle

- **GIVEN** a Store CLI operation remains running after admission
- **WHEN** a caller starts it and a lifecycle observer joins by request id
- **THEN** both SHALL observe the admitted record before terminal settlement
- **AND** the observer SHALL receive `running` followed by exactly one terminal record
- **AND** a repeated start with that request id SHALL NOT start another CLI process

#### Scenario: Rejected destructive operation does not imply uncertain completion

- **GIVEN** a Store remove request is rejected before admission because credentials or validation are invalid
- **WHEN** the App renders its result
- **THEN** it SHALL show the concrete request error
- **AND** it SHALL NOT close or refresh as though deletion may have run
- **AND** it SHALL NOT report `indeterminate`

### Requirement: Environment-Scoped Store Content Projection

The Server SHALL expose demand-driven, typed Store-selected Spec and active-Change list Projection Work for the
hosted App. It SHALL call the official CLI contract with the explicit Store selector, publish data-free
invalidations, preserve complete command evidence, and keep Spec and Change regions independent.

#### Scenario: Store Detail requests content

- **GIVEN** one Store Detail has a selected `(envUri, Store id)` and exact current source
- **WHEN** it requests Specs or active Changes
- **THEN** the Server SHALL invoke the corresponding typed normal CLI list command with `--store <id>`
- **AND** SHALL preserve parsed data, raw payload and stdout, stderr, diagnostics, contract drift, success, exit
  status, Store identity, Environment identity, and source generation as separate facts
- **AND** SHALL NOT parse Store files or reparse typed executor stdout

#### Scenario: Store root changes

- **WHEN** reactive Store-root observation reports a relevant content change
- **THEN** the Server SHALL publish a data-free invalidation notice for the affected Store content identity
- **AND** the App SHALL Pull the current typed snapshot
- **AND** no App poller or client-owned operation database SHALL be introduced

#### Scenario: One content region fails

- **GIVEN** retained Spec and active-Change summaries are visible
- **WHEN** replacement Spec work fails while Change work remains healthy, or vice versa
- **THEN** the failed region SHALL retain and label its own source/error evidence
- **AND** the healthy sibling region SHALL remain settled and readable
- **AND** content failure SHALL NOT fabricate an empty Store or revoke unrelated Store evidence

#### Scenario: Stale content completion arrives

- **WHEN** content work for another Environment, Store id, content kind, or retired source generation completes
  after the selected Detail has changed
- **THEN** it SHALL NOT enter the current or retained Store Detail state
- **AND** Store id alone SHALL never be accepted as a sufficient work identity

#### Scenario: Backend does not support Store content projection

- **WHEN** a backend omits the additive Store-content compatibility fact
- **THEN** the App SHALL present the readonly content region as unsupported for that source
- **AND** SHALL NOT treat capability absence as an authorization denial or infer that the Store contains no Specs
  or Changes
