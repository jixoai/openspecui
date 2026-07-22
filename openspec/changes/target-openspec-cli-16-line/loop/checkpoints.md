<!--
Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
1. Track completed research and approval gates.
2. Sequence root, CLI, reactive, and projection implementation.
3. Track project, static, hosted, and App product surfaces.
4. Bind implementation tasks to objective verification.
5. Track PR, archive, merge, and release gates.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
Original request (2026-07-14): "我们最终使用openspec来管理 wayfinder 产出的文档。"
Original request (2026-07-16): "代码已经提交，开始review。如果有问题，那么可更新change甚至可以新开change。"
Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
Owner acceptance (2026-07-22): "单页：通过；多标签：通过。"
Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等。"
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

Config construction directives after `f2d1ddf`:

- Checkpoint `3.6` already establishes the Server ownership boundary. Checkpoint `6.8` must finish the product surface without inventing a second model: Project Binding mutates only Launch `store:`/`references:`, Active Root mutates only the CLI-selected Planning-root config, and Environment Global mutates only the backend runtime's CLI-owned global config.
- Treat config file presence and content as independent facts. An existing empty Active Root file remains editable and must never render the absent-file creation state. A transport/CLI error without data is not an empty config.
- Keep each ownership surface in a focused Config component with its own subscription, mutation state, and direct tests. Do not expand the already four-intent `routes/config.tsx` with another ownership implementation, and do not refactor the unrelated Schema workspace.
- Static mode may render the exported Active Root snapshot read-only. It must state that Project Binding and Environment Global are unavailable rather than synthesizing launch or runtime ownership.
- Implement and re-close only `6.8` (`58/131 -> 59/131`). Keep Context replacement `6.9`, the shared lifecycle checkpoint `6.16`, and every later surface open for their own apply slices.

Ninth-review correction directives after `731f684`:

- Reopen `3.5` and `6.8`. The Config slice is a root-dependent surface, so its Active Root mutations, Schema/Template mutations retained by the route, and typed Planning-root Update must use the shared `useRootActionState` gate. Preserve stale snapshots and drafts for diagnosis, but do not expose Edit, Save, Create, Delete, or Update execution while the current Root Context is loading, refreshing, transport-failed, or CLI-error.
- Keep Project Binding's repair path available when its Root Context preview is an OpenSpec warning/error state; that owner edits launch `store:`/`references:` and must not be confused with Active Root mutations. A subscription transport error with no current binding data is not an empty binding and must not unlock a write.
- Do not let `EnvironmentGlobalConfigSection` read profile/drift through an independent `cli.getProfileState` query while its typed environment-global subscription reads the same CLI config. Make profile/drift part of one reactive CLI-owned projection, or add a reactive subscription with the same invalidation contract; external config edits must update every displayed facet.
- Project Binding must render direct Doctor Reference evidence (Store id, root when present, and diagnostic severity/code/message) from `rootPreview`; do not infer health, completeness, or machine-wide coverage. Empty observed References must use the established observed-only wording.
- When Active Root is external and has a Store identity, state the objective shared-root consequence: edits write the Store-backed planning root and are observed by other projects resolving that Store. Do not enumerate or claim all affected projects.
- The Environment Global implementation currently carries projection, raw evidence, JSON editor, profile editor, runner/dialog, interactive terminal navigation, and static behavior in one 851-line file. Split only where it removes real divergent intent while keeping one physical Environment Global owner and one typed mutation boundary. Do not hide the reactive/profile or root-gate fix behind a cosmetic extraction.
- Add red evidence against `731f684` for stale Root Context actions, non-ready Update/auto-Update dispatch, stale profile/drift after an external config change, missing Reference diagnostics, and missing external-Store impact wording. A test that only renders the old button or manually calls a downstream handler is not acceptance evidence.
- Keep `6.9+` unstarted. This correction returns progress from `59/131` to `57/131`; re-close only `3.5` and `6.8` after focused tests, full gates, clean SSG, remote CI, and an independent review.

Tenth-review correction directives after `67cc14f`:

- Keep `3.5` and `6.8` open at `57/131`. The previous correction is not accepted merely because its focused suite is green; the following runtime gaps remain in the same Change.
- Environment Global refresh must hold a real pending lock through the asynchronous subscription rebind. `refresh()` currently only changes a dependency key and returns `void`; do not clear a local `isRefreshing` flag in the same synchronous turn. Drive the disabled/loading state from the subscription lifecycle (or an explicit completion signal), and test that a second Refresh and JSON Save are blocked until the new projection arrives.
- The explicit refresh completion signal must resolve after the replacement projection is committed, not merely from inside the transport callback; otherwise awaited Profile Apply can observe a stale `projectionLockedRef` and silently skip its permitted auto-Update. Cover ready Apply + successful rebind + second-operation dispatch.
- Treat every stale/error Environment Global projection as display-only. Gate the parent JSON editor's Save, Revert, keyboard shortcut, and mutation function, plus an already-open Profile/Update dialog's confirmation handler and button. Re-check the current projection/root gate immediately before each independent operation; do not rely only on the state captured when a dialog opened.
- Preserve a local exit from Active Root editing when the Root Context becomes blocked. Keep Cancel visible and usable to discard a dirty draft; keep Save disabled and the editor read-only until a current ready root returns. Add a ready -> blocked rerender test rather than only an initial blocked render.
- Match OpenSpec's effective profile semantics. `profile: core` always projects the pinned CLI core workflow set (`propose, explore, apply, update, sync, archive`) instead of trusting a raw omitted, empty, or malformed `workflows` field; `profile: custom` uses its explicit list or remains empty. Preserve the raw payload separately, but make the Profile editor initialize and compare its workflow selection against the effective projected list, not raw `config.workflows`; otherwise a server-only correction still presents a valid omitted-core configuration as empty. Add server/core contract tests and Web projection tests for omitted and explicit-invalid defaults.
- Strengthen counterexample evidence at `67cc14f`: tests must exercise the real component mutation function/handler and prove the mocked tRPC transport was not called. A `useMutation` stub, a disabled-button assertion, or a direct downstream handler invocation is characterization only. Cover Active Root dynamic block, Environment Global stale editor/dialog, Schema/Template blocked mutation, and ready -> blocked Update/auto-Update.
- Active Root's ready -> blocked test must invoke the real Save mutation boundary (not only assert a disabled Save button) and prove `writeActiveRoot` was not called; retain the local Cancel assertion separately.
- The Schema/Template evidence must cross at least the shared `writeSchemaFile` mutation boundary as well as schema initialization; a single `initSchema` case does not prove the route's file-write path is gated.
- Mutation-boundary tests must rerender with a new blocked Root Context object; in-place mutation of a previously returned mock can mask stale closures. Schema/Template and Active Root Save owners must read current readiness at the actual mutation boundary, not rely on an old render's captured gate.
- Browser QA initially flagged an enabled Apply confirmation during Root Resolving. Independent ownership review rejects that as a bug: Environment Global Apply is runtime-environment scoped and must remain writable when its projection is current. Keep the Root Action gate on direct Update and the post-Apply auto-Update only; add evidence that Apply writes global config and reports the skipped second operation while Update confirmation is disabled.
- Avoid duplicating the drift parser introduced in `planning-config-service.ts` beside the existing `router.ts` implementation. Extract or reuse one typed server helper so Settings and Config cannot silently diverge.
- Do not start `6.9+`, merge, archive, or release. Re-close only `3.5` and `6.8` after red/green evidence, full local gates, clean SSG, remote CI, and another independent review.

Twelfth-correction review evidence after `e4ef2ad`:

- The exact `67cc14f` overlay audit now records the stale Environment Global dialog failure (`toBeDisabled` received an enabled button), plus the inherited Core-default, stale-editor, retained-error, refresh-window, Apply/Update dialog, and Active Root transition failures. The `writeSchemaFile` route test passed at `67cc14f`; it is coverage of an already guarded route, not a claimed red production defect. A detached-worktree dependency-link failure prevented a claim about the refresh-hook test and is recorded as harness-only.
- The later `d7631f0` red run isolates the visibility regression introduced by the dialog gate: blocked-root Apply was disabled, so it could not reach the global write boundary. `e4ef2ad` restores the runtime-environment ownership split and adds the real handler recheck for direct Update.
- Local verification after `e4ef2ad` is complete: format, lint, all 15 typechecks, full unit suites, clean SSG, browser suites, and diff check pass. PR #207 was then pushed at `4a3e40a`; all six remote checks and aggregate Browser Gate passed. The independent review may now close only `3.5` and `6.8`; keep `6.9+` untouched.

Independent review acceptance after `4a3e40a`: `3.5` and `6.8` move from open to closed, progress `57/131 -> 59/131`. This acceptance does not authorize merge, archive, release, or implementation of `6.9+`; PR #207 remains open for maintainer decision.

## 6.9 Worker Slice: Replace Project Stores with Context

Current state at `b6f48e6`: `/context` already projects Root Context, direct Reference diagnostics, data scope, and full CLI evidence in live/static route trees. The project WebUI still exposes a separate `/stores` route, Stores nav item, visibility hook, and project-only Stores subscription. This is incomplete 6.9 behavior because Context must replace the project Stores surface rather than coexist with it.

Approved worker boundary:

- Remove `/stores` from project Web live/static route trees, nav/controller route sets, and sidebar/mobile visibility logic. Retire the Web `StoresList` presentation only when no production caller remains.
- Keep backend `stores.list`/`stores.doctor`, Store CLI contracts, Store observation, and App-native experimental Store Manager intact. They are environment/App capabilities, not the project Context surface.
- Preserve Context's root, direct Reference diagnostics, environment/data-scope evidence, read-only registry wording, full command evidence, and loading/stale/error/empty states. Do not infer completeness, health, ownership, or machine-wide references.
- Add route-registration and Context behavior evidence; do not accept tests that merely assert a hidden/disabled Stores button while `/stores` remains reachable.
- Keep `6.10+` untouched. Close only `6.9` after focused tests, local gates, browser walk-through, and independent review (`59/131 -> 60/131`).

Independent review after `8dea750` keeps `6.9` open at `59/131`:

- The stale-error Context says the failed CLI attempt is retained, but renders only the last successful Root Context. The failed attempt's root, Store, Doctor/Context exit status, stderr, contract drift, and diagnostics are absent. Rendering a stale root plus explanatory copy is not evidence preservation.
- The new stale-error fixture is not type-correct: independent `pnpm typecheck` fails at `packages/web/src/routes/context.test.tsx:113` because `RootContextError` requires `code`, not `kind`. Focused Vitest transpilation passing `48/48` cannot discharge a TypeScript contract.
- The existing Web changeset still describes Context as additive and coexisting with Stores. Release evidence must instead state that Context replaces the project Stores surface and `/stores` is removed.
- Navigation-array assertions do not exercise the actual `MobileTabBar` live/static branches. Add component-level evidence that Context renders and an obsolete `/stores` value cannot render in either branch.
- All retained changed TS/TSX headers use synthesized English `Original request` lines; two contain `...`. Replace them with an exact user quote and record checkpoint 6.9 separately as a derived requirement. Header provenance is evidence, not decorative prose.

The removal boundary itself is correct: Web production has no `/stores`, `StoresList`, `useStoresVisibility`, or `useStoresSubscription` caller, while Server Store procedures, Core Store contracts/observation, and App Store Manager remain. No `6.10+` scope creep was observed. Correct the evidence/UI gaps above, rerun local gates, and return for another independent review before checking `6.9`.

Independent acceptance after `11df4ae` closes `6.9` (`59/131 -> 60/131`):

- Standards and Spec re-reviews report no findings. Stale successful Context and the current failed attempt are now separately named and rendered; the failed attempt retains root/source/Store, CLI availability, Doctor/Context process evidence, contract drift, stderr, and diagnostics. The no-stale path renders the failed attempt exactly once.
- The fixed-point component counterexample fails against `8dea750` because the stale/attempt regions and failed-attempt evidence are absent, then the focused matrix passes `6 files / 51 tests` at `11df4ae`. The typed `RootContextError.code` fixture passes Web and all-workspace typechecks.
- The project Web `/stores` route, navigation identity, visibility hook, presentation, and project-only subscription are absent; `/context` remains registered live/static. Server/Core/App Store capabilities remain intact. The changeset and all 12 retained/new TS/TSX headers now match the accepted contract and provenance law.
- Full local format, lint, 15-package typecheck, unit, clean SSG, xterm browser (`60 passed / 1 skipped`), Web Storybook (`12/12`), and diff gates pass.
- Agent-browser confirms live desktop/mobile Context facts and neutral read-only copy, no Stores navigation or mutation controls, `/stores` canonical redirect to Dashboard, static Context pending state without live root/registry truth, and mobile `scrollWidth == clientWidth == 390`. Screenshot capture is unavailable because agent-browser 0.27.1 reports zero-height fixed-layout roots; snapshot/text/DOM evidence is retained honestly instead.

This acceptance does not authorize `6.10+`, merge, archive, or release. The duplicated project-route universe remains recorded, deferred architecture debt.

## 6.10 Worker Slice: Source-scoped Project Search

Current state after `11df4ae`: the live SearchService is already owned by the current Planning-root service record, and both live/static search documents preserve compound Referenced Spec links. The remaining gap is source isolation: one undifferentiated index/query mixes active-root Specs, Changes, Archives, and Referenced Specs, while Search exposes no explicit scope.

Approved worker boundary:

- Add one typed project-search scope with exactly `active-root | referenced-specs`. Search defaults to `active-root`; only an explicit sibling control and URL state selects `referenced-specs`.
- Carry document scope through the shared `@openspecui/search` schema/types, Node/Web worker protocol, engine, Server documents, static documents, query/subscription, hook, hits, and route. Scope filtering must occur before scoring and limit; client-side filtering of an already limited mixed result is insufficient.
- `active-root` contains only the current Planning root's Owned Specs, Changes, and Archives. `referenced-specs` contains only direct read-only Referenced Specs with compound Store identity and never a Change or Archive.
- Preserve live/static parity. Static Referenced scope shows only References actually materialized in the snapshot; absence uses neutral observed/available copy and never implies machine-wide completeness.
- Scope changes must clear or correctly attribute prior results while the replacement request is loading; an active-root Change must never remain visible under the Referenced Specs control.
- Keep SearchService Planning-root ownership, reactive rebuild, duplicate Spec identity, navigation/View Transitions, and existing fallback behavior intact unless the typed scope contract proves a narrower correction is required. Do not start Git `6.11`, static export policy `7.*`, App/Store Manager, or Worksets.

Required evidence includes engine filtering-before-limit tests, live Server document scope and Router pass-through, static document scope, Web hook request/scope-transition tests, SearchRoute default/URL/control/empty/loading/error/navigation tests, and duplicate owned/referenced `specId` fixtures. Close only `6.10` after full local gates, clean SSG, browser suite, agent-browser live/static desktop/mobile walk-through, and independent review (`60/131 -> 61/131`).

### 6.10 Independent Review Correction after `bc09a3f`

Checkpoint `6.10` remains open at `60/131`. The engine, generated Node worker, Server query/subscription, Web scope switch, URL tabs, and compound live navigation pass focused tests, and the complete local format/lint/typecheck/unit/SSG/browser gates pass. That green baseline does not close the following contract defects:

1. **Legacy Search fallback breaks source isolation.** When `search.subscribe` is absent, `useSearch` calls the legacy `search.query` with `scope`. The legacy input schema does not recognize that field and searches the mixed index before applying `limit`, so either selected source can display the wrong documents. Missing source-aware subscription support must fail closed; no browser filter or legacy query may claim scoped truth.
2. **Static Reference evidence bypasses the current snapshot contract.** `static-data-provider.spec.test.ts` injects Referenced Specs with `as never`, while `ExportSnapshot.specs` permits only `OwnedSpecIdentity`, `source: 'owned'`, and `readOnly: false`. The test and production Reference branch therefore prove a future `7.*` snapshot rather than current 6.10 behavior. Delete the escape and unreachable branch. Under 6.10, legal static snapshots expose only Active-root documents; Referenced scope is a neutral empty result until the explicit 7.\* include policy materializes References.
3. **First reactive Search can observe an empty uninitialized index.** `queryReactive()` calls `rebuildIndex()` while `initialized` is false; `rebuildIndex()` returns without collecting documents, then the provider searches its empty index. Background startup warmup is explicitly deferred and cannot authorize this ordering assumption. Initialize from current Planning-root truth before the first reactive search, without double rebuilding an already initialized provider.
4. **Required page-state evidence is absent.** `SearchRoute` has no direct tests for Active-root empty, Referenced empty, loading, or error presentation. Static Referenced-empty behavior is not exercised from a legal snapshot, and the scope-transition test does not assert retirement of the old subscription. Add direct tests at those boundaries.

Correction law:

```text
missing source-aware backend -> explicit incompatible error, zero legacy query
legal current snapshot       -> owned/change/archive only -> Reference search []
first reactive query         -> collect/init current index -> search
scope A -> scope B           -> unsubscribe A -> clear A -> subscribe B
```

Do not make generic Search scope mandatory for unrelated consumers. At the project Search boundary, however, every accepted document and returned hit must retain one exact `active-root | referenced-specs` scope; do not let optional generic provenance silently become an unscoped project result. Do not start `6.11`, `7.*`, or a shared live/static Reference mapper before the real snapshot union exists.

### 6.10 Second Independent Review after `121d405`

Checkpoint `6.10` remains open at `60/131`. The correction closes the unsafe legacy fallback, illegal future static fixture, first-reactive initialization, project-hit provenance, hook transition, and page-state gaps. Two remaining defects prevent acceptance:

1. **The URL is not the first-render source authority.** `SearchRoute` derives `locationScope`, then passes a duplicated local `scope` to `useSearch` and reconciles it only in a passive effect. On browser history or another external location change from A to B, the first render still requests and can expose A before the effect selects B. The hook's mismatch guard cannot help because the Route still passes A. A direct fixed-point harness records post-navigation scope calls `['active-root', 'referenced-specs']`; the required contract is B from the first render.
2. **The Search type header reverses the approved optionality boundary.** Generic Search documents/hits may omit scope, but project documents/hits require exact provenance. `packages/search/src/types.ts` currently says project-owned consumers preserve optional scope, contradicting its public project types, this Change, and repository law.

Second-correction construction directives:

```text
external URL A -> B
        |
        v
render-time URL authority -> request/render B only
        |
        v
retire A subscription/hits before any B commit
```

- Remove the duplicate Route scope authority. A `useEffect` or `useLayoutEffect` that first renders/calls `useSearch` with A and repairs to B later is insufficient. User editing/debounce state may remain local, but the selected source must be derived from the current URL during render.
- Add one same-mount Route counterexample proven red at `121d405`: start with A and A hits, externally change `location.search` to B, rerender, and prove every new `useSearch` invocation is B, B is selected immediately, and no A result survives. A final-DOM-only assertion is too weak because testing effects may hide the incorrect intermediate call.
- Correct the `types.ts` intent header to state the exact generic-optional/project-required split. Do not weaken `ProjectSearchDocument`, `ProjectSearchHit`, their schemas, or Server/Web runtime validation.
- Preserve all accepted first-correction behavior and its red/green evidence. Do not expand into generic route-state refactoring, keyboard/tab redesign, SearchService ownership, Reference body materialization, `6.11`, or `7.*`.
- Keep `6.10` unchecked until focused tests, full local gates, clean SSG, browser suite, independent live/static desktop/mobile history walk-through, and another independent review pass.

### 6.10 Third Independent Review after `5204c55`

Checkpoint `6.10` remains open at `60/131`. The uncommitted URL-authority candidate and its fixed-point red test are correct, but the complete checkpoint is not yet acceptable or delivered:

1. **Critical Server evidence is not type-checked.** The new Router query/subscription evidence constructs Planning-root Context and service records through `as never`. The SearchService first-reactive/provenance evidence also uses `adapter as never` and a non-null assertion over mutable fake results. `packages/server/tsconfig.check.json` excludes tests, so passing Vitest and workspace typecheck do not prove those public owner/Adapter contracts. Replace the escapes with typed reusable fixtures, retain the real `appRouter -> Planning-root operation -> SearchService` path, and explicitly type-check the fixture path. Do not weaken production contracts.
2. **The complete checkpoint is not on PR #207.** Local HEAD `5204c55` is five commits ahead of remote/PR SHA `10a3b42`, and the URL-authority correction remains dirty. The six green remote checks apply only to `10a3b42`; they are not final checkpoint evidence.

The current candidate passes focused Search `6/6`, Server `14/14`, and Web `19/19`, plus local format, lint, 15 workspace typechecks, full unit suites, clean SSG, xterm browser `60 passed / 1 skipped`, Web Storybook `12/12`, and `git diff --check`. These results validate current behavior but cannot discharge the typed-fixture or delivery blockers. Preserve the candidate, correct the fixtures, commit and push all 6.10 work, wait for checks on the exact final SHA, and stop for independent review. Do not start `6.11` or `7.*`.

### 6.10 Fourth Independent Review after `78c925c`

The typed-fixture correction and URL-authority correction are behaviorally accepted by the independent Standards/Spec review. No new runtime Search finding was identified: engine and generated worker filtering precede scoring/limit, project provenance is exact, the static snapshot remains legal Owned-only truth, missing `search.subscribe` fails closed, and the same-mount URL A -> B test uses the URL as render-time authority.

One P1 delivery blocker remains:

1. **The accepted checkpoint is still local-only.** `HEAD=78c925c` is seven commits ahead of `origin/feat/openspec-cli-16-contract-baseline`, and PR #207 still points at `10a3b42`. The worktree is dirty in reviewer-owned `AGENTS.md`, `i18n.zh.md`, `loop/checkpoints.md`, and `loop/implementation.md`. Therefore no final-SHA CI, local/remote/PR equality, clean-worktree proof, or final Search browser evidence can be cited. The existing six green PR checks are evidence only for `10a3b42`.

Keep `6.10` open at `60/131`. The next worker must deliver the complete local checkpoint and exact final-SHA evidence, then stop for independent review. Do not start `6.11`, `7.*`, Store Manager, Workset, merge, archive, or release. The optional lack of a direct Router/Service assertion that a Referenced query excludes Changes/Archives is not a runtime finding because the typed engine and worker filtering tests cover the source boundary; add such a test only if it is needed to make the final evidence executable, without widening the checkpoint.

The independent browser attempt confirms the desktop source control and URL/query behavior but does not complete acceptance. Live `http://localhost:13003/search?query=auth` normalized into the pop route, selected Active root, preserved `auth`, and immediately selected Referenced Specs with the expected URL and placeholder. Search then remained in `Searching...` because `rootContext.get` timed out while a backend OpenSpec instructions command did not settle. The SSG bundles built, but a subsequent HTML export failed during `Pre-rendering pages...` with `document is not defined`. No result-list, same-mount stale-result, compound Reference, mobile-geometry, or static-browser claim is accepted from this run. These are un-attributed acceptance blockers, not yet proven Search regressions; reproduce them with exact stack/CLI evidence and a controlled fixture before changing production code.

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
- [x] 6.8 Config implements Project Binding, Active Root Config, and Environment Global Config ownership sections
- [x] 6.9 Project Stores route is replaced by Context with root, Reference, environment, and read-only registry diagnostics
- [x] 6.10 Search defaults to the active root and offers an explicit Referenced Specs scope without referenced changes
- [x] 6.11 Git makes repository scope explicit for status, history, worktrees, and every mutation
- [x] 6.12 Terminal shows selected cwd/root identity in creation controls and tab labels
- [x] 6.13 Settings exposes 1.6 compatibility, workflow/tool delivery, root selection, environment, and data-scope diagnostics
- [x] 6.14 OPSX New/Propose/Compose/Verify/Update shows and preserves its target planning root
- [x] 6.15 Notifications remain project-backend scoped and add root/context health without cross-backend record merging
- [ ] 6.16 Every network-triggering control binds loading/disabled state and every page covers empty/loading/loaded/updating/error topologies
  - `6.16-A` accepted: Root Context cached-display/current-authority correction and exact lifecycle reds.
  - `6.16-B` accepted: bounded detail-navigation phase timing names only observed facts, preserves
    superseded-request history, and keeps hostile runtime failures total without replacing rejection.
  - `6.16-C` accepted: live Settings has no artificial mount gate; cached Config owns first-render writable
    drafts; Terminal drafts synchronize per upstream field value, so value-equal emissions preserve dirty
    input and a changed field converges alone. Archive remains a separate following package.
  - `6.16-D` accepted: ArchiveList no longer adds an artificial rAF gate; synchronous real-component
    evidence renders resolved data immediately and preserves the initial unknown-data Loading branch.
    Error projection is accepted separately in 6.16-E; updating still requires shared lifecycle work.
  - `6.16-E` accepted: real no-data and retained-data Archive transport errors render raw alert evidence
    without false empty or current-success claims; retained rows and hrefs remain visible. Archive updating
    remains blocked on a shared production subscription signal; a component-only `data + isLoading=true`
    mock is not acceptance evidence.
  - `6.16-F1` accepted: raw streams remain unchanged; opt-in Core/Server lifecycle ordering has deferred
    start-before-data, coalescing, abort owner-retirement, rejection/no-complete, and checked-test evidence.
    No Router or Web consumer migrated in this package.
  - `6.16-F2` accepted: only Archive uses the typed event helper; retained `[]` during Updating renders only
    the Updating fact, while the ordinary current-empty copy remains available after settlement. The exact
    empty-branch guard has direct mutation evidence; independent Web focused tests pass `21/21`.
  - `6.16-G` accepted: ChangeList keeps rows/tracked progress visible, limits Loading to initial no-data
    Status, renders settled no-match as unavailable, and reports one page-level raw Status error while every
    row terminates as unavailable. Independent ChangeList `7/7` and Web typecheck pass.
  - `6.16-H` accepted: Context terminal transport/projection error suppresses only the unresolved Loading
    presentation while preserving the raw alert and every Root Context authority/evidence contract.
    Independent Context `11/11` and Web typecheck pass.
  - `6.16-I` accepted: direct Referenced-scope component evidence proves Catalog and Store alerts coexist,
    while no-Reference and ready-Store empty claims remain suppressed during Catalog transport error. Four
    named mutations prove both Referenced empty guards and both alert owners; the production owner is
    unchanged. Independent SpecList `10/10` and Web typecheck pass.
  - `6.16-J` accepted: ChangeList exposes its main terminal error without false Loading, blank, or
    active-empty conclusions; retained rows/progress/links/current Status evidence remain visible. Three
    named mutations prove its main alert, error-aware list frame, and active-empty guard independently.
    This remains independent of the accepted 6.16-G Status subprojection. Independent ChangeList `11/11`
    and Web typecheck pass.
  - `6.16-K` planned: Config Schema Read/Edit file-panel topology consumes only the independent
    `schemaFiles` projection. Initial no-data loading, terminal no-data error, retained non-empty error,
    retained-empty error, and current empty success require direct FileExplorer-path evidence. Preview,
    `configBundle`, templates, template contents, Root gating, mutations, Router, and static behavior are
    outside this package.
  - Before another page adopts projection lifecycle events, extract the duplicated generic generation/cache
    owner from the 672-line `use-subscription.ts`; do not add a third subscription state machine.
  - Keep 6.16 open until subscription/Root timing, detail-prefetch policy, artificial route-gate, and
    page-topology packages have their own evidence.
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

### 6.10 Fifth Independent Review: SSR Boundary Correction and Live Fixture Attribution

Checkpoint `6.10` remains open at `60/131`. The accepted Search implementation at `78c925c` remains unchanged; the only production correction is the proven static SSR boundary needed to exercise static Search.

The static blocker is a production defect, not stale output:

- At fixed point `78c925c`, adding only the Node SSG import/render test and the Node-safe test setup produced `1 failed / 1 passed`; the import failed at `view-transitions-toolkit/dist/feature-detection.js:6:21` (`sameDocument: !!document.startViewTransition`) before routes or snapshot data were evaluated.
- The candidate removes top-level imports of the browser-only feature-detection/tracker modules, gates tracker loading on a real browser `document.startViewTransition`, dynamically imports the tracker, and awaits that shared install promise before the first native transition. `misc` remains a safe static import.
- The fixed candidate passes the runtime and Node SSG suite (`2 files / 8 tests`), Web typecheck, clean `build:ssg` and `build:ssg-cli`, and the actual SSG CLI pre-renders all 10 fixture routes (11 `index.html` files including the fallback).
- Full `pnpm test:ci` on `9d366dc` passed with `270 files / 1741 tests` (Core `47/440`, Server `47/360`, Web `117/699`, CLI `11/49`, and all remaining workspace lanes green).

The live Search blocker is fixture/environment state, not a Search regression:

- The fixed-point legacy example's configured runner was `npx @fission-ai/openspec`, not a pinned local OpenSpec 1.6 executable, and its generated fixture lacked a valid OpenSpec config.
- With `pnpm dev:legacy --dir ./example --port 4123`, `curl --max-time 15 http://localhost:4123/trpc/rootContext.get?input=%7B%7D` returns no bytes and exit 28. The process tree shows `npm exec @fission-ai/openspec doctor --json` still running at the timeout; the server records `CLI runner resolve timed out` in `planning-root-service.ts:458`. This cannot establish a Search result-list or cross-source transition claim.

The candidate is not yet delivered: code commit `9d366dc` exists only locally, while reviewer-owned Change documents remain dirty; local HEAD is eight commits ahead of PR #207 and no exact-final-SHA CI exists. A real live/static desktop and 390x844 mobile browser walk-through remains required after using a terminating pinned-CLI fixture; absent References or results must be reported as limitations. Keep `6.10` unchecked and do not start `6.11+`, merge, archive, or release.

Static browser evidence now covers the candidate's actual rendered output. The generated static fixture at `/tmp/openspecui-ssg-render.Md31zL` shows three Active-root `auth` results on desktop, preserves query while switching to Referenced Specs, adds the encoded `scope=referenced-specs`, rejects stale A results after same-mounted `pushState` A -> B, preserves query/scope on B edits, falls back to Active root for an invalid scope, renders the Active empty state, and navigates an Owned hit to `/specs/owned/auth`. Real `390x844` Active/Referenced Search and mobile navigation report no horizontal overflow or overlap. Screenshots are recorded in `loop/implementation.md`.

Live browser acceptance remains explicitly partial: the example backend lacks `openspec/config.yaml|yml` and stays in `Searching...`; a minimal Root-ready fixture returns HTTP `search.query=[]` but its browser subscription is not stable. No live results, live stale/error/empty transition, live compound Reference, or live result-navigation claim is made. Target browser sessions and ports were closed.

The official browser gate on `9d366dc` passed with xterm `6 files / 60 passed / 1 skipped` and Web Storybook `4 files / 12 passed`, without retries; `git diff --check` passed as well.

### 6.10 Sixth Independent Review and Delivered Evidence at `998acd9`

The independent Standards and Spec axes report no remaining runtime or documented-standard defect in the accepted Search contract or the narrow SSR correction. Code commit `9d366dc` fixes the proven static server import failure without changing the accepted Search source model; evidence commit `998acd9` records the red/green, local gates, browser walk-through, and limitations.

At delivery, local HEAD, the remote feature branch, and PR #207 head all resolved to `998acd983ef3d2b1e829c9046292a2488a60d3b1`; the worktree was clean and the PR remained `OPEN/CLEAN`. Changeset Gate, CI Scope, Fast Gate, Web Browser Gate, xterm Browser Gate, and aggregate Browser Gate all passed for that exact head. No merge, archive, release, or `6.11+` work occurred.

Keep `6.10` open at `60/131` for the next independent decision. Static desktop/mobile acceptance is complete; the recorded live fixture/subscription limitations remain objective unknowns rather than fabricated green evidence.

### 6.10 Seventh Independent Review: Per-Subscriber Dependency Loss

Checkpoint `6.10` remains open at `60/131`. Standards, typed Search fixtures, source isolation, URL authority, SSR, focused tests, exact-head CI, and uncontended live Search are green at `8e7cc76`, but one P1 reactive ownership defect remains.

`SearchService` shares `initPromise` and `rebuildPromise` across background warmup and independent `ReactiveContext` subscriptions. Only the context executing the physical document reads collects dependencies. A waiter receives its first value without dependencies, its stream ends, and the next file settlement cannot wake it. Direct fixed-point red evidence proves both the warmup race and the two-subscription race; in the latter only the subscription that created the rebuild receives the next emission.

The buffered `search.query` also remains warmup-cached: a controlled external Owned Spec edit was absent from the query response until a subscription rebuilt the provider. This violates current Planning-root truth even though a single uncontended live subscription passes.

The next apply slice must collect current documents separately inside every query/subscription caller context, then serialize provider init/replace/search without sharing dependency-bearing reads. It must add checked warmup-race, two-context, buffered-query freshness, and public multi-client evidence whose assertions fail when caller-local collection is removed. Keep `6.11+`, merge, archive, and release untouched.

### 6.10 Eighth Independent Review: Provider Failure Recovery Evidence

The `f72e03a` correction is behaviorally accepted for caller-local dependency collection, current buffered truth, provider snapshot serialization, physical two-client convergence, disposal admission, and watcher cleanup. Standards found no hard violation; Server Search `20/20` and `typecheck:search-tests` pass independently.

Checkpoint `6.10` remains open at `60/131` because the provider queue's rejection recovery is not mutation-resistant. The lifecycle test exercises only delayed success. Removing the rejection branch that resets `providerOperationTail` still leaves all new tests green, even though every later query would inherit the failed tail. Add a checked fail-first provider test that proves later buffered/reactive operations recover, disposal occurs once, and post-disposal admission fails; prove the exact test fails when rejection recovery is removed. Then rerun final focused/full/browser/delivery evidence on the corrected head. Do not start `6.11+`, merge, archive, or release.

### 6.10 Ninth Independent Acceptance: Reactive Search Closed

Checkpoint `6.10` is complete at `61/131`. Runtime commit `f72e03a` gives every buffered/reactive caller its own current document collection and serializes provider apply plus search; test commit `dd3307a` makes the queue's rejection recovery mutation-resistant. The exact failure-recovery test passes normally, fails with `1 failed` plus two unhandled rejections when the rejection branch is removed, and passes again after byte-for-byte restoration.

Final local evidence passes Server Search `21/21`, Search `6/6`, Web Search/SSR/static `27/27`, checked Search fixtures, format, lint, 15 workspace typechecks, full unit `270 files / 1748 tests`, clean SSG, xterm browser `60 passed / 1 skipped`, Web browser `12/12`, and `git diff --check`.

A pinned OpenSpec 1.6 fixture uses submodule SHA `e1b51d1`, isolated `XDG_DATA_HOME`, declared Store `team`, and direct Reference `platform`. Before any browser subscription, a buffered query observes an external Owned Spec write. Two independent desktop/mobile clients then keep one query and converge after another external write without reopen or query change. Active results contain only Owned Spec, Change, and Archive; Referenced results contain only the Store-qualified read-only Spec. Both clients navigate to `/specs/referenced/platform/auth`; desktop and real `390x844` layouts have no horizontal overflow. Browser warmup overlap remains deterministic Router/ReactiveContext evidence, and loading/error remain unit-covered rather than fabricated live claims.

At delivery, local HEAD, remote feature branch, and PR #207 head all equal `6d5a67a73b93f24adce3384462e284e80a07ae9a`; the PR is `OPEN/CLEAN`, and Changeset, CI Scope, Fast, Web Browser, xterm Browser, and aggregate Browser checks all pass on that exact head. This unlocks checkpoint `6.11` planning only. Merge, archive, and release remain forbidden.

### 6.11 Research: Stale Repository Binding

Checkpoint `6.11` remains open at `61/131`. The existing fixed-root implementation correctly distinguishes Code from a truly distinct Planning repository and carries `code | planning` through status, history, detail, patch, refresh, removal, and handoff. It has three deterministic A -> B lifecycle defects:

1. `git.scopes` is a one-shot query under fixed Web key `['git', 'scopes']`; it does not follow Root Context A -> B or B -> Code automatically.
2. Even after scopes is manually refreshed to B, overview/history/detail/patch keys contain only `planning`. Cached A content can remain visible while the UI labels the repository path as B.
3. Every Server request resolves the current Planning root. An old A Refresh has no expected binding identity and is therefore reinterpreted as a B Refresh, invalidating/touching B instead of rejecting stale intent.

Removal and handoff currently re-enumerate B worktrees and normally reject an A-only physical path before destructive execution, so no P1 escape is claimed. They still need the same typed stale-binding conflict as every other Git operation. Add reactive scope inventory, a backend-issued binding epoch, Server-side expected-token comparison inside the active owner lease, token-aware Web keys, and a current Root/projection gate for Planning controls. Preserve Launch-owned Code Git and the no clone/pull/push/synchronization boundary.

### 6.11 Implementation Candidate at `bbc22a5`

The implementation candidate is pushed to PR #207 as `bbc22a5091be829417ff5753c924aa2aad73e565` (`fix(git): reject stale repository bindings`). It remains an independent-review candidate: progress is `61/131`, task `6.11` is unchecked, and `6.12+`, merge, archive, and release are untouched.

Accepted candidate facts:

- Backend-issued opaque `bindingToken` is attached to every Code/Planning descriptor. Code is stable for the backend instance; each Planning-root service activation receives a fresh token, including A -> B -> A.
- Reactive `git.subscribeScopes` follows Root Context ownership. Every Git query/mutation carries `scope + expectedBindingToken`; Server compares the token inside the active Planning lease before any repository resolution, cache invalidation, refresh stamp, worktree removal, or handoff. Mismatch is a typed `CONFLICT`.
- Web keys and View Transition prefetch include semantic scope plus token. URL state remains only `gitScope`; stale Planning content is retired and controls lock during Root loading, stale refresh, failure, or scope/root mismatch. Code Git remains usable independently.

Evidence:

- Real Manager-owned Code/A/B fixture emits A -> B -> Code -> A with A retirement before B, stable Code token, and fresh Planning tokens. Stale A refresh/remove/handoff owners do not run after B activation; current B refresh succeeds.
- Mutation-resistance is direct: removing only Planning-lease `assertCurrent` changes the stale Refresh result to B stamp/cache invalidation (`received true`, `expected false`); restoring it passes the checked Router test. This is not a disabled-button characterization.
- Focused checks pass: Server `49 files / 374 tests`, Web Git `6 files / 49 tests`, Core `47 files / 440 tests`, checked Git fixture typecheck, format (25 changed files), lint (`832`, zero warnings/errors), 15 workspace typechecks, and `git diff --check`.
- Full local evidence passes: `test:ci` `272 files / 1763 tests`, clean SSG, xterm browser `60 passed / 1 skipped`, and Web browser `12/12`. The pre-commit Vite+ staged hook is unavailable because `vite.config.ts` has no staged config; after the listed gates passed, implementation was committed with `--no-verify`.

Live agent-browser evidence is unavailable: the Code/A/B desktop and real `390x844` attempts stalled without a terminating inspectable process/evidence set. Do not promote that attempt to acceptance. Independent re-verification must cover desktop/mobile scope transitions, stale-content retirement, conflict feedback, scoped history/detail/back/patch, and no overflow. Keep `6.11` open at `61/131` until that review completes.

### 6.11 Independent Review Blockers at `62cf6f2`

The candidate remains at `61/131`; `6.11` is not accepted and `6.12+` remains untouched.

- **Code continuity is incomplete.** The combined scope resolver waits for the Planning-root manager before emitting Code. A pending or hung Root transition therefore blocks the Code scope subscription, Git status/history, and Dashboard Code-token helpers. Split the Launch-owned Code descriptor/token path from Planning resolution, or provide an equivalent server-owned projection that emits Code and serves Code operations before Planning settles. Prove this with a deferred manager fixture that keeps Planning unresolved while Code overview/list/history and Dashboard refresh complete.
- **Handoff provenance is incomplete.** Git list/detail handoff state contains no origin `bindingToken`; detail captures the current token and self-validates it. Carry the origin token through the typed Git handoff and View-Transition preparation. When A is handed off and B is current, reject the handoff and do not render A title/subtitle or prefetch the selector under B. Add a same-mount A-click -> B-rebind test that fails against `bbc22a5` before asserting the corrected behavior.
- **Browser acceptance is still missing.** Use a terminating pinned OpenSpec 1.6 fixture and record real desktop plus `390x844` evidence for Code default, distinct Planning selection, A -> B, B -> Code, A -> B -> A, stale-content retirement, conflict feedback, scoped history/detail/back/patch, and horizontal geometry. A stalled session or unit-only evidence does not close this gate.

The worker must update `loop/implementation.md` with exact red/green and mutation-resistance evidence, rerun all local/SSG/browser gates, push implementation and evidence commits, wait for exact-head CI, and stop for another independent review. Do not merge, archive, release, or start `6.12`.

### 6.11 Third Correction Slice at `e4809df`

Worker commits `3115296` (implementation/tests) and `e4809df` (Core static-contract header) are
recorded; evidence commit `c0a49a3` documents the slice. Progress remains `61/131`, and `6.11`
is explicitly unchecked.

- Git identity failures retain stderr/exit evidence; only explicit/canonical not-repository output
  settles to `planning: null`. Unknown, empty, permission, ENOENT, IO, and canonicalization errors
  remain failure evidence. Code resolves before Planning and remains usable when Planning fails.
- Static Git uses a typed `bindingToken: null` projection and the live Git route exits before any
  subscription, query, or mutation. Dashboard and Context Summary retire retained snapshots/data
  during scope loading/error rather than relabeling stale A as current.
- Git handoff and scope variants are typed and readonly; selector-derived empty identities are
  rejected without a cast. Router fixtures use an explicit checked Planning resolver and Code token.

Focused green evidence on the final local head: Server scope/binding/router `4 files / 108 tests`,
Web Dashboard/Git/static `5 files / 45 tests`, Web handoff/detail `3 files / 36 tests`,
Server/Core/Web typecheck, lint, format, and `git diff --check` pass. The prior same-token,
different-entity red case at `dda056c` is fixed-point evidence; the new classifier, ready-root
Planning failure, stale-data/error, and static no-RPC tests are explicitly characterization and
regression evidence, not claims of old-tree red output. Full `test:ci`, clean SSG, browser gates,
exact-head CI, and terminating pinned-CLI desktop/mobile acceptance remain pending. Do not merge,
archive, release, or start `6.12+`.

### 6.11 Correction Candidate at `dda056c`

The two `62cf6f2` code blockers are corrected by `adfcfce` plus `dda056c`, but checkpoint `6.11` remains open at `61/131`:

- Launch-owned Code now has an independent typed query and is emitted before Planning resolution. The partial subscription projection is explicitly `planningState: resolving`; only a completed Planning projection is `settled`, so `planning: null` is no longer overloaded as both pending and collapsed.
- Git and Dashboard handoffs preserve their origin binding token through navigation state and View-Transition preparation. A token mismatch retires stale presentation and skips selector prefetch under the rebound repository.
- Checked focused evidence passes: Server Git fixture typecheck, exact Server Git `3 files / 11 tests`, Web typecheck, Web unit `118 files / 715 tests`, and `git diff --check`. A package-script mis-invocation also ran the full Server suite and observed one unrelated existing local-model Xet progress timeout; it is not claimed as a Git regression or as a green full-suite run.

The Code-first test fails at the fixed point when the new subscription emission is removed (`expected [] to have a length of 1 but got 0`) and passes after restoration. Real desktop/mobile acceptance, full gates, push, exact-head CI, and SHA equality remain required before independent acceptance. Keep `6.11` unchecked and do not start `6.12+`, merge, archive, or release.

### 6.11 Second Independent Review at `dda056c`

The post-correction local gates are green, but `6.11` remains open at `61/131`. The Standards review found one user-visible P1 and one contract-level P2 that the current tests do not cover:

1. **Same-binding handoff can show the wrong entity.** `git-view.tsx` and `detail-prepare.ts` validate only `family === 'git'` and an equal non-empty `bindingToken`. They never compare the handoff `entityId` with the URL selector. A stale browser-history/navigation state for commit A attached to a detail URL for commit B under the same repository binding therefore shows A's title/subtitle in B's loading shell. Prefetch is also not guarded by complete handoff provenance. Add a fixed-point red test with the same token and different commit ids, then reject the handoff presentation and preserve URL-selector reads.
2. **The new public types allow impossible states.** `GitRepositoryScopes` currently permits `planningState: 'resolving'` with a non-null Planning descriptor, and `getGitEntrySharedHandoff` accepts an optional token. This lets checked callers construct or omit provenance that the runtime contract requires. Encode a discriminated `resolving/planning:null | settled/planning:descriptor|null` union and a Git-specific handoff requiring a non-empty origin token; update all checked fixtures and call sites without type escapes.
3. **Planning binding failure is presented as a settled collapse.** `GitRepositoryBindingService.resolveScopes()` catches every Planning owner/Git identity error and returns `settled + planning:null`; Web then claims there is no distinct Planning repository. Preserve an explicit failure/evidence variant or propagate a subscription error while retaining Code continuity. A ready Root plus failing canonical Git identity must never render collapse copy.
4. **Dashboard Git snapshot provenance is non-atomic.** `DashboardGitSnapshot` carries entries without their origin Code token; click-time `git.code` attaches the current token to possibly cached A entries. Capture the Code token with the snapshot and reject/retire A data after a backend restart or reconnect exposes token B. Do not relabel A entries with B.

Required mutation-resistant evidence for the next worker:

- The same-token/different-entity test must fail against `dda056c` because the incorrect handoff title/subtitle is rendered (and any handoff-gated prefetch assertion must fail for the intended provenance reason). Restoring the guard must make it pass.
- Typechecked fixtures must reject the impossible `planningState` combination and must not allow a Git handoff with an omitted token. Do not weaken production types or use `as any`, `as never`, fabricated non-null assertions, or suppression comments.
- Keep the existing A -> B token mismatch behavior, Code-first deferred Planning behavior, Dashboard Code handoff, ordinary Git list handoff, scoped back/detail/files/patch, and View-Transition navigation intact. Do not add URL or storage token state.
- Add ready-Root + Git-identity-failure evidence that fails against `dda056c` because the UI reports a settled collapse. Code remains usable, but Planning failure/error evidence stays explicit and Planning controls remain locked.
- Add Dashboard snapshot A + current Code token B evidence that fails against `dda056c` because the old entry is handed off with B. The corrected UI retires or locks the stale snapshot until a B projection arrives; a matching A snapshot/token remains navigable.
- The worker must append exact red/green evidence, focused and full gates, and residual limitations to `loop/implementation.md`; `6.11` stays unchecked until a real terminating pinned-CLI agent-browser walk-through covers desktop and `390x844` Code/A/B flows. A unit-only or stalled browser attempt is not acceptance evidence.

### 6.11 Reconnect Authority Review Slice at `49a272b`

`6.11` remains unchecked at `61/131`. The reconnect correction is intentionally Git-scoped:
`useSubscription` defaults to the prior authoritative cache behavior, while
`useGitRepositoryScopes` opts into `loading` until `git.subscribeScopes` emits its replacement.
Dashboard retires cached A Git snapshots and handoffs during that loading/error window and accepts
only the matching B token after emission.

Mutation-resistant evidence is direct and reproducible. With the Git hook's `'loading'` argument
temporarily removed, the checked real-hook test fails `1/2` at `expected false to be true` for the
cached-A `isLoading` assertion. Restoring the argument returns `2/2` green. This is boundary
evidence, not a disabled-button or mocked downstream-handler characterization. Commits are
`87be0fe`, `fbe82f6`, and `49a272b`; only reviewer-owned `AGENTS.md` and `i18n.zh.md` remain dirty.

Focused Web tests and typecheck are green; full gates, clean SSG, pinned-CLI desktop/mobile
acceptance, push, exact-head CI, and SHA equality remain required before closing `6.11`. Do not
start `6.12+`, merge, archive, or release.

### 6.11 GitRoute Reconnect Gate at `0d0c134`

Cached scopes A are now display-only across the Git route while the replacement scope subscription
is loading. Overview/history queries are disabled, the route stays in its loading state despite
cached data, and Refresh, remove, switch, handoff, and pagination handlers all reject the current
reconnect window. A current Code emission with `planningState: resolving` still clears loading and
preserves Code-first behavior.

The remount test records no overview/list calls with either A or B during the delayed window and
then loads B after the real subscription callback. Removing both query `enabled` gates and the
cached-data early return produces a red route assertion with `loading: false`, stale A status/history
visible, and new A-token calls; restoring `0d0c134` returns the route lane to `15/15`.
Combined focused Web evidence is `31/31` plus typecheck and diff-check. `6.11` remains unchecked;
full gates, SSG, pinned desktop/mobile acceptance, push, exact-head CI, and SHA equality remain
required. Do not start `6.12+`, merge, archive, or release.

### 6.11 Git Detail Reconnect Gate at `6787573`

Cached A detail and handoff content are now non-authoritative while Git scopes reconnect. Meta/files
queries are disabled and the route shows loading before A handoff text can render; B emission then
restores B queries and detail. Removing the query gates and early return produces a red test with
`loading: false`, A meta/files calls, and stale A detail; restoration returns the detail lane to
`12/12`. Combined focused Web Git scope/subscription/Dashboard/list/detail evidence is `43/43` plus
typecheck and diff-check. Checkpoint `6.11` remains unchecked; full gates, SSG, pinned desktop/mobile
acceptance, push, exact-head CI, and SHA equality remain required.

### 6.11 Fourth Independent Review at `89e105c`

PR #207 is `OPEN/CLEAN` at exact local/remote/PR head `89e105c`; all six remote checks pass.
Independent reruns pass the five-file Web reconnect lane `43/43`, the four-file Server Git lane
`23/23`, and `git diff --check`. This does not close `6.11`: pinned OpenSpec 1.6 desktop/mobile
acceptance is absent, and review found these blockers:

1. **Transport error/reconnect restores cached A authority.** `useSubscription.onError` retains A
   with `isLoading: false`; GitRoute/GitView gate only on loading. The Git hook also ignores tRPC
   `onConnectionStateChange`, so real `connecting | pending` phases can leave A actionable. Only a
   replacement `onData` may authorize data; a current Code-first `planningState: resolving`
   emission remains usable and is distinct from a whole-transport reconnect.
2. **Dashboard actions relabel stale intent.** Refresh and detached-worktree removal query
   `git.code` at execution time instead of carrying the token observed with snapshot A. They can
   therefore execute as B rather than conflict, including the destructive removal path.
3. **Code identity can be mislabeled.** `resolveScopes()` resolves Code, then calls a combined
   resolver that resolves Code again inside the Planning `try`; failure of the second Code read is
   returned as `planningError`. Compose Planning against the first Code descriptor.
4. **Code token ownership is inverted.** `PlanningRootServiceResolver.codeBindingToken` makes the
   replaceable Planning manager own Launch Code provenance. A backend/Launch owner must issue and
   inject it into Git binding plus Dashboard projection.
5. **Typed evidence and headers are incomplete.** `git-repository-scope.test.ts` proves the public
   classifier but is outside Server test typecheck; audit every changed Server fixture into a
   checked lane. `packages/core/src/index.ts` and `packages/web/src/lib/static-data-provider.ts`
   also retain 2026-07-18 headers after 2026-07-19 changes.

Add fixed-point red evidence for cached A plus transport `connecting/pending/error`, stale
Dashboard A refresh/removal after B, and first-Code-success plus second-Code-failure. Correct the
owner/typecheck/header gaps, rerun all gates, push exact-head evidence, and only then attempt the
terminating pinned browser fixture. Keep `6.11` unchecked at `61/131`; do not start `6.12+`, merge,
archive, or release.

Construction boundary: represent Git transport authority separately from generic loading so a
terminal error can stay visible without unlocking cached data. Dashboard helpers accept the
snapshot token as a required argument and never query provenance at execution time. Server
bootstrap creates one Launch-scoped Code owner; the Planning resolver exposes no Code token, and
Planning comparison consumes the one already-resolved Code descriptor. The decisive transport,
Dashboard mutation, and Code-classification tests must execute the real boundary and fail when its
exact transition is removed. This explicit owner/event/snapshot audit is required because prior
corrections repeatedly proved a nearby presentation state while leaving the production authority
boundary untested.

### 6.11 Fifth Review Boundary at `b55267c`

The candidate layered on `b55267c` remains uncommitted in the shared worktree. Focused Web and
Server tests and type lanes are green, but `6.11` is still unchecked at `61/131`. The candidate
must not be promoted by the green checks on `b55267c`, and no `6.12+`, merge, archive, or release
work is authorized.

The next apply slice must close these exact boundaries:

- Guard every authoritative subscription callback and static loader by an active generation;
  retired A emissions must not overwrite B or the cache. Terminal `onError`, `onStopped`, and
  `onComplete` must revoke authority and preserve their diagnostic until replacement `onData`.
- Reuse the Code descriptor captured by `subscribeScopes` in the Planning reactive task. A route
  call-count red test must fail when the first Code observation is removed from the reuse path or
  when a second Code read is reintroduced.
- Make Dashboard refresh conflicts visible, and test the actual rendered refresh and destructive
  removal handlers across A snapshot -> B emission -> A callback. Direct helper tests are not enough.
- After transport B emits, assert the real Git overview/list query boundaries resume with B; an
  error disappearing is not query-resumption evidence.
- Put owner lifetime, composition token agreement, and changed public-boundary fixtures in a
  checked Server lane. Refresh all changed TypeScript headers, especially
  `planning-root-service.test.ts`.
- Run full local gates, clean SSG, terminating pinned OpenSpec 1.6 desktop and real `390x844`
  browser acceptance, then commit/push and prove exact local/remote/PR SHA plus CI equality.

The red tests must reach the real subscription, Router, Dashboard handler, and query owners. A
disabled control, direct helper invocation, mocked downstream conflict, or a service-only count is
characterization evidence, not proof of the production boundary.

### 6.11 Worker Apply Evidence after `b55267c`

Applied production/test corrections now retire stale subscription generations, preserve terminal
diagnostics, reuse one Code descriptor through the public reactive Router stream, keep Launch Code
ownership separate from replaceable Planning services, bind Dashboard actions to rendered tokens,
and expose refresh/removal failures in a visible alert. The checked composition test proves the
server-created Launch owner keeps Code token stable while Planning A/B tokens rotate and the
Dashboard snapshot uses the same Code token. GitRoute replacement evidence asserts actual B-token
overview/list query calls, not merely disappearance of an error label.

The exact mutation red/green pair is recorded in `loop/implementation.md`: removing the
authoritative `onData` generation guard yields one failing late-A test; restoring it yields the
focused Web lane green. Current focused evidence is Server 49 files/388 tests, Web 121 files/751
tests, Web and checked Server typechecks, format check, and diff check. `6.11` remains unchecked
until full gates and terminating pinned OpenSpec 1.6 browser acceptance complete; `6.12+`, merge,
archive, and release remain forbidden.

### 6.11 Sixth Independent Review at `5497730`

Local HEAD, remote feature branch, and PR #207 all equal
`5497730d1f2e40d6347ef9ae6609b25826640f9a`; the PR is `OPEN/CLEAN` and its six remote checks pass.
Independent focused reruns pass Web Git `5 files / 48 tests`, Server Git `3 files / 23 tests`,
checked Server Git typecheck, and Web typecheck. These facts do not close `6.11`: three evidence and
lifecycle boundaries remain incomplete.

1. **Static-loader cleanup is missing on direct unmount.** `useAuthoritativeSubscription` returns no
   effect cleanup from its static-loader branch. Dependency rebind increments `generationRef`, so the
   existing test passes without proving cleanup. A direct component unmount leaves the generation active;
   its late loader can still write the shared cache and call `setState`. Add an unmount counterexample that
   primes a known cache key, unmounts before resolution, resolves the loader, remounts a reader, and proves
   the cache did not change. It must fail at `5497730` for the stale-cache reason; return one cleanup from
   every effect branch and retire the generation before any unsubscribe/settlement.
2. **Dashboard snapshot conflict evidence does not reach the required component lifecycle.** The current
   component test mutates a token variable and invokes only Refresh; it does not publish B through the
   rendered scope projection, invoke captured A Refresh and destructive Removal handlers after B is
   current, or assert a visible typed `CONFLICT`. Helper tests prove argv provenance but not UI ownership.
   Add one rendered A -> B -> captured-A test that reaches both production handlers, proves B is untouched,
   shows the conflict alert, settles pending state, and then proves matching B actions resume.
3. **The declared post-B and owner recurrence evidence is still partial.** The transport test at the named
   review boundary checks that the error disappears after Code emits but does not assert real overview/list
   calls with B. Other rebind tests prove presentation and some queries, but the Change claims complete
   overview/list/meta/files/patch resumption. Add explicit B-token assertions for each public query owner.
   The composition test proves A -> B only; extend it to B -> A with a newly issued A2 Planning token while
   the Launch Code token and Dashboard Code provenance remain stable.

4. **The checked-boundary claim is too broad.** `packages/server/tsconfig.git-tests.json` checks only its
   six explicit Git files. The changed `planning-root-service.test.ts` and `router.test.ts` remain outside
   that lane (and the base test config excludes tests), so Manager/Router fixtures are not typechecked as
   claimed. Add them to an explicit checked lane and remove any fabricated non-null assertions or casts in
   the decisive fixtures.
5. **Observer forwarding and Patch ownership are not proven at the public Web boundary.** The generic hook
   test calls `onStopped/onComplete` directly, while Git-specific tRPC mocks omit those callbacks. Add a
   real Git subscription observer fixture that forwards stop/complete and proves cached data remains
   non-authoritative until replacement data. The reconnect route/detail tests cover B overview/list/meta/
   files, but the detail panel is mocked and no real B patch query owner is asserted; add that exact patch
   provenance assertion without weakening the panel boundary.
6. **Launch owner validation is incomplete.** Add direct non-empty-constructor validation and a real server
   composition assertion, in the checked lane, that the same Launch owner feeds Git and Dashboard. A stable
   value observed through an ordinary test object is not lifetime evidence.

The static-unmount defect is now executable fixed-point evidence, not only source inspection. In an isolated
worktree at `5497730`, a one-purpose hook test started a pending static loader, directly unmounted, resolved
it, then remounted a reader under the same cache key:

```text
pnpm --filter @openspecui/web exec vitest run --project unit \
  src/lib/use-subscription-static-unmount.audit.test.tsx
1 failed: expected undefined, received `stale-after-unmount`
```

The isolated audit file/worktree was removed after the run; the worker must land the equivalent checked test
in the real suite and prove the narrow cleanup turns this exact assertion green.

The existing public Router exactly-once transition is independently accepted. In an isolated worktree,
replacing only `resolvePlanningScopes(code, { reactive: true })` with the old combined
`resolveScopes({ reactive: true })` makes the named public Router test fail because `resolveCodeScope` is
called twice; restoring `5497730` returns it to green. Do not rewrite that accepted boundary.

These are review findings, not yet red executions. Preserve every accepted `5497730` behavior and keep the
correction limited to the exact lifecycle/tests above. Focused green and CI cannot substitute for the direct
counterexamples. `6.11` remains unchecked at `61/131`; `6.12+`, merge, archive, and release remain forbidden.

### 6.11 Stage 1 Applied at `1838ccf`

The direct-unmount static-loader counterexample is now maintained in
`packages/web/src/lib/use-subscription.test.tsx`. Against the unchanged `0d6dcca` production
fixed point it failed with `expected undefined, received stale-after-unmount` after a pending
loader was resolved following direct unmount. The correction returns one generation-retiring
cleanup from every authoritative effect branch, including static loading.

Stage 1 evidence is green: the subscription file is `7/7`, the adjacent Web Git lane is `25/25`,
Web typecheck passes, the two changed files pass format check, and `git diff --check` passes. Static
loader rejection, dependency rebind, late live callbacks, terminal error ordering, and direct
unmount are covered. Stage 1 is committed separately before proceeding; 6.11 remains unchecked
until the rendered Dashboard A-to-B conflict/removal boundary, exact B query/owner recurrence,
checked Server lane, full gates, and terminating pinned desktop/mobile browser acceptance pass.

Do not start 6.12+, merge, archive, or release.

### 6.11 Staged Completion and Stop-Loss Boundary

Checkpoint `6.11` remains the only implementation scope. Continue it in four committed stages:
real-time connection authority, rendered Dashboard snapshot-token conflicts, checked backend query/owner
recurrence, and terminating browser acceptance. Focused tests and checked type lanes gate each stage;
full gates are forbidden while the current focused stage is red.

Partial browser reconnaissance confirms Code default, distinct Planning, A -> B, B -> Code, real A/B
history, A detail/files/patch/back, token isolation, and desktop width. It does not satisfy the checkpoint:
A -> B -> A, stale Refresh/Removal conflict, reconnect/failure, Planning identity failure, and real
`390x844` remain open. A multi-client Project Binding write was observed to converge only after an extended
`Saving...`/old-Root interval; this is not yet deterministic evidence and does not authorize scope growth.
If the terminating fixture is externally blocked, record the exact blocker once, leave `6.11` open, and
stop. No `6.12+`, merge, archive, or release work is authorized.

### 6.11 Stage 3 Evidence at `73a27e4`

Commit `73a27e4` closes the focused backend/query-owner evidence boundary without closing checkpoint
`6.11`. The real server composition proves Launch Code token stability and distinct Planning A/B/A2
tokens, and rejects blank Launch tokens. The Git observer fixture forwards stop/complete terminal events;
replacement emissions resume overview/list with exact B/C tokens. Web route/detail fixtures assert B
meta/files and replacement patch provenance, while the existing real `GitEntryDetailPanel` test asserts
the on-demand patch owner receives the B Planning token and fails under an A mutation.

Focused results are Server Git `5 files / 31 tests`, Web Git plus panel `5 files / 53 tests`, checked
Server Git typecheck, Web typecheck, format, and diff-check all green. The checked lane remains limited to
the five existing Git boundary suites; unrelated historical Router/Manager fixtures were not made to pass by
adding type escapes or fabricated services.

The Dashboard A -> B test reaches the production Dashboard and action controls and captures A handlers,
but injects B through the mocked hook projection and rerender rather than a raw tRPC callback. It is
component-boundary evidence for the visible conflict and recovery path, not transport/browser evidence;
the terminating browser pass remains mandatory.

`6.11` remains open at `61/131`. Full local gates, clean SSG, and terminating pinned desktop plus real
`390x844` browser acceptance are still required. The known partial browser reconnaissance does not prove
A -> B -> A, stale black-box conflicts, reconnect/failure, Planning identity failure, or mobile geometry.
No `6.12+`, merge, archive, or release work is authorized.

### 6.11 Stage 4 Review Stop-Loss at `6ff211c`

Checkpoint `6.11` remains open at `61/131`. The accepted implementation is `73a27e4`, with staged
evidence at `4bd1031` and the one-time browser-fixture blocker recorded at `6ff211c`.

Local regression evidence remains green:

```text
pnpm test:ci -> root 43, core 440, server 391, web 754, cli 49 (all passed)
clean SSG -> passed (existing CSS pseudo-element and dynamic-import warnings only)
pnpm test:browser:ci -> xterm 60 passed / 1 skipped; Web 12/12
```

The pinned live browser fixture used OpenSpec CLI 1.6.0 from `references/openspec` `e1b51d1`, an
isolated `XDG_DATA_HOME`, and disposable Code/Planning Git roots. It loaded the real Web surface and
confirmed Code `code`, declared Planning Store `plan-a`, distinct Planning Git identity, and the pinned
CLI version. It did not complete deterministic A -> B -> A, stale Refresh/Removal conflicts,
reconnect/failure, Planning identity failure, or `390x844` geometry.

The `stage4new` session's terminating inspection commands were bounded to 15 seconds and both hung:

```text
agent-browser --session stage4new screenshot /tmp/openspecui-6-11-stage4-blocker.png -> exit 143
agent-browser --session stage4new get url -> exit 143
```

This is the single permitted external browser-fixture blocker. It is not production-defect evidence;
do not retry the same stalled commands or close `6.11`. Keep `6.12+`, merge, archive, and release
untouched until a terminating desktop/mobile browser path produces the missing evidence.

### 6.11 Review Decision: Project Binding Settlement Candidate (2026-07-19)

The latest bounded same-origin `/config` run changes the review classification of Project Binding. With
the direct pinned OpenSpec 1.6 fixture, isolated `XDG_DATA_HOME`, backend `13122`, and a same-origin
Vite proxy, the real `updateProjectBinding(A -> B)` interaction showed:

```text
launch openspec/config.yaml -> store: B
Active Root subscription -> B
mutation response -> still pending after bounded 20s; UI remains Saving...
```

The earlier `localhost`/`127.0.0.1` CORS mismatch was a fixture error and was removed from this run.
The remaining sequence is a narrow 6.11 red candidate, not browser acceptance and not yet a proven
production defect. `planningConfig.updateProjectBinding` currently writes the launch file and then
calls the full `fetchProjectBindingConfig`/Planning-root transition; existing router tests mock that
resolver as immediate and do not cover pending retirement/lease settlement.

The next worker may add only a typed public server fixed-point test for this sequence. A production fix
requires the test to fail at the current fixed point and to fail again when the exact proposed cleanup
or settlement transition is removed. No arbitrary sleeps, generic generation barrier, router rewrite,
or scope expansion is authorized. Stop and clean the old backend/Vite fixture before rerunning. Keep
`6.11` open at `61/131`; do not start `6.12+`, merge, archive, release, or App/Store work.

### 6.11 Owner Decision Gate: Split Pending Blockers (2026-07-19)

Further implementation is paused. The worker/test lanes were stopped after the review identified
separate unresolved contracts:

- mutation response semantics (await complete Planning transition versus settle after launch binding);
- Root/ActiveRoot invalidation and WebSocket/watcher readiness;
- supported acceptance surface (direct same-origin Web versus experimental App iframe);
- one follow-up Change versus separate Changes for those contracts.

Candidate A (bounded `Saving...` after B convergence) and Candidate B (HTTP 200 but Dashboard remains
Launch/nearest with WebSocket `Offline`) must not be treated as one defect. `6.11` stays unchecked at
`61/131`; no new worker Goal, production code, browser rerun, `6.12+`, merge, archive, or release is
authorized until the owner selects one decision item and its acceptance boundary.

### 6.11 Decomposed Work Packages and Owner Blockers (2026-07-19)

The remaining work is intentionally split so an unrelated Config/transport candidate cannot keep the
Git checkpoint in an indefinite combined review loop.

| Package               | Owns                                                                                        | Current state                                                                                        | Entry condition                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| W1 Git scope contract | Code/Planning binding tokens, scope-aware Git queries/mutations, stale-intent conflicts     | Stage 1-3 implementation and checked evidence accepted; only terminating delivery acceptance remains | Owner selects direct same-origin project Web as the 6.11 harness                                |
| W2 Binding settlement | `planningConfig.updateProjectBinding`, launch binding write, Planning transition settlement | Candidate A only; inconsistent browser timing, no accepted red server test                           | Owner chooses await-transition versus write-then-converge semantics                             |
| W3 Reactive readiness | Root/ActiveRoot subscriptions, invalidation, WS/watcher lifecycle and Web projection        | Candidate B only; WS was Offline, so no causal defect                                                | Owner chooses WS readiness gate versus non-WS fallback, then worker captures a real event trace |
| W4 Browser harness    | Pinned CLI fixture, isolated data home, bounded desktop/mobile evidence and cleanup         | External fixture has stalled paths; no A->B->A or mobile acceptance claim                            | Owner chooses direct Web versus experimental App iframe                                         |

The owner must decide:

1. Whether W1 may close 6.11 independently of W2/W3. Recommended: yes; W2/W3 are not Git scope
   semantics and should not block the 6.11 package.
2. Whether `updateProjectBinding` resolves after the launch binding write (with a typed `rootPreview`
   and subscription convergence state) or awaits the full Planning transition. This is a public API
   contract choice, not a cleanup tweak.
3. Whether an offline WebSocket is an explicit unavailable/locked live state or requires a non-WS
   invalidation fallback. Candidate B cannot decide this while offline.
4. Whether the supported acceptance surface is direct same-origin Web (recommended) or experimental
   App iframe/`?api=`.
5. Whether W2 and W3 become separate follow-up Changes (recommended) rather than expanding the Git
   checkpoint.

Until these choices are recorded in the next worker Goal, progress stays `61/131`, `6.11` stays
unchecked, and no implementation or browser rerun is authorized.

### 6.11 Historical Recommendation: W1 Git + W4 Direct Web (superseded 2026-07-19)

The following was the default recommendation before the owner pause. It is historical evidence, not an
active worker boundary:

- W1 remains the actual 6.11 package: Git Code/Planning scope, binding-token provenance, stale-intent
  conflicts, and current-owner query/mutation behavior.
- W4 supplies only terminating evidence through the direct same-origin Project Web surface with pinned
  OpenSpec `e1b51d1`, isolated `XDG_DATA_HOME`, disposable Code/A/B roots, desktop, and `390x844`.
- W2 Project Binding settlement and W3 Root/ActiveRoot reactive readiness remain deferred blockers and
  may not be fixed incidentally inside W1.

The worker enters only after focused checked Git lanes are green. It may correct production code only
for a red public Git-boundary test and must prove mutation resistance for the exact transition. A
natural Root/Dashboard event ordering, an offline WebSocket, or a stalled browser command is not such
evidence. One terminating fixture blocker or three bounded failed attempts ends the slice with `6.11`
open at `61/131`.

### W1 Focused Independent Recheck at `dfa94c4` (2026-07-19)

The selected W1 Git slice has no checked public-boundary red:

- Server Git fixtures: 4 files / 29 passed; Router Git subset: 18 passed / 71 skipped.
- Web Git/Dashboard: 7 files / 70 passed.
- `@openspecui/server typecheck:git-tests` and Web typecheck pass. The separate full server `typecheck`
  gate also includes `typecheck:transport-tests`; the focused Git lane does not.

The lanes cover binding-token rotation and Code continuity, stale action conflict before rebound
side effects, identity failure classification, observer terminal forwarding, cached-A retirement,
current-B query/action resumption, and route/detail/files/patch provenance. This is focused regression
evidence only. It does not close W4 desktop/mobile acceptance and does not authorize W2/W3 production
changes. Full gates and exact-head delivery remain pending.

### 6.11 Owner Pause Supersedes the Recommended Worker Boundary (2026-07-19)

The preceding W1 + W4 section is a recommendation preserved for review history, not an active worker
authorization. The owner requested independent problem boundaries and decision blockers before more work
continues. No worker is active while the owner chooses the contract, and no browser rerun is authorized.

Current evidence is separated as follows:

- W1 Git scope/token behavior has no checked public-boundary red; its remaining evidence is a terminating
  direct-Web delivery acceptance.
- W2 Project Binding settlement is Candidate A only. It needs a typed real-server fixed point before any
  production change.
- W3 Root/ActiveRoot reactive readiness is Candidate B only. The observed WebSocket was Offline, so it
  cannot prove a server emission or Web projection defect.
- W4 is only the pinned fixture and bounded desktop/mobile harness; it does not define W2 or W3 semantics.

Until a new Goal records one selected package and the owner's answers for closure boundary, Binding
settlement, transport fallback, harness surface, and Change shape, `6.11` remains open at `61/131`.

### 6.11 W4 Fixture Recheck (2026-07-19)

A bounded review-only direct-Web attempt used the corrected same-origin OpenSpecUI CLI path and cleaned
all processes afterward. The static Web surface and WebSocket opened, but the disposable `store-a` fixture
did not resolve: Root remained `code/nearest` and a 15-second wait for Planning A timed out. An earlier
standalone-server probe returned `404 /git` because it targeted an API-only process. These are fixture/setup
observations, not a W1 production red. W4 therefore remains incomplete; no A -> B -> Code/A, stale
Refresh/Removal conflict, reconnect/error, provenance, or `390x844` acceptance claim is made.

### 6.11 Resumed Staged Worker Goal (2026-07-19; historical, superseded)

The owner has now resumed implementation as four ordered stages. This section supersedes the earlier
owner-pause execution stop, while preserving the independent package boundaries and red-evidence law:

```text
Stage 0 -> correct pinned-CLI and typecheck evidence contracts
Stage 1 -> real-time connection lifecycle and retired-generation behavior
Stage 2 -> Dashboard Git token provenance and stale-intent conflicts
Stage 3 -> backend owner/transition lease audit
Stage 4 -> terminating direct-Web desktop/mobile acceptance
```

The worker must complete only the current stage, commit its code/tests/evidence, and stop for review before
the next stage. Stage 0 is the current active slice. Its fixed issues are:

- `root-context-cold-start.integration.test.ts` must execute
  `references/openspec/bin/openspec.js` at `e1b51d1`, not the `openspec-cli-16` npm alias, when its evidence
  is described as pinned.
- `typecheck:git-tests` and `typecheck:transport-tests` are separate lanes; the Change must report them
  separately or change the script wiring and prove that new contract.

Stage 0 must retain isolated `XDG_DATA_HOME`, remove cross-channel timestamp ordering claims, and run its
focused fixture/type lanes three consecutive times. A failure stops all later stages. No Stage 1-4
production correction is authorized until Stage 0 is reviewed.

### 6.11 Stage 0 Evidence Contract Applied (2026-07-19)

The cold-start fixture now resolves the direct first-party executable at
`references/openspec/bin/openspec.js` and verifies the submodule HEAD is
`e1b51d111ab446b54dee2d6159ac245f0339ae52`. Its disposable runner records the actual `cliPath` for every
start/exit event, and the test asserts every traced invocation used that path. The fixture continues to
isolate `XDG_DATA_HOME`; no production runtime code or typecheck script was changed.

Raw focused evidence:

```text
pnpm --filter @openspecui/server exec vitest run src/root-context-cold-start.integration.test.ts
  run 1: 1 file / 1 test passed (2.30s; 17:22:07)
  run 2: 1 file / 1 test passed (2.19s; 17:22:18)
  run 3: 1 file / 1 test passed (2.16s; 17:22:42)
pnpm --filter @openspecui/server run typecheck:transport-tests
  passed
git diff --check
  passed
```

`typecheck:git-tests` and `typecheck:transport-tests` remain separate package scripts and are reported
separately. Stage 0 is implementation-complete and awaits independent review; `6.11` remains open at
`61/131`, and Stage 1-4, full gates, browser acceptance, merge, archive, and release remain unauthorized.

### 6.11 Stage 0 Independent Review Accepted (2026-07-19; historical, superseded)

Stage 0 is accepted at `2c61246`. The exact submodule SHA/path, runner trace, isolated XDG scope, three
consecutive cold-start runs, transport typecheck, Git typecheck, format, and diff-check all passed. No
production runtime changed. At that historical point, Stage 1 was the only proposed worker slice for a
staged run. The owner later superseded that authorization with the decomposition decision gate below.

### 6.11 Current State: Decomposition Decision Gate (2026-07-19)

The preceding Stage 0/Stage 1 authorization is historical and superseded by the owner's latest request
to stop the repeated 6.11 loop, split the work, and receive the blockers for decision. No worker package
is active. `6.11` remains open at `61/131`; no production edits, browser reruns, full gates, `6.12+`,
merge, archive, or release work is authorized until the owner selects one package.

The independent packages and their current evidence are:

```text
W1 Git scope/token delivery  -> checked implementation baseline accepted; terminating browser evidence pending
W2 Binding settlement        -> Candidate A only; typed public-server fixed point missing
W3 Reactive readiness        -> Candidate B only; WebSocket was Offline, so no production red
W4 Browser harness           -> fixture/evidence package; `store-a` did not resolve in the bounded attempt
```

Delivery is also not at the review point: local `b5aea58` is six commits ahead of the PR branch at
`28319fd`. The W1 implementation is already in the PR ancestry, but the accepted Stage 0 evidence and
the current decision-gate documents are local until a selected package is authorized for delivery.

The owner must decide:

1. Close `6.11` after W1 + W4, or keep W2/W3 in this Change.
2. Define `updateProjectBinding` as `await-full-transition` or `write-then-converge` with typed
   preview/transition evidence.
3. Define Offline WebSocket as an explicit locked/unavailable live state or require a non-WS fallback.
4. Use the recommended direct same-origin Project Web, or explicitly choose the experimental App iframe.
5. Keep W2/W3 as deltas here, or create independent follow-up Changes.

Candidate A and Candidate B are not merged into one defect. A natural Root A -> Root B -> Dashboard B
trace, an offline subscription, and a stalled browser command are characterization/fixture evidence.
Production correction still requires a checked public-boundary red plus mutation-resistance proof. The
next worker Goal must name exactly one selected package, fixed-point test, owner layer, and stop-loss.

### 6.11 Owner Decision: W1 + W4 Active, W2/W3 Deferred (2026-07-19)

The owner approved the following execution boundary after reviewing the two unresolved candidates:

```text
active:   W1 Git scope/token delivery
active:   W4 single-page direct same-origin Project Web evidence + multi-tab unit tests
deferred: W2 Project Binding settlement -> follow-up Change
deferred: W3 WebSocket/reactive error propagation -> follow-up Change
```

The owner will perform manual multi-tab acceptance. The worker must provide single-page desktop and
`390x844` browser evidence plus checked multi-tab unit coverage. W4 must use the pinned executable at
`references/openspec/bin/openspec.js` (`e1b51d111ab446b54dee2d6159ac245f0339ae52`) and isolated
`XDG_DATA_HOME`; the experimental App iframe is excluded. One bounded fixture attempt is allowed;
fixture failure is recorded as a blocker and is not a production red.

W2's follow-up contract is write-then-converge: Project Binding returns typed launch-write,
`rootPreview`, and transition evidence while subscriptions converge asynchronously. W3's follow-up
contract exposes the real transport/API error and does not invent a UI lock or stale-data success state.
Neither contract may be implemented incidentally in 6.11. No `6.12+`, merge, archive, or release work
is authorized by this decision.

### 6.11 W1/W4 Worker Evidence at `46c17a5` (2026-07-19)

The selected worker slice delivered one checked multi-tab isolation test and a terminating single-page
direct-Web walk-through. Commit `46c17a5` changes only
`packages/app/src/components/hosted-shell.test.tsx`; it does not change W2/W3 production behavior.

Checked evidence:

```text
pnpm --filter @openspecui/app exec vitest run src/components/hosted-shell.test.tsx
  1 file / 6 tests passed
pnpm --filter @openspecui/app typecheck
  passed
pnpm format:check
  passed (changed-file set)
git diff --check
  passed
```

The new test proves two persisted project tabs retain distinct backend API/session URLs, preserve both
iframe panel nodes while switching active state, and update the App title to the selected project. The
manual multi-tab browser acceptance remains the owner's responsibility.

The bounded direct-Web evidence used pinned CLI `references/openspec/bin/openspec.js` at
`e1b51d111ab446b54dee2d6159ac245f0339ae52`, isolated `XDG_DATA_HOME=/tmp/openspecui-w4-Lyygdr/.xdg`,
disposable Git/OpenSpec fixture, backend `4136`, and same-origin Vite proxy `4137`. On
`/dashboard?_b=%2Fgit`, desktop `1280x577` and mobile `390x844` both rendered the Git page; each reported
`scrollWidth === clientWidth` and showed the Code repository/history surface. Screenshots were saved as
`/tmp/openspecui-w4-desktop.png` and `/tmp/openspecui-w4-mobile.png`. This is single-page delivery
evidence, not proof of manual multi-tab behavior or W2/W3 semantics.

`6.11` remains open at `61/131` pending the owner's manual multi-tab acceptance and any final delivery
decision. Do not start `6.12+`, merge, archive, or release.

The deferred work is now represented by independent Changes:
`target-openspec-cli-16-project-binding-settlement` (W2) and
`target-openspec-cli-16-reactive-error-propagation` (W3). Their Goals are separate worker authorization
boundaries; no W2/W3 implementation belongs in this checkpoint.

Independent review of W2 candidate `c85ce12` reopened its B2.1-B2.4 tasks for physical-write ownership,
correlated result typing, partial-error Root provenance, and generation-safe launch repair. This does not
change `6.11` progress or authorize W3/`6.12+` work.

W2 follow-up status (2026-07-20): child Change evidence commit `68ed1e9` records implementation
`89de4df0d763e033e204c19302b43569e1cbc442`, clean SSG/full local gates, the bounded Project Binding
single-page fixture, and the cleanup correction review. B2.5 remains open only for the owner's manual
single-page/multi-tab acceptance. This does not close or alter parent checkpoint `6.11`.

W2 owner acceptance (2026-07-20): the owner confirmed the child Change's single-page Store A -> B
convergence and same-project multi-tab subscription convergence, including the absence of stale draft or
false success/error state. Child B2.5 is now complete. Parent `6.11` remains open because its App
multi-project tab acceptance is a distinct W4 boundary and is not inferred from W2.

### 6.11 Owner W4 Acceptance (2026-07-20)

The owner separately confirmed the parent W4 acceptance boundary: the direct project page passed and the
App multi-tab flow passed. This is recorded as owner-run acceptance of the remaining 6.11 delivery surface,
not as W2 evidence. Together with the accepted W1 Git scope/token implementation, checked multi-tab
coverage, pinned-CLI direct-Web evidence, full local gates, and exact-head remote delivery, this closes
`6.11` at `62/131`.

The W2 and W3 contracts remain separate: W2 is complete and remains independently archivable; W3 reactive
error propagation is not part of this checkpoint. `6.12+` is still frozen until a new Goal selects one
checkpoint. Do not merge, archive, or release from this review update.
