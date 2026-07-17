<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Track completed research and approval gates.
2. Sequence root, CLI, reactive, and projection implementation.
3. Track project, static, hosted, and App product surfaces.
4. Bind implementation tasks to objective verification.
5. Track PR, archive, merge, and release gates.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
Original request (2026-07-14): "我们最终使用openspec来管理 wayfinder 产出的文档。"
Original request (2026-07-16): "代码已经提交，开始review。如果有问题，那么可更新change甚至可以新开change。"
-->

## 1. Research and Planning

- [x] 1.1 User input, objective scope, non-goals, and acceptance boundary are captured in `loop/intake.md`
- [x] 1.2 Official OpenSpec 1.4 through 1.6 source, tests, changelog, and agent contracts are audited
- [x] 1.3 `references/openspec` is pinned to official `v1.6.0` (`e1b51d1`)
- [x] 1.4 Data scope, App/project ownership, hosted protocol, task projection, and static export decisions are closed in Wayfinder
- [x] 1.5 Store Manager Inspector + Context Matrix + Inventory composition is selected from the prototype
- [x] 1.6 Approved research and delivery order are recorded in `loop/research-plan.md`
- [x] 1.7 Pre-implementation truth and loopback triggers are recorded in `loop/implementation.md`

## Blocking Review Correction Work Package

This work package precedes every still-planned product checkpoint. The same boundaries have failed repeatedly, so endpoint-local patches are not sufficient evidence of completion.

```text
reachable capability inventory
          |
          v
one explicit owner per mutation / projection / lifecycle
          |
          v
official CLI + physical FS + immediate reactive + root-rotation tests
          |
          v
re-audit every public entry and only then close checkpoints
```

Recurring failure analysis:

- **Archive ownership recurred across different public entries.** Global Archive generic commands, legacy Adapter rename, `change.archive`, typed `cli.archive*`, and now generic `cli.execute` / `runCommandStream` were closed one name at a time while the reachable capability remained. Construction must begin from an inventory of every public route and caller that can reach `CliExecutor.execute*`; `archiveStrictStream` must be the only reachable Archive mutation, and route-absence/rejection tests must cover every generic path.
- **Filesystem protection stopped at the last discovered syntax.** Change/task ids, literal/glob output paths, and parent traversal were guarded separately, but lexical containment was mistaken for physical containment. Create one shared physical entity-write boundary. Validate ids and relative paths, resolve the Planning root and existing ancestors physically immediately before mutation, reject symlink escape, and update reactive state only after the disk write succeeds. Test intermediate-directory symlinks, existing-target symlinks, missing leaf creation, and normal in-root writes.
- **Reactive correctness was repaired for one task writer, not owned by the write primitive.** A successful direct write must make the next reactive read and subscriber pull observe the new bytes without watcher timing. Prefer one reusable reactive write operation or one Server write owner used by Adapter and Router paths; do not scatter `updateReactiveFileCache` calls without auditing every write caller.
- **Synthetic fixtures hid an upstream contract mismatch.** OpenSpec 1.6 Doctor does not embed Reference Specs. Do not add optional `specs` to Doctor fixtures. Enumerate every Doctor-declared direct Store through the typed `list --specs --store --json` contract, preserve per-Store failures/evidence, and prove the Catalog with the pinned executable 1.6 fixture.
- **Environment teardown was mistaken for root-replacement teardown.** Planning-root A must stop owning background resources when B becomes active. Implement an explicit serialized replacement lifecycle and test A -> B -> A, concurrent resolve during replacement, preview isolation, zero stale leases, and idempotent backend disposal.
- **Release prose advanced ahead of product state.** Changesets may describe only checked and user-reachable behavior. Keep `/context` additive until checkpoint 6.9 actually removes/replaces project Stores.

Reflection required before re-closing any reopened checkpoint:

- Record the complete capability/caller inventory, the shared owner introduced, and why no sibling route can bypass it.
- Record the regression test that fails against `8d38f35`, not only a test written after the fix.
- Explain why the previous correction was local rather than ownership-complete and what now prevents the same class from reappearing under a new endpoint, path shape, fixture, or lifecycle transition.
- List residual platform limits explicitly. In particular, do not claim race-free filesystem confinement if the implementation only performs pre-write path checks.

Second-review construction directives after `f138765`:

- Generic OpenSpec execution is read-only by explicit allowlist; all mutations use typed Server-owned procedures. Rejecting only `archive`, or adding another denylisted command, cannot close 3.11 or 6.7.
- Project Schema/Template mutations use the same physical/reactive Planning-root owner as every other application write. User/package schemas remain read-only unless a separately reviewed environment-global owner is introduced; that expansion is not part of this package.
- Reference list and show both require exact non-null Store provenance. At least one pinned executable OpenSpec 1.6 test must carry real Doctor/list/show results through Catalog and referenced detail, not stop at adapter fixtures.
- Root Context replacement/removal drives manager transition before a new identity is exposed. A stale manager record or readable preview for the previous root keeps 4.9 open.
- Archive scenario-loss evidence runs through `archiveStrictStream`, and the changed-file header audit covers the entire production diff rather than only newly created files.
- Red tests must reproduce the review counterexamples against `f138765`; green tests, full local gates, clean SSG, remote CI, capability inventory, recurrence reflection, and residual risks are required before any checkbox changes.

Third-review construction directives after `a6e2dcd`:

- Validate Archive `changeId` with the shared canonical entity guard before Root Context resolution, preflight, or Archive execution. Cover traversal through both strict and explicit no-validation paths against the pinned OpenSpec 1.6 executable; CLI validation is not a path guard.
- Do not return a mutable Planning-root service capability that can outlive its admitted operation. All root-dependent mutations acquire a manager-owned operation lease; A -> B waits for admitted A work to settle, B is not exposed early, and new work cannot enter retired A.
- Prove the lifetime contract through public Spec, Change/task, Archive/entity-file, artifact-output, and Schema mutation routes. A test that only checks lease disposal or old Preview 404 is insufficient.
- Remove unused generic OpenSpec RPCs, or parse any genuinely required read-only argv through strict repository-standard `yargs` and prove the accepted shapes independently against pinned OpenSpec 1.6. Production-policy examples are not independent contract evidence.
- Replace the newly introduced Schema-action and CLI-stream discriminant cascades with exhaustive `ts-pattern` or a single typed descriptor map; do not preserve duplicate action vocabularies across validation and execution.

Fourth-review construction directives after `fa6604b`:

- This package is approved for implementation through `openspec-apply-change`. The reviewer owns research/review/plan and the worker owns code, tests, continuous checkpoint evidence, commits, and PR delivery; returning only another plan does not execute this package.
- Model stream cancellation as a two-phase owner contract: cancellation request, then child-process settlement. `child.kill()` returning is not settlement. Root replacement may release the lease only after `close` or a bounded, explicitly recorded indeterminate outcome; otherwise an Update or Archive process can continue mutating A after B is exposed.
- The Manager retains idempotent cancel-and-settle handles for every active stream. Backend disposal first rejects new admission, actively cancels those streams, awaits lease release, and then retires the record. It must not wait forever for a client detach or terminal event that teardown itself prevents.
- Add permanent counterexamples against `fa6604b`: a delayed-SIGTERM child proves replacement remains blocked between `kill()` and `close`; a never-terminal public stream plus real WebSocket shutdown proves backend close reaches zero resources without external event injection. Audit terminal, null exit, startup failure, delayed startup, unsubscribe, repeated cancel, and disposal through the same owner.
- Make `CliStreamTransport` the sole semantic command descriptor. Derive queued/displayed command evidence from that transport or the backend-emitted effective command; independent caller-authored `command/args` cannot coexist as a second truth. A test that displays `config list` while dispatching `validate` is a counterexample, not positive coverage.
- Re-audit intent/original-request headers for every changed TypeScript/TSX file, including tests. Production-only header coverage is insufficient. Reopen only the checkpoints directly disproven by the stream lifetime fault unless new red evidence expands scope.

Fifth-review construction directives after `ca72cc0`:

- The `A -> B` transition must not wait on A's operation lease while the only cancellation path for A is queued behind that same transition. Disposal closes admission synchronously, retains the retiring record/active streams, requests cancellation outside the blocked transition lane, and then either retires A after confirmed settlement or rejects teardown in bounded time. It must never expose B after an unconfirmed child.
- A rejected `CliStreamHandle.settled` is a terminal transport fact, not an unhandled background Promise. Planning-root streams, strict Archive, and fixed global install each deliver exactly one tRPC error to attached clients; detached clients receive no emission but still request cancellation. The Web runner must resolve `CommandProcess.done` and render `error`, never remain `running`.
- Keep the safety decision explicit: forced termination with no direct-child `close` does not release the Planning-root lease or pretend teardown succeeded. It invalidates affected facets, emits one classified error, and causes backend close to reject rather than deadlock forever or expose a replacement root.
- Add permanent red tests against `ca72cc0` before the fix: A -> B waiting then disposal; forced termination without close through planning-root Validate/Update, strict Archive, and global install; and Web runner terminal projection. A mocked synchronous cancel or an injected terminal event is not evidence.
- Only checkpoint `4.9` reopens for this correction. Keep `3.11`, `4.5`, and `6.7` closed; `6.8+` remains unstarted until this code correction passes independent review.

Seventh-review construction directives after `c1571f3`:

- The Core late-close test must be mutation-resistant for the actual `CliExecutor` child-owner cleanup. Demonstrate that removing or bypassing the production `activeChild = null` transition fails the permanent test; a second `close` producing no `exit` is insufficient because the already-settled guard independently suppresses that event.
- Do not use the Manager test's test-authored EventEmitter bookkeeping as proof of Core bookkeeping. Keep the two facts separate: Core owns the direct child reference/listener lifecycle; the Manager owns the rejected lease and prevents B exposure.
- Prefer a narrow internal child-owner seam that can be observed or spied through the real `CliExecutor` close handler. Do not expose test diagnostics through the public package API and do not release the Planning-root lease after a forced termination failure.
- Reopen only `4.9` for this evidence gap. The sixth correction's Manager, Router, Strict Archive, and Web evidence remains accepted; `3.11`, `4.5`, and `6.7` remain closed, and `6.8+` remains unstarted.

## 2. CLI 1.6 Contract Baseline

- [x] 2.1 OpenSpecUI compatibility targets the CLI 1.6 line and rejects unsupported versions with accurate guidance
- [x] 2.2 Typed command adapters preserve CLI JSON, stderr, structured diagnostics, root provenance, and exit status
- [x] 2.3 Root/context adapters cover nearest root, declared Store fallback, and explicit `--store` selection
- [x] 2.4 Store adapters cover list, doctor, setup, register, unregister, remove, empty healthy Stores, and command failures
- [x] 2.5 Reference adapters cover declared, self, missing, unhealthy, and direct one-level Reference indexes
- [x] 2.6 The 1.4 core-profile `sync` workflow is present across tool state, initialization, hooks, invocation, actions, and tests
- [x] 2.7 The 1.6 `update` workflow is present across tool state, initialization, hooks, invocation, actions, and tests
- [x] 2.8 Oh My Pi support and Trae command-delivery state are complete and fixture-tested
- [x] 2.9 Validate/archive adapters use process exit status and preserve strict diagnostics without implicit `--no-validate` retry
- [x] 2.10 Scenario-loss protection and multiline requirement bodies render without truncation or synthesized merges
- [x] 2.11 First-party 1.4, 1.5, and 1.6 contract fixtures prove feature completeness beyond the version gate

## 3. Root Context and Service Ownership

- [x] 3.1 Core defines one typed Root Context containing launch project, planning root, root source, Store id, CLI health, References, and data-scope diagnostics
- [x] 3.2 Server exposes one query/subscription contract for Root Context with full loading, stale-data, and error states
- [x] 3.3 Planning-root adapters and document services consume the CLI-resolved root instead of launch `projectDir`
- [x] 3.4 Change actions preserve `changeRoot`, Store flags, artifact paths, existing output paths, action context, References, and diagnostics
- [x] 3.5 Root-dependent actions remain locked until root selection succeeds and show CLI-owned failure evidence when it does not
- [x] 3.6 Config ownership separates launch-project binding, active-root config, and environment-global config
- [x] 3.7 Git exposes explicit code-repository and planning-repository scopes when they differ
- [x] 3.8 Terminal exposes explicit launch-project cwd and planning-root cwd while preserving inherited `XDG_DATA_HOME`
- [x] 3.9 Agent prompts and OPSX commands use CLI-resolved paths and never reconstruct `<launch-project>/openspec`
- [x] 3.10 Project-owned `.env`, `StoreRoot`, registry overlay, and synthesized registry paths remain absent
- [x] 3.11 Tests assert every application mutation path, including Archive identity, concurrent root replacement, generic CLI, and Schema/Template routes, can mutate only its Server-owned selected root and cannot escape through path traversal, stale handles, or symlinks

## 4. Multi-Root Reactive Kernel

- [x] 4.1 Reactive observation supports a reference-counted dynamic set of roots per runtime environment
- [x] 4.2 Effective OpenSpec data home changes invalidate Store, Workset, schema, and Context facets
- [x] 4.3 Registered Store roots are added/removed from observation as registry truth changes
- [x] 4.4 Launch-project and connected planning-root changes invalidate their project/context facets
- [x] 4.5 CLI mutation terminal or indeterminate outcomes invalidate affected facets, and every direct filesystem write/create/delete route settles reactive state before returning
- [x] 4.6 Push messages carry invalidation identity only; clients pull fresh CLI projections
- [x] 4.7 Duplicate invalidations coalesce or remain idempotent across subscribers
- [x] 4.8 Store polling is removed as the primary path and retained only as a bounded watcher-failure fallback
- [x] 4.9 Root Context replacement/removal waits for admitted old-root operations, actively retires all old capabilities/watchers/services/previews, and exposes the new root only after retirement
- [x] 4.10 Multi-client tests cover external Store edits, registry changes, concurrent operations, reconnect, and root disappearance

## 5. Task and Spec Projection Contracts

- [x] 5.1 Generic task `progress` is replaced without alias by `trackedTaskProgress`, `documentChecklistSummary`, and `applyInstructionProgress`
- [x] 5.2 `trackedTaskProgress` resolves only the artifact selected by `apply.tracks` and expands its output glob
- [x] 5.3 Tracked progress falls back to top-level `tasks.md` only when schema/artifact resolution or matched files yield no source
- [x] 5.4 `documentChecklistSummary` scans schema Markdown documents, groups statistics by artifact/file, and never drives workflow state
- [x] 5.5 `applyInstructionProgress` preserves the raw Apply result and visibly attributes divergence from tracked progress
- [x] 5.6 `0/0` maps to `no-tasks`, never complete; archive readiness remains a CLI validate/archive outcome
- [x] 5.7 Core defines compound Spec identity as `(owned, specId)` or `(referenced, storeId, specId)`
- [x] 5.8 Shared Spec Catalog enumerates each Doctor-declared Reference through pinned CLI-backed list/show, requires matching Store provenance, and preserves partial failure evidence without flattening source or read-only state
- [x] 5.9 Live and static routes use `/specs/owned/<specId>` and `/specs/referenced/<storeId>/<specId>`
- [x] 5.10 Search records, cache keys, view-transition keys, links, and provider lookups preserve complete Spec identity
- [x] 5.11 Duplicate `specId` fixtures across owned and multiple Store sources navigate to the correct content

## 6. Project Workspace Surfaces

- [x] 6.1 Global shell distinguishes launch project from active planning root and exposes full Root Context on demand
- [x] 6.2 Dashboard metrics derive from the planning root and show root source, Store id, Reference health, and separately scoped Git facts
- [x] 6.3 Changes lists only writable-root changes and uses formal tracked progress for workflow state
- [x] 6.4 Change detail preserves CLI paths/context, adds `update`, shows Reference context, and renders strict validate/archive diagnostics
- [x] 6.5 Specs defaults to Owned and provides a Store-grouped Referenced view with immutable entries sourced from end-to-end pinned CLI 1.6 Reference enumeration
- [x] 6.6 Spec detail validates returned Store and Spec provenance, shows source/read-only state, disables mutation for References, and returns to the correct list scope
- [x] 6.7 Archive lists only writable-root archives, validates canonical Change identity before any CLI path, has one Server-owned strict mutation entry, cannot be reached through a generic CLI bypass, and tests diagnostics through that supported entry
- [ ] 6.8 Config implements Project Binding, Active Root Config, and Environment Global Config ownership sections
- [ ] 6.9 Project Stores route is replaced by Context with root, Reference, environment, and read-only registry diagnostics
- [ ] 6.10 Search defaults to the active root and offers an explicit Referenced Specs scope without referenced changes
- [ ] 6.11 Git makes repository scope explicit for status, history, worktrees, and every mutation
- [ ] 6.12 Terminal shows selected cwd/root identity in creation controls and tab labels
- [ ] 6.13 Settings exposes 1.6 compatibility, workflow/tool delivery, root selection, environment, and data-scope diagnostics
- [ ] 6.14 OPSX New/Propose/Compose/Verify/Update shows and preserves its target planning root
- [ ] 6.15 Notifications remain project-backend scoped and add root/context health without cross-backend record merging
- [ ] 6.16 Every network-triggering control binds loading/disabled state and every page covers empty/loading/loaded/updating/error topologies
- [ ] 6.17 List mutations and route changes preserve physical continuity through existing motion/View Transition patterns

## 7. Static Export Parity and Privacy

- [ ] 7.1 `ExportSnapshot` carries Root provenance, compound Spec identity, source/read-only state, observation time, and Reference policy state
- [ ] 7.2 Snapshot generation resolves the active planning root through CLI instead of assuming `OpenSpecAdapter(projectDir)` is root truth
- [ ] 7.3 Export CLI parses `--references=include|omit` with yargs and requires a choice when effective References exist
- [ ] 7.4 Include enumerates direct Reference Specs through `list --specs --store --json` and materializes bodies through `show --type spec --store --json`
- [ ] 7.5 Include never follows transitive References or serializes referenced changes, archives, config, Git, registry, or unrelated Stores
- [ ] 7.6 Any Reference resolution/list/show failure exits nonzero before a new partial snapshot/site is published
- [ ] 7.7 Omit exports owned Specs and a visible omission state without unpublished Store ids or Spec metadata
- [ ] 7.8 Snapshot serialization removes absolute project/Store paths, data-home/registry paths, remotes, `envUri`, host identity, and path-bearing raw diagnostics
- [ ] 7.9 Static provider, search, dashboard, detail caches, and SSG enumeration hydrate the shared Spec Catalog contract
- [ ] 7.10 Live/static parity tests cover Owned, Referenced, duplicate ids, include, omit, missing policy, failure atomicity, and redaction
- [ ] 7.11 Fresh SSG output renders compound routes correctly after cleaning stale artifacts

## 8. Hosted Environment and Access Protocol

- [ ] 8.1 Backend health separates protocol version, `apiBaseUrl`, server/CLI versions, Root Context summary, and optional capabilities
- [ ] 8.2 Backend issues opaque stable `envUri` for host identity plus effective OpenSpec data home without exposing either component
- [ ] 8.3 Required protocol version gates connection while optional capabilities gate only dependent surfaces
- [ ] 8.4 Capability vocabulary is limited to `stores.inspect`, `stores.mutate`, and `contexts.inspect` and carries no permission meaning
- [ ] 8.5 Inventory, Inspector, and project Context envelopes preserve upstream Store list/doctor/context facts and provenance
- [ ] 8.6 Context Matrix joins only currently observed online project contexts by `envUri` and Store id
- [ ] 8.7 Store mutation lifecycle is `accepted -> running -> succeeded | failed`, with lost terminal truth reported as `indeterminate`
- [ ] 8.8 Request ids deduplicate starts within one backend process; V1 exposes no Cancel and no automatic retry
- [ ] 8.9 `--auth` generates a high-entropy Bearer credential and prints the complete Authorization header
- [ ] 8.10 `--password` supports hidden prompt input and warns when inline values can leak through history/process inspection
- [ ] 8.11 Access Gate protects `/api/*`, HTTP tRPC, tRPC subscriptions, PTY WebSocket, files, terminals, notifications, and Store operations
- [ ] 8.12 Auto-launch credential fragment is consumed once and credentials never enter query parameters, persisted tabs, or `localStorage`
- [ ] 8.13 Non-loopback gated deployments clearly require HTTPS/WSS and never claim transport encryption
- [ ] 8.14 Protocol tests cover valid/invalid/missing credentials, reconnect, capability absence, multiple backends sharing one `envUri`, and environment separation

## 9. App and Experimental Store Manager

- [ ] 9.1 App Home/Connections persists backend entries without credentials and shows checking/online/offline/unsupported states
- [ ] 9.2 Add, reconnect, open, remove, and reorder actions preserve one tab per project backend
- [ ] 9.3 First-run App state connects the auto-launched backend or accepts another backend URL without a marketing page
- [ ] 9.4 Environment Center groups online backends by opaque `envUri` and shows connected projects, diagnostics, and capabilities
- [ ] 9.5 Environment-scoped operations require an explicitly selected online environment
- [ ] 9.6 Store Inspector owns Store identity, doctor evidence, and setup/register/unregister/remove controls
- [ ] 9.7 Context Matrix owns observed project-to-Root/Reference relationships and never claims machine-wide completeness
- [ ] 9.8 Inventory provides dense wide-screen registry scanning without becoming the only navigation model
- [ ] 9.9 Destructive remove names environment, host, Store, and checkout path and requires explicit confirmation
- [ ] 9.10 Mutation UI covers accepted/running/succeeded/failed/indeterminate, disconnect, and invalidation-driven refresh states
- [ ] 9.11 App implements no Store Git clone/pull/push/synchronization and no filesystem-wide project scan
- [ ] 9.12 Store Manager remains explicitly experimental and does not become an OpenSpecUI 6.0 support gate
- [ ] 9.13 Desktop/mobile layouts preserve readable data density, stable control dimensions, and non-overlapping content

## 10. Verification and Acceptance

- [ ] 10.1 Root matrix passes for nearest, declared Store, explicit Store, missing Store, and separated code/planning repositories
- [ ] 10.2 Reference matrix passes for none, healthy, unresolved, self, empty Store, and duplicate ids
- [ ] 10.3 Task matrix passes for tracked glob, fallback, no tasks, secondary checklists, and Apply divergence
- [ ] 10.4 Reactive matrix passes for two clients, external edits, registry mutation, reconnect, unregister, and watcher teardown
- [ ] 10.5 Access matrix passes across HTTP, tRPC WebSocket, PTY WebSocket, invalid credentials, and plaintext-deployment diagnostics
- [ ] 10.6 Static matrix passes for no References, include, omit, absent policy, incomplete include, route collision, and forbidden-value redaction
- [ ] 10.7 Project page unit/integration tests cover every surface in Section 6 and its loading lifecycle
- [ ] 10.8 App tests cover connection retention, `envUri` grouping, capability degradation, Store views, and mutation terminal states
- [ ] 10.9 Real-browser acceptance passes on desktop and mobile for project, static, and experimental App workflows
- [ ] 10.10 `pnpm --filter @openspecui/web build:ssg` passes from clean static artifacts
- [ ] 10.11 `pnpm format:check` passes
- [ ] 10.12 `pnpm lint:ci` passes
- [ ] 10.13 `pnpm typecheck` passes
- [ ] 10.14 `pnpm test:ci` passes
- [ ] 10.15 `pnpm test:browser:ci` passes
- [ ] 10.16 `loop/implementation.md` records each completed slice, focused evidence, and every approved divergence
- [x] 10.17 Every changed production file maintains the required timestamped orthogonal-intent/original-request header and every changed public contract carries an API comment

## 11. PR, Archive, and Release Gates

- [ ] 11.1 Each implementation slice uses a feature branch and a reviewable PR against protected `main`
- [ ] 11.2 Every publishable package change includes an accurate `.changeset/*.md`
- [ ] 11.3 Required local checks pass before each PR is opened or updated
- [ ] 11.4 Required GitHub PR checks pass before merge
- [ ] 11.5 All implementation checkpoints and acceptance evidence are complete before archive
- [ ] 11.6 OpenSpec verify/archive flow succeeds and the change leaves no unresolved tracked task
- [ ] 11.7 Final PR merge is approved and completed through branch protection
- [ ] 11.8 Manager is asked whether to release only after merge to `main`
- [ ] 11.9 If release is approved, changeversion PR, checks, auto-merge, `release.yml`, package publication, and tags all succeed before notification
