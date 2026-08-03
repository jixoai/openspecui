# @openspecui/core

## 7.0.1

## 7.0.0

### Major Changes

- da5d080: Require OpenSpec CLI 1.7 for OpenSpecUI 7 and add the complete Agent delivery protocol, including the official registry, physical readiness and migration evidence, a live Config-owned Agent Integrations workbench, and a read-only Settings summary.

### Minor Changes

- da5d080: Sync the App theme preference to embedded Workspace windows. The App is the single theme master: when its theme changes, every open Workspace iframe is force-synced via postMessage, new child windows inherit the theme on first load via postMessage, and child-side theme changes never echo back. The iframe URL stays stable so theme changes never reload the iframe. The App-pushed theme takes priority over backend config.theme so reconnection cannot revert it.

## 6.2.1

## 6.2.0

### Minor Changes

- cbf7153: Replace the serve `[Y/n]` prompt with an interactive Direct Web / App Radio that remembers the chosen default in `~/.openspecui/settings.json`. Non-interactive sessions with no remembered preference now fall back to Direct Web and print a one-time hint explaining how to set a default with `--app` / `--web` or an interactive selection.

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

- 752addc: Add the local App daemon, OpenTray native presentation, Browser Web mode, and persistent multi-project Workspaces.

### Patch Changes

- 701bfe8: Default buffered OpenSpec commands to Worker execution, fall back to process only when the importable CLI JavaScript module is absent, publish the daemon-owned execution mode, and expose requested, effective, module, fallback, and lifecycle evidence through OpenTelemetry.
- ff2218a: Classify observation refresh procedures as readonly queries, preserve one absolute Dashboard auto-refresh deadline across visibility changes, keep Dashboard manual refresh independent from background Git work, stabilize Dashboard regional Pending geometry with fixed Historical Trends and independently scrolling compact Kanban lanes, curate the default Git activity window to five meaningful current-worktree rows, compute summary-only data for visible Other Worktrees, skip detached or unavailable hidden Git detail, propagate cancellation into Git subprocesses, and trace Projection Work queue admission separately from leaf execution. Also trace Planning-root lock queue/blocker timing with explicit sources and stacks, single-flight same-generation Root cache misses outside short generation-checked write commits, serialize buffered CLI execution at the real `CliExecutor` boundary, submit aggregate Status/Schema/Spec reads lazily, default buffered OpenSpec execution to Worker with process fallback only when its importable JavaScript module is absent, freeze and report daemon-managed execution policy across restart, and separate CLI admission, response, mode-specific process/Worker, and parent event-loop phase evidence without writing late events to ended spans.
- b1bd34f: Keep OpenSpec CLI 1.6.x as the OpenSpecUI 6.1 target line, accept 1.7.x as compatible without upgrade warnings, and block versions below 1.6 or at/above 1.8 by default.

## 6.0.1

### Patch Changes

- ec5fab4: Fix Windows CLI runner resolution failing with ENOENT on npm-global extension-less shims.

  On Windows, `where openspec` returns the npm-global extension-less Unix shim first, but Node
  `spawn({ shell: false })` cannot execute it, so every CLI probe failed with `ENOENT` and
  OpenSpecUI could not start (#209). Replace `node:child_process` `spawn` with `cross-spawn`, which
  resolves `PATHEXT` (`openspec.cmd`) while keeping `shell:false` and the existing security model.
  Also prefer the `PATHEXT`-matching entry in `where` output so the resolved path is the real
  executable. Fixes #209.

## 6.0.0

### Major Changes

- ccd72af: Migrate Dashboard Summary live delivery to a version-2 data-free invalidation
  and identity/generation-correlated retained/current pull contract, and unify
  Web realtime loading, revalidation, and command-activity presentation.

  The Summary subscription no longer publishes business snapshot payloads. The
  Server issues an opaque identity, work generation, and cause; the Web adapter
  pulls the retained or current Summary and accepts it only when it still matches
  the active wake-up. Fresh browser Documents can render bounded Server-retained
  data as display-only while matching current work converges. Web routes retain
  readable content during revalidation, use stable local skeleton geometry for
  first loads, and preserve command labels while actions are pending. Trends,
  Git, and Changes retain their existing transport contracts.

  Live Project Web now settles protected health admission before importing its
  ordinary transports, while clean static export resolves the hashed SSG server
  entry through Vite's manifest. Authentication rejection becomes an explicit
  terminal document instead of an indefinite loading/retry loop.

  Effective OpenSpec data-home observation now settles initially missing Store,
  Workset, and Schema targets from bounded ancestor creation events without
  introducing generic missing-path polling.

  CLI startup now emits a host-neutral Direct Web or hosted App presentation
  request. The Browser adapter owns private URL materialization today, while a
  future native host can present the same backend intent without impersonating a
  browser opener. Successfully forwarded browser and PWA launch sources retire
  best-effort so the existing App surface can remain foreground.

  Static export now generates a publication-safe Context route from redacted
  snapshot root and Reference-policy metadata, without synthesizing live CLI or
  environment evidence. Shared list skeletons use an explicit physical row
  separator across Web and App loading surfaces. Static document bootstrap data,
  base paths, and titles now cross a context-aware HTML encoding boundary so
  source previews cannot escape into visible or executable document markup.

- 8b81f7d: Target the OpenSpec CLI 1.6.x line with OpenSpecUI 6.x.

  OpenSpecUI keeps the strict major-to-minor version law: OpenSpecUI 6.x targets
  OpenSpec CLI 1.6.x, accepts 1.5.x as the immediately previous legacy-compatible
  line, and rejects older or forward CLI lines by default.
  - Preserve typed CLI JSON, stdout, stderr, diagnostics, resolved root provenance,
    and exit status for workflow, Store, Context, Doctor, validate, and archive
    commands.
  - Complete the 1.6 workflow/tool contract with `update`, the 1.4 `sync` baseline,
    Oh My Pi, and Trae command delivery.
  - Follow strict validate/archive failures without implicit validation bypass or
    synthesized scenario merges.
  - Preserve empty healthy Stores and multiline Requirement bodies according to
    the pinned OpenSpec 1.6 contracts.
  - Add one typed, reactive Root Context contract across Core, Server, and Web for
    launch-project, CLI-selected planning-root, Reference, command-evidence, and
    inherited data-scope facts.
  - Bind project document, OPSX, search, dashboard, and preview services to the
    CLI-selected planning root instead of the launch directory.
  - Preserve one typed workflow target and command-specific Status/Instructions
    evidence through hooks, Server, tRPC, and Web Compose, including explicit
    Store selectors, resolved artifact outputs, action context, References, and
    process diagnostics.
  - Bind Agent prompts to the CLI-selected planning root and raw CLI-resolved
    paths, explicitly prohibit launch-project path reconstruction, and retain the
    same Store selector across OPSX command and direct CLI modes.
  - Replace workflow hook v1 with root-explicit `OnRunWorkflowHookV2`; document
    hooks remain independently versioned at v1 and no workflow compatibility
    alias is retained.
  - Lock root-dependent Compose, Propose, New, Verify, Change, terminal dispatch,
    and Archive actions during Root Context loading, refresh, and failure while
    preserving CLI-owned failed-attempt evidence.
  - Separate OpenSpec configuration contracts into launch-project Project
    Binding, CLI-selected Active Root Config, and Environment Global Config;
    remove the ambiguous project/global config RPC aliases.
  - Add explicit Code and distinct Planning Git repository scopes across status,
    history, detail, patch, refresh, worktree removal, handoff, URLs, and cache
    keys. Repository identity uses canonical worktree top-level and common-dir
    facts, so nested roots in one worktree do not create a false second scope.
  - Require every terminal creation to select Launch Project or current Planning
    Root, resolve absolute cwd only on the backend, preserve cwd identity across
    reconnect/restore, inherit the same backend environment for both targets, and
    reveal a successfully created Agent session in the area that owns Terminal.
  - Bound each PTY WebSocket client's output backlog and reconnect replay without
    terminating the Server-owned process, and coalesce browser output-activity
    projection updates so Agent output cannot starve the backend or React shell.
  - Spawn configured Agents directly from their executable and argument vector,
    and route Unix PTY input through an ordered, byte-bounded asynchronous file
    descriptor writer so canonical-line backpressure cannot starve the Server;
    Windows retains the native ConPTY writer.
  - Stamp Planning terminals with immutable Root generation provenance, keep Launch
    Agent PTYs valid Send targets, and route both through acknowledged,
    Server-revalidated workflow input.
  - Preserve the launch process OpenSpec data scope without project `.env`,
    `StoreRoot`, synthesized registry, registry overlay, or project configuration
    fields that could redirect `XDG_DATA_HOME`.
  - Route Spec, Change, task, archive, entity, artifact, schema, and active-config
    writes through one physical/reactive owner under the selected planning root.
    Reject lexical and observed symlink escapes, write disk before settling
    reactive file/directory state, and return only after subscribed projections
    can observe OpenSpecUI-owned writes.
  - Replace the single-project watcher pool with runtime-environment-owned,
    reference-counted dynamic observation roots. Existing reactive reads rebind
    when matching roots appear, overlapping roots choose the deepest owner, and
    Launch/Planning leases release deterministically during service teardown.
  - Observe the effective inherited OpenSpec data home and emit identity-only
    invalidation generations for Store, Workset, schema, and Context facets;
    affected subscriptions pull fresh CLI projections instead of receiving a
    competing copy of data-home truth.
  - Reconcile registered Store observation roots from successful typed
    `store list --json` results, acquiring, moving, and releasing leases as CLI
    truth changes while preserving the prior observed set on command failure.
  - Map normalized Launch and connected Planning root changes to identity-only
    project/context invalidations through one environment-local index, sharing
    registrations for the same canonical root and releasing them on teardown.
  - Invalidate server-owned OpenSpec mutation facets before buffered or streamed
    terminal/indeterminate outcomes reach clients, while leaving read-only and
    unknown commands free from inferred mutation claims.
  - Expose identity-only runtime invalidation pushes and make Store clients pull
    fresh CLI projections explicitly instead of receiving Store data in push
    frames.
  - Generalize Root Context, Store, Environment Global, OPSX, and Spec projections
    onto one lifecycle-only Push plus typed Pull contract. Retain settled CLI data
    as display-only during replacement, keep failed Work dependencies live for
    automatic recovery, and observe Environment Global config through the exact
    CLI-resolved XDG config path rather than unrelated project/data-home facets.
  - Coalesce duplicate invalidation pushes to each facet's latest generation and
    prevent slower stale Store pulls from replacing newer CLI projections.
  - Remove Store polling from healthy subscriptions and retain one bounded
    backend-owned fallback only for data-home, Store-root, or watcher observation
    gaps.
  - Make reactive runtime teardown idempotent and asynchronous so fallback checks,
    Store/Planning/data-home leases, path subscriptions, and physical watcher
    roots are fully released.
  - Map external registered-Store edits to Store/Context invalidation and prove
    two-client convergence across registry edits, concurrent settlements,
    reconnect, and root disappearance.
  - Replace generic task progress with formal tracked-artifact progress, grouped
    schema-document checklist analytics, and attributed Apply instruction
    progress. Tracked globs follow OpenSpec 1.6 selection/fallback semantics,
    `0/0` remains `no-tasks`, and divergent Apply counts stay visible without
    normalization. Every formal task retains its exact source file and file-local
    checkbox index so guarded mutations update the tracked artifact rather than a
    fixed `tasks.md`. Task writes use reactive file state, immediately refresh
    subscribed projections, and lock the active task control until settlement.
  - Replace bare Spec ids and RPCs with one Core-owned compound identity and
    source-aware Catalog/Document contract. Enumerate every Doctor-declared
    direct Reference through typed per-Store Spec list commands, retain partial
    failure evidence, and keep detail CLI-backed and read-only; routes, search
    records, caches, View Transitions, static providers, and SSG enumeration
    preserve full source identity.
  - Attribute Dashboard planning metrics to the CLI-selected root, expose its
    source, Store, and direct Reference evidence, and keep the Code Git snapshot
    distinct from an optional Planning repository. Workflow completion no longer
    implies archive readiness.
  - Keep the active Change list writable-Planning-root-only and derive its state
    from the full formal tracked-task phase, including an explicit `no-tasks`
    presentation that cannot become workflow or archive completion.
  - Preserve typed CLI Status/Instructions paths, action context, References, and
    explicit Store selection on Change detail. Archive now uses one Server-owned
    Root Context selection for strict validation and archive, retains multiline
    diagnostics, and never starts a synthesized validation-bypass retry. The
    legacy direct filesystem rename endpoint is removed so no public Archive path
    bypasses CLI evidence.
  - Replace generic `cli.execute` / arbitrary-command streaming RPCs with
    dedicated buffered and streamed OpenSpec argv procedures. Both reject Archive
    before `CliExecutor` starts, fixed global installation has its own route, and
    `archiveStrictStream` remains the only public application Archive mutation.
  - Serialize Planning-root replacement around one active service record. Root
    changes and disappearance retire obsolete watcher/invalidation leases,
    Kernel, hooks, Search, Dashboard, and preview state before callers observe a
    completed transition; final backend disposal remains idempotent.
  - Own every streamed CLI child through one settlement-aware handle. Cancellation
    requests SIGTERM, escalates to SIGKILL after a bounded grace period, and keeps
    the Planning-root lease until child close; backend disposal actively cancels
    attached streams and awaits settlement without depending on client detach.
  - Make each Web CLI queue item one exhaustive typed transport that derives its
    logical preview and subscription together, then replaces the preview with the
    backend-emitted effective command instead of accepting caller-authored argv as
    a second display truth.
  - Reject non-canonical filesystem-backed Spec and Change ids through one shared
    Core/Server guard before any read or mutation can escape its entity root.
    Entity-relative file and glob paths use the same boundary before OPSX queries,
    subscriptions, watcher dependencies, previews, or writes touch the filesystem.
  - Default the Spec Catalog to writable Owned entries and place direct
    Referenced Specs in a Store-grouped, visibly read-only sibling view while
    retaining compound routes for duplicate ids.
  - Scope live project Search to Active root by default and expose direct
    Referenced Specs through an explicit sibling scope. Shared engines filter
    source before scoring and limit, while Store-qualified live hits preserve
    compound identity. Current static snapshots remain Owned-only, so static
    Referenced Search is neutral-empty until the explicit 7.x export policy.
  - Make Settings a read-only projection of Root Context and Environment Global
    diagnostics, with launch-project tool detection and initialization state kept
    current through generation-safe reactive subscriptions.

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

- cdb2cb5: Static export now supports direct OpenSpec References and publication privacy.

  `ExportSnapshot.meta` is root-aware and privacy-safe: it carries `observedAt`,
  `projectName`, CLI-resolved `root` provenance, and `referencePolicy`. The absolute
  `meta.projectDir` is removed. `specs[].identity` is the compound `SpecIdentity`
  union (owned | referenced) so exported referenced Specs keep `(storeId, specId)`
  identity across routes, search, and the static catalog.

  `openspecui export` gains `--references <include|omit>`, required when the planning
  root declares effective References. `include` materializes direct Reference Specs
  through official `list --specs --store --json` / `show --type spec --store --json`
  (complete-or-fail, never transitive); `omit` records an explicit omission state.
  A single publication redaction boundary strips absolute paths, host identity, and
  gates the Git remote behind the explicit include policy.

  Referenced Specs hydrate in the static provider/search/SSG under their compound
  routes (`/specs/referenced/<storeId>/<specId>`), scoped to `referenced-specs`
  search, with an explicit omission error when absent.

### Minor Changes

- 5def094: Add an objective Kanban projection over exact tracked-task phases and structural archives.

  Core and Server now expose exact phase counts plus bounded recent archive summaries through the shared Dashboard Summary contract. Web adds an interactive `/board`, replaces Dashboard Workflow Progress with the callback-free `ReadonlyKanban`, and publishes the same readonly Board in static exports. The readonly projection uses its own container to select four, two, or one columns without horizontal scrolling. The live Board contains page overflow, uses one horizontal lane-grid scrollbar, and lets each lane body scroll vertically on its own. Apply and Archive remain explicit existing Operator flows; drag-to-archive only opens Archive, and stale Root or projection data cannot authorize commands.

### Patch Changes

- 95bc2b9: Accelerate live Dashboard and Changes projections with server-owned bounded Work,
  current/stale snapshot delivery, progressive Change rows, and demand-driven OPSX
  Status. Dashboard now admits first-screen Summary before secondary projections,
  and Changes renders its first row before aggregate workflow Status starts.
- e49ff53: Restore an OPSX-first information hierarchy across the Web interface. Root, Store, Reference,
  schema, source, and CLI provenance now use keyboard-accessible badges and collapsed evidence
  disclosures where they do not affect the current decision, while actions, stale authority,
  blockers, and failures remain directly visible.

  Root Context now carries the canonical physical Launch identity used to collapse redundant
  same-root presentation without changing CLI or PTY ownership.

  Terminal chrome now scopes neutral text, surfaces, and borders to the active Terminal palette,
  preserving accessible contrast when the application and Terminal themes differ.

  Config now owns the canonical Resolved Context entry at `/config/context`. Live, static, Settings,
  Dashboard, and notification entry points share that route while root authority and failures remain direct.

## 6.0.0-beta.1

### Minor Changes

- 5def094: Add an objective Kanban projection over exact tracked-task phases and structural archives.

  Core and Server now expose exact phase counts plus bounded recent archive summaries through the shared Dashboard Summary contract. Web adds an interactive `/board`, replaces Dashboard Workflow Progress with the callback-free `ReadonlyKanban`, and publishes the same readonly Board in static exports. The readonly projection uses its own container to select four, two, or one columns without horizontal scrolling. The live Board contains page overflow, uses one horizontal lane-grid scrollbar, and lets each lane body scroll vertically on its own. Apply and Archive remain explicit existing Operator flows; drag-to-archive only opens Archive, and stale Root or projection data cannot authorize commands.

## 6.0.0-beta.0

### Major Changes

- ccd72af: Migrate Dashboard Summary live delivery to a version-2 data-free invalidation
  and identity/generation-correlated retained/current pull contract, and unify
  Web realtime loading, revalidation, and command-activity presentation.

  The Summary subscription no longer publishes business snapshot payloads. The
  Server issues an opaque identity, work generation, and cause; the Web adapter
  pulls the retained or current Summary and accepts it only when it still matches
  the active wake-up. Fresh browser Documents can render bounded Server-retained
  data as display-only while matching current work converges. Web routes retain
  readable content during revalidation, use stable local skeleton geometry for
  first loads, and preserve command labels while actions are pending. Trends,
  Git, and Changes retain their existing transport contracts.

  Live Project Web now settles protected health admission before importing its
  ordinary transports, while clean static export resolves the hashed SSG server
  entry through Vite's manifest. Authentication rejection becomes an explicit
  terminal document instead of an indefinite loading/retry loop.

  Effective OpenSpec data-home observation now settles initially missing Store,
  Workset, and Schema targets from bounded ancestor creation events without
  introducing generic missing-path polling.

  CLI startup now emits a host-neutral Direct Web or hosted App presentation
  request. The Browser adapter owns private URL materialization today, while a
  future native host can present the same backend intent without impersonating a
  browser opener. Successfully forwarded browser and PWA launch sources retire
  best-effort so the existing App surface can remain foreground.

  Static export now generates a publication-safe Context route from redacted
  snapshot root and Reference-policy metadata, without synthesizing live CLI or
  environment evidence. Shared list skeletons use an explicit physical row
  separator across Web and App loading surfaces. Static document bootstrap data,
  base paths, and titles now cross a context-aware HTML encoding boundary so
  source previews cannot escape into visible or executable document markup.

- 8b81f7d: Target the OpenSpec CLI 1.6.x line with OpenSpecUI 6.x.

  OpenSpecUI keeps the strict major-to-minor version law: OpenSpecUI 6.x targets
  OpenSpec CLI 1.6.x, accepts 1.5.x as the immediately previous legacy-compatible
  line, and rejects older or forward CLI lines by default.
  - Preserve typed CLI JSON, stdout, stderr, diagnostics, resolved root provenance,
    and exit status for workflow, Store, Context, Doctor, validate, and archive
    commands.
  - Complete the 1.6 workflow/tool contract with `update`, the 1.4 `sync` baseline,
    Oh My Pi, and Trae command delivery.
  - Follow strict validate/archive failures without implicit validation bypass or
    synthesized scenario merges.
  - Preserve empty healthy Stores and multiline Requirement bodies according to
    the pinned OpenSpec 1.6 contracts.
  - Add one typed, reactive Root Context contract across Core, Server, and Web for
    launch-project, CLI-selected planning-root, Reference, command-evidence, and
    inherited data-scope facts.
  - Bind project document, OPSX, search, dashboard, and preview services to the
    CLI-selected planning root instead of the launch directory.
  - Preserve one typed workflow target and command-specific Status/Instructions
    evidence through hooks, Server, tRPC, and Web Compose, including explicit
    Store selectors, resolved artifact outputs, action context, References, and
    process diagnostics.
  - Bind Agent prompts to the CLI-selected planning root and raw CLI-resolved
    paths, explicitly prohibit launch-project path reconstruction, and retain the
    same Store selector across OPSX command and direct CLI modes.
  - Replace workflow hook v1 with root-explicit `OnRunWorkflowHookV2`; document
    hooks remain independently versioned at v1 and no workflow compatibility
    alias is retained.
  - Lock root-dependent Compose, Propose, New, Verify, Change, terminal dispatch,
    and Archive actions during Root Context loading, refresh, and failure while
    preserving CLI-owned failed-attempt evidence.
  - Separate OpenSpec configuration contracts into launch-project Project
    Binding, CLI-selected Active Root Config, and Environment Global Config;
    remove the ambiguous project/global config RPC aliases.
  - Add explicit Code and distinct Planning Git repository scopes across status,
    history, detail, patch, refresh, worktree removal, handoff, URLs, and cache
    keys. Repository identity uses canonical worktree top-level and common-dir
    facts, so nested roots in one worktree do not create a false second scope.
  - Require every terminal creation to select Launch Project or current Planning
    Root, resolve absolute cwd only on the backend, preserve cwd identity across
    reconnect/restore, inherit the same backend environment for both targets, and
    reveal a successfully created Agent session in the area that owns Terminal.
  - Bound each PTY WebSocket client's output backlog and reconnect replay without
    terminating the Server-owned process, and coalesce browser output-activity
    projection updates so Agent output cannot starve the backend or React shell.
  - Spawn configured Agents directly from their executable and argument vector,
    and route Unix PTY input through an ordered, byte-bounded asynchronous file
    descriptor writer so canonical-line backpressure cannot starve the Server;
    Windows retains the native ConPTY writer.
  - Stamp Planning terminals with immutable Root generation provenance, keep Launch
    Agent PTYs valid Send targets, and route both through acknowledged,
    Server-revalidated workflow input.
  - Preserve the launch process OpenSpec data scope without project `.env`,
    `StoreRoot`, synthesized registry, registry overlay, or project configuration
    fields that could redirect `XDG_DATA_HOME`.
  - Route Spec, Change, task, archive, entity, artifact, schema, and active-config
    writes through one physical/reactive owner under the selected planning root.
    Reject lexical and observed symlink escapes, write disk before settling
    reactive file/directory state, and return only after subscribed projections
    can observe OpenSpecUI-owned writes.
  - Replace the single-project watcher pool with runtime-environment-owned,
    reference-counted dynamic observation roots. Existing reactive reads rebind
    when matching roots appear, overlapping roots choose the deepest owner, and
    Launch/Planning leases release deterministically during service teardown.
  - Observe the effective inherited OpenSpec data home and emit identity-only
    invalidation generations for Store, Workset, schema, and Context facets;
    affected subscriptions pull fresh CLI projections instead of receiving a
    competing copy of data-home truth.
  - Reconcile registered Store observation roots from successful typed
    `store list --json` results, acquiring, moving, and releasing leases as CLI
    truth changes while preserving the prior observed set on command failure.
  - Map normalized Launch and connected Planning root changes to identity-only
    project/context invalidations through one environment-local index, sharing
    registrations for the same canonical root and releasing them on teardown.
  - Invalidate server-owned OpenSpec mutation facets before buffered or streamed
    terminal/indeterminate outcomes reach clients, while leaving read-only and
    unknown commands free from inferred mutation claims.
  - Expose identity-only runtime invalidation pushes and make Store clients pull
    fresh CLI projections explicitly instead of receiving Store data in push
    frames.
  - Generalize Root Context, Store, Environment Global, OPSX, and Spec projections
    onto one lifecycle-only Push plus typed Pull contract. Retain settled CLI data
    as display-only during replacement, keep failed Work dependencies live for
    automatic recovery, and observe Environment Global config through the exact
    CLI-resolved XDG config path rather than unrelated project/data-home facets.
  - Coalesce duplicate invalidation pushes to each facet's latest generation and
    prevent slower stale Store pulls from replacing newer CLI projections.
  - Remove Store polling from healthy subscriptions and retain one bounded
    backend-owned fallback only for data-home, Store-root, or watcher observation
    gaps.
  - Make reactive runtime teardown idempotent and asynchronous so fallback checks,
    Store/Planning/data-home leases, path subscriptions, and physical watcher
    roots are fully released.
  - Map external registered-Store edits to Store/Context invalidation and prove
    two-client convergence across registry edits, concurrent settlements,
    reconnect, and root disappearance.
  - Replace generic task progress with formal tracked-artifact progress, grouped
    schema-document checklist analytics, and attributed Apply instruction
    progress. Tracked globs follow OpenSpec 1.6 selection/fallback semantics,
    `0/0` remains `no-tasks`, and divergent Apply counts stay visible without
    normalization. Every formal task retains its exact source file and file-local
    checkbox index so guarded mutations update the tracked artifact rather than a
    fixed `tasks.md`. Task writes use reactive file state, immediately refresh
    subscribed projections, and lock the active task control until settlement.
  - Replace bare Spec ids and RPCs with one Core-owned compound identity and
    source-aware Catalog/Document contract. Enumerate every Doctor-declared
    direct Reference through typed per-Store Spec list commands, retain partial
    failure evidence, and keep detail CLI-backed and read-only; routes, search
    records, caches, View Transitions, static providers, and SSG enumeration
    preserve full source identity.
  - Attribute Dashboard planning metrics to the CLI-selected root, expose its
    source, Store, and direct Reference evidence, and keep the Code Git snapshot
    distinct from an optional Planning repository. Workflow completion no longer
    implies archive readiness.
  - Keep the active Change list writable-Planning-root-only and derive its state
    from the full formal tracked-task phase, including an explicit `no-tasks`
    presentation that cannot become workflow or archive completion.
  - Preserve typed CLI Status/Instructions paths, action context, References, and
    explicit Store selection on Change detail. Archive now uses one Server-owned
    Root Context selection for strict validation and archive, retains multiline
    diagnostics, and never starts a synthesized validation-bypass retry. The
    legacy direct filesystem rename endpoint is removed so no public Archive path
    bypasses CLI evidence.
  - Replace generic `cli.execute` / arbitrary-command streaming RPCs with
    dedicated buffered and streamed OpenSpec argv procedures. Both reject Archive
    before `CliExecutor` starts, fixed global installation has its own route, and
    `archiveStrictStream` remains the only public application Archive mutation.
  - Serialize Planning-root replacement around one active service record. Root
    changes and disappearance retire obsolete watcher/invalidation leases,
    Kernel, hooks, Search, Dashboard, and preview state before callers observe a
    completed transition; final backend disposal remains idempotent.
  - Own every streamed CLI child through one settlement-aware handle. Cancellation
    requests SIGTERM, escalates to SIGKILL after a bounded grace period, and keeps
    the Planning-root lease until child close; backend disposal actively cancels
    attached streams and awaits settlement without depending on client detach.
  - Make each Web CLI queue item one exhaustive typed transport that derives its
    logical preview and subscription together, then replaces the preview with the
    backend-emitted effective command instead of accepting caller-authored argv as
    a second display truth.
  - Reject non-canonical filesystem-backed Spec and Change ids through one shared
    Core/Server guard before any read or mutation can escape its entity root.
    Entity-relative file and glob paths use the same boundary before OPSX queries,
    subscriptions, watcher dependencies, previews, or writes touch the filesystem.
  - Default the Spec Catalog to writable Owned entries and place direct
    Referenced Specs in a Store-grouped, visibly read-only sibling view while
    retaining compound routes for duplicate ids.
  - Scope live project Search to Active root by default and expose direct
    Referenced Specs through an explicit sibling scope. Shared engines filter
    source before scoring and limit, while Store-qualified live hits preserve
    compound identity. Current static snapshots remain Owned-only, so static
    Referenced Search is neutral-empty until the explicit 7.x export policy.
  - Make Settings a read-only projection of Root Context and Environment Global
    diagnostics, with launch-project tool detection and initialization state kept
    current through generation-safe reactive subscriptions.

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

- cdb2cb5: Static export now supports direct OpenSpec References and publication privacy.

  `ExportSnapshot.meta` is root-aware and privacy-safe: it carries `observedAt`,
  `projectName`, CLI-resolved `root` provenance, and `referencePolicy`. The absolute
  `meta.projectDir` is removed. `specs[].identity` is the compound `SpecIdentity`
  union (owned | referenced) so exported referenced Specs keep `(storeId, specId)`
  identity across routes, search, and the static catalog.

  `openspecui export` gains `--references <include|omit>`, required when the planning
  root declares effective References. `include` materializes direct Reference Specs
  through official `list --specs --store --json` / `show --type spec --store --json`
  (complete-or-fail, never transitive); `omit` records an explicit omission state.
  A single publication redaction boundary strips absolute paths, host identity, and
  gates the Git remote behind the explicit include policy.

  Referenced Specs hydrate in the static provider/search/SSG under their compound
  routes (`/specs/referenced/<storeId>/<specId>`), scoped to `referenced-specs`
  search, with an explicit omission error when absent.

### Patch Changes

- 95bc2b9: Accelerate live Dashboard and Changes projections with server-owned bounded Work,
  current/stale snapshot delivery, progressive Change rows, and demand-driven OPSX
  Status. Dashboard now admits first-screen Summary before secondary projections,
  and Changes renders its first row before aggregate workflow Status starts.

## 5.0.0

### Major Changes

- 3019d08: Target the OpenSpec CLI 1.5.x line with OpenSpecUI 5.x.

  OpenSpecUI follows a strict 1:1 major-to-minor version law: one OpenSpecUI
  major line targets exactly one OpenSpec CLI minor line (2.x→1.2, 3.x→1.3,
  4.x→1.4, 5.x→1.5). This release introduces the 5.x line for OpenSpec CLI 1.5.x.
  - OpenSpec CLI `>=1.5.0 <1.6.0` is the current/recommended line.
  - OpenSpec CLI `>=1.4.0 <1.5.0` is accepted as legacy-compatible.
  - OpenSpec CLI 1.3.x and older are no longer supported (each line
    backward-supports only the previous CLI minor line).

  Note: 4.1.0 was published to npm as a transition artifact; 5.0.0 is the
  correct line going forward. The Stores panel (beta) and navigation
  improvements ship on this line.

## 4.1.0

### Minor Changes

- 29e9571: Add a read-only Stores panel (beta) and a beta-feature fault-tolerance model.

  ## Stores panel (beta)

  OpenSpecUI 1.5.0 Stores are now surfaced in a read-only panel with a visible
  Beta badge. It lists machine-registered OpenSpec stores (id + root) via
  `openspec store list --json`, refreshes on a 5s poll (the registry lives outside
  the project directory, so the file watcher can't observe it), and is live-only
  (not part of the static/SSG snapshot).

  ## Beta-feature fault tolerance

  Beta features no longer rely on the stable version gate. Stores tolerates CLI
  absence/incompatibility at runtime with lenient (passthrough, optional-field)
  zod parsing and classifies failures into two kinds:
  - **data-incompatible** (CLI exits 0 but the payload fails lenient parsing) →
    the panel shows an objective error **with the OpenSpec CLI version source**.
  - **command-unavailable** (the `store` command is missing or changed; non-zero
    exit) → the Stores navigation entry is hidden.

  The frontend never crashes on either failure kind.

  ## Version law (stable maintenance)

  OpenSpecUI 4.x now accepts OpenSpec CLI `>=1.3.0 <1.6.0`. The 1.5 line is the
  target, 1.4 remains current/recommended, and 1.3 stays legacy-compatible. This
  is independent stable maintenance (previously 1.5.0 was hard-blocked).

## 4.0.2

## 4.0.1

### Patch Changes

- 962795a: Re-release the 4.x line as 4.0.1.

  `4.0.0` is permanently blocked on npm: it was published then unpublished on
  2026-05-22 for `@openspecui/core`, `@openspecui/search`, and `openspecui`, and
  npm forbids re-using a published-then-unpublished version. The fixed group moves
  together, so the first installable 4.x release is `4.0.1`. No code changes beyond
  the 4.0.0 CLI-1.4 line bump.

## 4.0.0

### Major Changes

- b8d85f9: Release OpenSpecUI 4.0 aligned with OpenSpec CLI 1.4 workflows.
  - Establish OpenSpecUI 4.x as the OpenSpec CLI 1.4.x target line while accepting 1.3.x as legacy-compatible.
  - Block OpenSpec CLI versions outside `>=1.3.0 <1.5.0`.
  - Sync AI tool metadata with OpenSpec CLI 1.4.1, including Kimi CLI and Mistral Vibe skills-only tools.
  - Update documentation, reference guard, and in-app copy for the OpenSpec CLI 1.4 line.

## 3.12.0

### Minor Changes

- dc997ea: Project task progress from schema-matched Markdown checklist items across active and archived changes.

## 3.11.6

## 3.11.5

### Patch Changes

- a055d57: Fix translation reliability around managed local engines and markdown rendering.
  - preserve translation config writes without overwriting sibling defaults
  - honor global-first translation settings with project overrides
  - keep managed local engine readiness and selected download groups in sync
  - translate markdown table cells in bilingual/direct rendering
  - refine inline markdown code styling

## 3.11.4

### Patch Changes

- b02c131: Improve translation reliability by enforcing per-item timeout/error handling across service-side translators, mapping managed-local memory budgets into runtime and worker execution strategy, and surfacing segment-level retry flows with configurable smoke-test timeouts in the settings UI.

## 3.11.3

### Patch Changes

- bc8e0a8: Add the managed `local-llama` translation engine across the shared core/server/web stack, with host-owned optional runtime installation for `node-llama-cpp` and GGUF model selection.

  Also tighten the managed-local translation UX by returning recommended models for empty search, preserving server/local panel truth before auto-refreshing artifacts, and fixing local translation state handling regressions surfaced by CT2 and segment patch flows.

## 3.11.2

## 3.11.1

### Patch Changes

- ec56e7f: Fix the published runtime package layout so `@huggingface/transformers` stays
  external to the CLI/server bundle and can resolve its native runtime
  dependencies from installed package dependencies.

  Unify Local-Transformers model profile state behind the server `panelState`
  source of truth so Settings chips render selection, download status, and file
  progress from the same model lifecycle snapshot.

- da4b8ee: Align Local-Transformers runtime identity between Translation Test and page translation
  so both paths persist the same selected model/profile snapshot.

  Block incompatible directional local models before document translation starts, including
  page-level detected source-language groups, instead of letting ONNX runtime fail later.

## 3.11.0

### Minor Changes

- eba707d: Add backend-backed folder file preview, edit, and dedicated HTML preview entries for changes and archives.

## 3.10.0

## 3.9.0

## 3.8.0

### Minor Changes

- 4f43845: Switch translation engines to bundled dynamic imports and batch translation.

  Notable translation engine changes:
  - rename engine ids to `browser | local | openai`
  - rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
  - replace single `translate(...)` with `batchTranslate(...)`
  - remove engine install/cancel install flows and old `nmt/ai` config keys
  - add resumable Local-Transformers model downloads with byte-level progress recovery

## 3.7.2

## 3.7.1

### Patch Changes

- 9745b8f: Fix document translation projection for OpenSpec headings, code-like spans, and nested list items.
- 9745b8f: Add development conditional exports so source-mode worktree runtimes resolve workspace TypeScript sources while published/default runtimes keep using dist artifacts.
- 106534f: Upgrade document translation to a HAST-stage projection pipeline with shared SQLite cache controls.
- 9745b8f: Reject incompatible worktree handoff targets with a shared runtime capability contract and harden notification config defaults.

## 3.7.0

### Minor Changes

- b491529: Add the document translation platform, including translation settings, Markdown reading pipeline ordering, Chrome Translator integration, ToC translation actions, and direct/bilingual document projection modes.

### Patch Changes

- b491529: Render archived OPSX entities from schema-neutral file detail instead of the legacy spec-driven change projection.

## 3.6.1

## 3.6.0

### Minor Changes

- 30d7af0: Render spec detail pages from processed Markdown while using parsed OpenSpec structure as semantic enhancement data.

## 3.5.2

## 3.5.1

## 3.5.0

### Minor Changes

- ecfccd2: Add the in-memory web notifications platform with terminal bell/OSC producers, PopArea notification panel, notification settings, sound previews, and a rolling browser Notification bridge.

## 3.4.1

## 3.4.0

### Minor Changes

- f9b63a0: Add terminal shell profiles and data-driven spawn commands with shared create-terminal flows.

## 3.3.0

### Minor Changes

- 1815ef5: Add project-local `openspec/openspecui.hooks.ts` support with `onReadDocument` and `onRunWorkflow` hooks, processed/source document projections for live/search/export, and OPSX workflow invocation preparation through the server runtime.

## 3.2.3

## 3.2.2

## 3.2.1

### Patch Changes

- bdeb61d: Polish terminal theme application and terminal tab chrome so the terminal header matches the active terminal theme, tab overflow stays horizontally scrollable, and inactive tab motion uses a smoother iOS-style transform without causing vertical scroll jitter.

## 3.2.0

### Minor Changes

- b57eb85: Add configurable terminal light and dark themes, follow app or system theme selection, and reduce default markdown reading density to ease visual fatigue.

## 3.1.2

### Patch Changes

- 99e74c1: Complete reactive artifact output tracking for nested and globbed outputs.

## 3.1.1

## 3.1.0

### Minor Changes

- 0658249: Simplify the hosted app architecture so `app.openspecui.com` acts only as a PWA shell that opens backend-owned OpenSpecUI pages via the new `/api/health` embedding contract.

## 3.0.1

### Patch Changes

- 2e2b59f: Add project-level OPSX agent invocation mode preference and support compose or command dispatch for eligible OPSX actions.

## 3.0.0

### Major Changes

- cc396b9: Release OpenSpecUI 3.0 aligned with OpenSpec CLI 1.3 workflows.
  - Establish OpenSpecUI 3.x as the OpenSpec CLI 1.3.x target line while accepting 1.2.x as legacy-compatible.
  - Block OpenSpec CLI versions outside `>=1.2.0 <1.4.0`.
  - Normalize `openspec instructions apply --json` context files to artifact-to-path-array mappings, matching OpenSpec CLI 1.3 while preserving legacy single-path output.
  - Sync AI tool metadata with OpenSpec CLI 1.3.1, including Bob Shell, ForgeCode, Junie, Lingma, Copilot detection paths, and OpenCode `.opencode/commands/`.
  - Update documentation, specs, and reference checks for the OpenSpec CLI 1.3 line.

## 2.3.7

## 2.3.6

### Patch Changes

- 7be50a7: Promote deleted-worktree recovery into a platform-level handoff flow. The watcher runtime now reports project-root eviction state, the server resolves fallback worktrees from cached Git common-dir metadata, and the web shell auto-switches to an existing default-branch worktree while preserving the current route.

## 2.3.5

## 2.3.4

## 2.3.3

### Patch Changes

- 4b11a8a: Fix CLI runner probing and execution when `spawn()` throws synchronously for invalid commands.
  This prevents delayed `ReferenceError` failures and keeps CLI availability checks stable for the web and server integrations.

## 2.3.0

### Minor Changes

- 2023e8b: Add native view-transition navigation for top-level routes, shared-element detail handoffs, and routed tab carousels, while restructuring Git detail loading for faster patch delivery and smoother bottom-panel interactions.

## 2.2.0

### Minor Changes

- abe56de: Add a dedicated live Git panel with changed-file detail, worktree switching handoff, and shared Git snapshot UI primitives.

## 2.1.7

### Patch Changes

- 750405c: Improve the dashboard Git Snapshot panel with chronological entry ordering, commit/uncommitted timestamps, and optional auto-refresh presets.

## 2.1.5

### Patch Changes

- 6f2f1b3: Fix dashboard recency ordering and make local CLI dev prefer the latest web build.

## 2.1.3

### Patch Changes

- cb76966: Improve init/settings ergonomics, reduce noisy config persistence, and keep local web assets in sync for CLI and dev workflows.

## 2.1.2

### Patch Changes

- 24bff06: Fix hosted app refresh and update reliability across deployed builds.
  - register the hosted app service worker as a module so versioned iframe routes stay on the correct channel shell after refresh
  - distinguish deployed app manifests and prewarm new hosted caches before prompting for reload
  - improve hosted app shell refresh/loading behavior and align website entry copy for the app mode

## 2.1.1

### Patch Changes

- a9df0b1: Fix hosted app shell synchronization, harden versioned service-worker navigation, and refine dashboard git snapshot interactions.

## 2.1.0

### Minor Changes

- 143b916: Add hosted app distribution support across the CLI, server, and web runtime.
  - add `openspecui --app` with configurable hosted app base URLs and local hosted-app dev mode
  - expose hosted session/bootstrap helpers so versioned frontend entries can reconnect to the correct backend
  - include hosted-app settings and faster dashboard overview loading for the web UI
  - scope xterm input-panel persisted state by hosted session to avoid cross-tab leakage

## 2.0.0

### Major Changes

- 5edd6b1: Release OpenSpecUI 2.0 aligned with OpenSpec 1.2 workflows.
  - Require OpenSpec CLI >= 1.2.0 in UI compatibility gate.
  - Add OpenSpec 1.2 profile/sync visibility and update actions in Settings.
  - Support OpenSpec 1.2 tool set updates (including Kiro and Pi) and new workflow skills.
  - Update init flow to support auto-detect mode and profile override semantics.
  - Refresh docs with versioned 1.x references and new 2.x root README guidance.

## 1.6.2

### Patch Changes

- fcfb701: Move terminal InputPanel entry from floating FAB to the terminal toolbar, harden InputPanel remount lifecycle recovery, and improve schema-driven workflow compatibility by removing proposal/tasks/design hard assumptions from dashboard metadata paths.

  Also evolve `opsx-collab-pr-loop` into dedicated loop artifacts under `loop/*` (intake, research-plan, implementation, checkpoints) with apply tracking on `loop/checkpoints.md`.

## 1.6.1

### Patch Changes

- 9966b7a: Refactor code editor config shape from `codeEditorTheme` to `codeEditor.theme`, and keep GitHub as the default editor theme.

## 1.6.0

### Patch Changes

- 1f2ad09: Improve dashboard and schema workflows with better static/live parity.
  - enhance dashboard cards and historical trend plumbing with git-backed static data mapping
  - improve schema file explorer interactions: robust context-menu anchoring, read-mode properties action, and mobile current-file menu
  - improve static export UX and path display mapping, including project/npm scoped display paths
  - add safer CLI export package resolution behavior and test coverage for local/dev package ranges

## 1.5.0

### Minor Changes

- 67d7d16: Finalize the dashboard live workflow iteration with stronger operational context and static parity:
  - redesign Dashboard top section into objective `Workflow Progress` + `Git Snapshot`
  - add git snapshot model/refresh lifecycle and compact diff-focused rendering
  - harden objective trend windowing and availability semantics
  - archive and sync the `dashboard-live-workflow-status` OpenSpec change artifacts
  - export and consume OpenSpecUI config in static snapshots for consistent Settings/Dashboard behavior

### Patch Changes

- a29c5a8: Improve dashboard with a new objective overview data model and reactive subscription:
  - add backend `dashboard` get/subscribe API
  - include spec/requirement counts and active/completed/in-progress change metrics
  - show per-spec requirement breakdown and per-change task progress in UI
  - support static export mode via dashboard overview mapping

## 1.2.0

### Minor Changes

- Add a full pop-area based `/opsx:new` creation flow and unify terminal close lifecycle with callback metadata.
  - Replace dashboard/changes prompt-based creation with `/_p=/opsx-new` workflow UI.
  - Add advanced argument chips on `/opsx-new` while keeping official `new change` flags.
  - Extend PTY create/list protocol with `closeTip` and `closeCallbackUrl` metadata.
  - Execute close callbacks from a single terminal close path after process exit (internal route push or external URL open).
  - Add tests for new pop route mapping, command assembly, and terminal close callback behavior.

## 1.1.2

### Patch Changes

- Refactor OPSX config data flow to use a single `configBundle` subscription path.
  - unify config/schemas page schema metadata loading through one reactive bundle
  - remove deprecated split schema subscriptions from server and web hooks
  - optimize kernel-backed read lifecycle for faster first paint in config views

## 1.1.0

### Minor Changes

- Release a minor version focused on platform reliability and search/productivity upgrades:
  - Add reactive search architecture with shared provider-based search engine and pop-area search UX.
  - Improve pop dialog lifecycle to make open/close behavior deterministic across routes and interactions.
  - Enhance CLI execution-path detection/config flow and related runtime diagnostics.
  - Improve terminal/session behavior and cross-platform compatibility, including Windows execution fixes.

## 1.0.4

### Patch Changes

- 74afc3f: Improve CLI configuration initialization and developer workflow stability.
  - Fix config persistence bootstrap by creating `openspec/` before writing `.openspecui.json`, so missing project config paths are no longer misreported as CLI-unavailable errors.
  - Improve dev workflow with a Bun/OpenTUI multi-tab `pnpm dev` experience and terminal rendering pipeline upgrades for PTY-style output, color-preserving display, and more reliable task lifecycle handling.
  - Fix Windows PTY startup defaults by resolving shell command from `ComSpec` (fallback to `cmd.exe`) instead of unix-only `/bin/sh`, and return structured `PTY_CREATE_FAILED` errors when PTY session creation fails.

## 1.0.3

### Patch Changes

- 74afc3f: Improve CLI configuration initialization and developer workflow stability.
  - Fix config persistence bootstrap by creating `openspec/` before writing `.openspecui.json`, so missing project config paths are no longer misreported as CLI-unavailable errors.
  - Improve dev workflow with a Bun/OpenTUI multi-tab `pnpm dev` experience and terminal rendering pipeline upgrades for PTY-style output, color-preserving display, and more reliable task lifecycle handling.

## 1.0.2

### Patch Changes

- Improve CLI configuration reliability and in-app recovery flow.
  - Add strict `execute-path` behavior: when user-configured, it is used as the only runner candidate (no implicit fallback), so invalid paths are surfaced immediately.
  - Improve command parsing for `execute-path` with robust quoted/Windows-path handling and `command + args` persistence.
  - Unify config write path on `config.update`, keep `config.subscribe` as the single reactive config stream, and fix reactive config push after writes.
  - Upgrade the `OpenSpec CLI Required` modal to support inline `execute-path` input/save/recheck and auto-close on successful availability checks.
  - Improve dev workflow so root `pnpm dev` also watches and rebuilds `@openspecui/core`, with server dev watching core dist changes.

## 1.0.0

### Major Changes

- Release all workspace packages to `1.0.0` for the new major release.

## 0.9.0

### Minor Changes

- 28db01c: Refactor SSG to use Vite official pattern
  - Simplified SSG implementation using Vite's official pre-rendering approach
  - Added `prerender.ts` script that uses HTML template from `vite build`
  - Removed complex runtime Vite build from old `cli.ts`
  - Removed ai-provider dependency from server and cli packages
  - Added Changesets for version management
