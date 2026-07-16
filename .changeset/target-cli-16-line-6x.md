---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
openspecui: major
---

Target the OpenSpec CLI 1.6.x line with OpenSpecUI 6.x.

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
  reconnect/restore, and inherit the same backend environment for both targets.
- Preserve the launch process OpenSpec data scope without project `.env`,
  `StoreRoot`, synthesized registry, registry overlay, or project configuration
  fields that could redirect `XDG_DATA_HOME`.
- Route Spec, Change, task, archive, entity, artifact, schema, and active-config
  writes through the selected planning root, and reject relative artifact paths
  that escape their CLI-selected change root.
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
  normalization.
- Replace bare Spec ids and RPCs with one Core-owned compound identity and
  source-aware Catalog/Document contract. Direct Reference detail remains
  CLI-backed and read-only; routes, search records, caches, View Transitions,
  static providers, and SSG enumeration preserve full source identity.
- Attribute Dashboard planning metrics to the CLI-selected root, expose its
  source, Store, and direct Reference evidence, and keep the Code Git snapshot
  distinct from an optional Planning repository. Workflow completion no longer
  implies archive readiness.
- Keep the active Change list writable-Planning-root-only and derive its state
  from the full formal tracked-task phase, including an explicit `no-tasks`
  presentation that cannot become workflow or archive completion.
- Preserve typed CLI Status/Instructions paths, action context, References, and
  explicit Store selection on Change detail. Archive now delegates readiness to
  strict CLI validation, retains multiline diagnostics, and never starts a
  synthesized validation-bypass retry.
- Default the Spec Catalog to writable Owned entries and place direct
  Referenced Specs in a Store-grouped, visibly read-only sibling view while
  retaining compound routes for duplicate ids.
