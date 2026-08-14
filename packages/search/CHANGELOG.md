# @openspecui/search

## 7.0.2

## 7.0.1

## 7.0.0

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.1

## 6.0.0

### Major Changes

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

## 6.0.0-beta.1

## 6.0.0-beta.0

### Major Changes

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

### Patch Changes

- 9745b8f: Refine document translation controls with ToC action dedupe, session-shared activation, and searchable bilingual language settings.
- 9745b8f: Add development conditional exports so source-mode worktree runtimes resolve workspace TypeScript sources while published/default runtimes keep using dist artifacts.

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

### Patch Changes

- bdeb61d: Polish terminal theme application and terminal tab chrome so the terminal header matches the active terminal theme, tab overflow stays horizontally scrollable, and inactive tab motion uses a smoother iOS-style transform without causing vertical scroll jitter.

## 3.2.0

## 3.1.2

## 3.1.1

## 3.1.0

## 3.0.1

## 3.0.0

## 2.3.7

## 2.3.6

## 2.3.5

## 2.3.4

## 1.1.0

### Minor Changes

- Release a minor version focused on platform reliability and search/productivity upgrades:
  - Add reactive search architecture with shared provider-based search engine and pop-area search UX.
  - Improve pop dialog lifecycle to make open/close behavior deterministic across routes and interactions.
  - Enhance CLI execution-path detection/config flow and related runtime diagnostics.
  - Improve terminal/session behavior and cross-platform compatibility, including Windows execution fixes.
