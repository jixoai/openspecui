<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Specify opaque hosted environment identity and full Access Gate admission.
2. Specify credential-scoped connection reachability and explicit App environment selection.
3. Specify the observable backend-owned Store mutation lifecycle.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
-->

# hosted-environment-delivery Delta Specification

## ADDED Requirements

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

### Requirement: Credential-Scoped Reachability and Explicit Environment Selection

The App SHALL retain backend locators without credentials and hold any launch credential only in session
memory associated with its normalized API locator. A protected reachable backend that returns 401 or 403
SHALL be represented as `authentication-required`, not `offline`, current, or unsupported. Environment-
scoped operations SHALL require an explicitly selected current online backend and SHALL NOT fall back to
the first online connection. The App SHALL observe Root Context only for currently connected,
protocol-compatible backend entries and SHALL remain an observed-only, non-machine-wide projection.

#### Scenario: Launch credential reaches only its intended backend

- **GIVEN** an App launch URL supplies an API locator and credential fragment
- **WHEN** the App consumes and strips the fragment
- **THEN** it SHALL associate the credential only with that normalized locator in session memory
- **AND** health, HTTP RPC, and WebSocket traffic to that locator SHALL send it
- **AND** persisted tabs, URL query state, logs, and other backend locators SHALL NOT receive it

#### Scenario: Two online connections require an explicit operation target

- **GIVEN** backend A and backend B are online
- **WHEN** B is selected for an environment-scoped Store operation
- **THEN** the operation SHALL target B even when A appears first in connection order
- **AND** without a selected current online backend the operation SHALL remain unavailable
- **AND** Context Matrix SHALL group only the observed current Root/Reference facts from connected backends

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
