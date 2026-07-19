<!--
Orthogonal intents (created 2026-07-19 Asia/Shanghai):
1. Record implementation and review evidence for Project Binding settlement.
2. Preserve causal red/green and mutation-resistance distinctions.
3. Keep unresolved evidence visible instead of converting it into a completion claim.
-->

# Implementation Log

Status: B2.1-B2.4 implemented after independent review of `c85ce12`; B2.5 remains open. The owner
selected write-then-converge on 2026-07-19.

## Fixed point and red evidence

Terra's checked public Router fixture was committed at `1d58319`. At that fixed point, with a real
Root A operation lease held, the launch project's `config.yaml` already contained `store: store-b`
while `planningConfig.updateProjectBinding` remained in the Manager's full transition lane and the
250ms bounded race returned `still-waiting`. The same fixture rejected the old `kind: project-binding`
shape because it had no typed launch-write or transition evidence. This is a public-boundary red
test, not a UI-only timing observation.

## Implemented contract

```text
writeProjectBindingConfig(launch project)
  -> launchWrite { file, binding, completedAt }
resolveServerRootContext(launch project, inherited CLI scope)
  -> rootPreview (ready | error, with raw CLI evidence)
return { kind: project-binding-update, launchWrite, rootPreview, transition }
Root Context subscription / PlanningRootServiceManager
  -> performs the actual asynchronous A -> B resource convergence
```

`ProjectBindingUpdateResult` is a public Core type and the Router mutation explicitly returns
`Promise<ProjectBindingUpdateResult>`. A ready detached preview returns `transition.state: converging`;
an error while obtaining that detached preview returns `transition.state: preview-error`, which does
not claim that the Manager or subscription transition failed. `transition.id` is a mutation-local
correlation id; Root Context subscriptions do not echo it and it is not a lease or authorization
token.

The launch file is reread through the reactive cache after the write completes. Root preview resolution
uses one stateless Core resolver attempt and therefore does not wait on a retiring Manager lease. This
contract does not invent a new process timeout for the CLI attempt. No sleep, generic generation
barrier, project-local Store registry, or W3 WebSocket behavior was added.

## Green evidence

- `pnpm --filter @openspecui/server exec vitest run src/planning-config-router.test.ts --no-file-parallelism`:
  3 tests passed at correction commit `c85ce12`.
- The same checked fixture now subscribes to Root Context, observes Root A, verifies no Root B is
  exposed while the A lease is held, releases the lease, then awaits the subscription's typed Root B
  ready promise. No timer is used for the convergence assertion.
- `pnpm --filter @openspecui/server exec vitest run src/router.test.ts src/planning-config-router.test.ts --no-file-parallelism`:
  91 tests passed after updating the physical-owner expectation to the new mutation contract.
- `pnpm --filter @openspecui/core test -- src/planning-config.test.ts`: 47 files / 440 tests passed.
- `pnpm --filter @openspecui/core typecheck`, `pnpm --filter @openspecui/server typecheck`, and
  `pnpm --filter @openspecui/web typecheck` passed.
- `pnpm --filter @openspecui/web exec vitest run src/components/config/project-binding-section.test.tsx`:
  16 tests passed at correction commit `c85ce12`. Coverage includes stale subscription A, stale data
  scope, Root error, retained B data with a subscription error, preview-error draft retention, and
  clearing dirty state only after a matching ready subscription B.
- `pnpm --filter @openspecui/core exec vitest run src/planning-config.test.ts`: 4 tests passed.
- `pnpm --filter @openspecui/core typecheck`, `pnpm --filter @openspecui/server typecheck`, and
  `pnpm --filter @openspecui/web typecheck` passed after `c85ce12`.
- `pnpm format:check` and `pnpm lint:ci` passed after `c85ce12` (`0` warnings/errors).

## Review boundary still open

The bounded direct-Web flow and full repository gates remain outstanding. Do not mark B2.5 complete,
merge, archive, release, or start W3/6.12+ until those checks and independent review are recorded.

## Correction commit `c85ce12` (2026-07-19)

The public Router fixture no longer imports or subscribes through the internal
`createRootContextSubscription` helper. It opens `planningConfig.subscribeProjectBinding`, holds a
real Root A operation lease, writes `store: store-b` through the public mutation, and derives the
mocked Doctor/Context Root B by rereading that launch file. Root B is not selected by mutable fixture
state. The ready assertion preserves planning-root path/source/Store, data-scope path/source, typed
diagnostics, raw Doctor/Context stdout and stderr, exit status, and contract evidence. The detached
failure case preserves the completed launch write and returns `transition.state: preview-error`.

The Config owner now requires both matching launch declarations and matching ready Root identity
(planning-root path/source/Store plus data-scope path/source/environment variable) before clearing the
draft. A stale Root A, stale data scope, Root error, or retained B snapshot accompanied by a
subscription error leaves the draft visible and keeps the mutation unavailable. The subscription error
is surfaced as the actual error; it is not converted into `Saved`.

## Independent review correction after `ea8d75e`

The first implementation commit is not the acceptance point. B2.3-B2.4 are reopened for three causal
evidence gaps:

1. The Server fixture subscribed through `createRootContextSubscription` rather than the public
   `planningConfig.subscribeProjectBinding` route consumed by Config. It also selected Root B through
   mutable test state before the write, so the launch config was not the causal root-selection input.
   The correction must derive the mocked Doctor/Context root from the written launch config and observe
   A -> refreshing(A) -> B through the public Project Binding subscription.
2. The ready-path assertion checked only root path and Store id. The public result must also prove root
   source, data scope, diagnostics, and Doctor/Context raw stdout, stderr, exit status, and contract
   evidence. A typed Router error-envelope fixture must exercise `preview-error`; a synthetic Web object
   is not enough.
3. Web cleared dirty state when the subscription declarations matched `launchWrite.binding`, even if
   the subscribed Root Context was still A or was an error. Matching declarations are necessary but
   insufficient. Convergence requires a ready subscription preview with the same planning-root
   path/source, Store id, and data-scope path/source as the ready mutation preview. A subscription error
   keeps the written draft and current error visible and restores the launch-owned repair path.

Construction constraints remain unchanged: no W3 transport behavior, no generic generation barrier,
no retry/fallback success, and no timing sleep as convergence evidence. The existing 250ms red boundary
only proves that a regressed mutation is still blocked by A; the success path is driven by explicit
refreshing and ready subscription signals.

## Independent review after `c85ce12`

Focused Server `3/3`, Web `16/16`, and checked transport typecheck pass, but they do not close the
Change. Review found four blocking contract gaps:

1. `ProjectBindingUpdateResult` models `rootPreview` and `transition` independently, so contradictory
   `ready + preview-error` and `error + converging` values remain type-correct.
2. The error fixture makes both CLI projections lose Root B. It therefore proves raw failure evidence but
   not the required preservation of known planning-root/source/Store provenance through a partial CLI
   failure. The corrected fixture must resolve B through Doctor and fail Context.
3. `write-complete` is currently produced after raw `mkdir/writeFile + updateReactiveFileCache`. It does
   not use the shared physical/reactive owner, reject `openspec/config.*` symlink escape, or prove all
   overlapping reactive projections settled before the reread.
4. Web locks every declaration control while convergence is pending or the subscription is errored. This
   contradicts the launch-owned repair contract. Simply unlocking creates a second defect: an old B
   emission can clear a newer C draft. Each save therefore needs draft-generation identity, and editing C
   must retire pending B evidence before B can settle UI state.

The public RPC also needs a direct contract comment. The next worker must show mutation-resistance by
removing/bypassing the physical owner, correlated pair, ready identity comparison, and pending-generation
retirement in turn. A disabled button or a green final test alone is insufficient. The bounded browser
run against `c85ce12` is candidate characterization only; final direct-Web and clean SSG evidence must run
on the corrected SHA.

## B2.1-B2.4 correction implementation (2026-07-19)

The public result is now a correlated union:

```text
write-complete + ready Root preview + converging transition
write-complete + error Root preview + preview-error transition
```

The checked transport fixture proves both variants exist and that neither contradictory cross-pair is
assignable. The Router constructs each branch separately and the public mutation procedure documents that
its detached preview is evidence, while the subscription remains convergence authority.

`writeProjectBindingConfig` now delegates only its launch-owned `openspec/config.yaml|yml` target to
`writePhysicalReactiveFile`. The owner resolves the launch root physically, rejects external mutation
through intermediate and final symlinks without changing the referenced files, settles overlapping
file/directory/existence/stat projections, then the service rereads the settled file to create
`launchWrite`. Environment-global and Active-root behavior were not refactored in this W2 slice.

Independent review on 2026-07-20 tightened the public RPC documentation to state that the returned
transition id is mutation-local and is not echoed by the authoritative Root Context subscription. It also
added a successful pre-existing `config.yml` counterexample: the physical owner preserves the yml path,
returns with a consistent reactive file/directory/existence/stat snapshot, leaves `config.yaml` absent,
and rereads matching disk, file-format, content, Store, and Reference evidence.

The partial failure fixture now writes `store-b`, lets Doctor successfully resolve Root B, and makes Context
return a typed nonzero failure. The error attempt retains B path/source/Store, inherited data scope, parsed
Root facts, raw Doctor/Context stdout, stderr, exit status, diagnostics, and absent contract drift. The
transition error is asserted equal to the Root preview error.

Web draft/convergence state moved to `use-project-binding-settlement.ts`. Only an in-flight HTTP mutation
locks controls. Stale Root A, stale data scope, Root error, and subscription transport error retain the
written draft plus a usable launch repair path. Each save records the current draft generation; any edit
increments the generation and retires its pending result before a late older emission can settle or replace
the newer draft.

### Actual red evidence

Before production correction:

```text
pnpm --filter @openspecui/server run typecheck:transport-tests
  failed TS2322 twice: true was not assignable to false because neither correlated variant existed

pnpm --filter @openspecui/server exec vitest run \
  src/planning-config-project-binding-write.test.ts --no-file-parallelism
  4/4 failed: cached file/dir/exists/stat remained stale; intermediate openspec and final
  config.yaml/config.yml symlinks all resolved and wrote the external file instead of rejecting

pnpm --filter @openspecui/web exec vitest run \
  src/components/config/project-binding-section.test.tsx --no-file-parallelism
  3 failed: stale A and retained subscription-error controls remained disabled, so C could not be edited
```

Mutation-resistance was then executed against the green implementation:

```text
# Bypass sameRootIdentity and retain binding equality only
pnpm --filter @openspecui/web exec vitest run \
  src/components/config/project-binding-section.test.tsx --no-file-parallelism \
  -t 'does not settle when subscription B still carries|does not settle when Root B identity'
  2 failed: both projections were relabeled Saved

# Replace editedState pending:null with pending:state.pending
pnpm --filter @openspecui/web exec vitest run \
  src/components/config/project-binding-section.test.tsx --no-file-parallelism \
  -t 'retires pending convergence exactly'
  1 failed: expected pendingConvergence to be null, received the old B result
```

Both mutants were immediately reverted. One earlier hook-test attempt constructed a fresh config object on
every render and exhausted the worker heap; it was discarded as a fixture error, changed to a stable input,
and is not counted as product evidence.

### Focused green evidence

```text
pnpm --filter @openspecui/core exec vitest run src/planning-config.test.ts
  1 file / 4 tests passed
pnpm --filter @openspecui/server exec vitest run \
  src/planning-config-project-binding-write.test.ts src/planning-config-service.test.ts \
  src/planning-config-router.test.ts src/router.test.ts --no-file-parallelism
  4 files / 103 tests passed
pnpm --filter @openspecui/web exec vitest run \
  src/components/config/project-binding-section.test.tsx src/routes/config.test.tsx \
  --no-file-parallelism
  2 files / 28 tests passed
pnpm --filter @openspecui/core typecheck
pnpm --filter @openspecui/server typecheck
pnpm --filter @openspecui/web typecheck
  all passed
pnpm format:check
pnpm lint:ci
git diff --check
  passed on the final B2.1-B2.4 candidate
```

B2.1-B2.4 are implemented. B2.5 remains open: this slice does not run or claim clean SSG, direct-Web,
full repository gates, independent review, push, merge, archive, release, W3, or `6.12+`.
