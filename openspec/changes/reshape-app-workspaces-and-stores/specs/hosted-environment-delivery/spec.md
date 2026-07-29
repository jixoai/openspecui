<!--
Orthogonal intents (created 2026-07-30 Asia/Shanghai):
1. Replace backend-tab Store selection with explicit Environment scope and internally exact authority.
2. Preserve credential isolation, source provenance, replacement-generation retirement, and observed-only Context.
3. Specify Store source conflict and demand-driven Store content projection through official CLI evidence.

Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西，就跟 Config 和 Context 的关系一样。"
Derived boundary (2026-07-30): Store UI identity is `(backend-issued envUri, Store id)`; backend locator is an internal current access authority.
-->

# Delta for hosted-environment-delivery

## MODIFIED Requirements

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

## ADDED Requirements

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
