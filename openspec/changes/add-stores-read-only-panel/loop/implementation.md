## Implementation State

Status: **Implemented** — all planned steps landed; local CI-equivalent checks + SSG guard + `openspec validate --strict` pass.

Completed steps:
- [x] A. Version-law bump in `packages/core/src/openspec-compat.ts` + tests. 1.5 is target, 1.4 stays current via new `isCurrentRecommended` (recommended range `>=1.4.0 <1.6.0`), 1.3 legacy, accepted `>=1.3.0 <1.6.0`, reference tag `v1.5.*`.
- [x] B. `packages/core/src/store-types.ts`: lenient passthrough zod + `StoreFeatureError` (two kinds) + `StoreFeatureResult` + `classifyStoreCliOutput`/`toStoreFeatureResult`; exported from `index.ts` and new `./store-types` subpath.
- [x] C. `CliExecutor.listStores()` / `doctorStores(id?)` (raw CliResult; classification at router layer).
- [x] D. `storesRouter` (list/doctor/subscribe) in `packages/server/src/router.ts`; every path wrapped, never throws, carries cached `cliVersion` (30s TTL); polling subscription (5s, unref).
- [x] E. `packages/web/src/routes/stores-list.tsx` + `use-stores-visibility.ts`; Beta badge; data→list; data-incompatible→error+version; command-unavailable→hide entry (nav filters via visibility hook); live-only; defensive render. Registered in nav-items / nav-controller / route-tree.
- [x] F. `.changeset/stores-beta-discovery.md` (core/server/web minor).
- [x] G. Local checks pass: `format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`, SSG build (`static-data-provider` has no stores wiring), `openspec validate --strict`.

## Decisions Taken

- **Beta ≠ version gate**: Stores availability is decided at runtime by fault tolerance, not by the version-law gate. This is the core paradigm shift from the first draft.
- **Two failure kinds, two reactions**: data-incompatible (CLI exits 0 but zod fails) → objective error + version source; command-unavailable (non-zero exit / missing subcommand) → hide entry.
- **Lenient zod**: `passthrough()` + optional fields so additive CLI changes don't trigger false errors.
- **Version source reuse**: `cliVersion` comes from the existing `trpc.cli.checkAvailability().version`, no new version channel.
- **Version-law bump stays in scope** but reframed as independent stable maintenance (1.5.0 currently hard-blocks the main gate via `blocksCoreInteractions`).
- **Spec deltas**: MODIFY `openspec-cli-integration` (version law + ADD Beta Feature Fault Tolerance + Stores CLI Query Mapping); ADD to `opsx-ui-views` (Stores Discovery Panel Beta).

## Divergence Notes

- **Revision 2**: the first approved plan made Stores depend on a version-law bump and used a single "degradation message" for CLI<1.5.0. The manager redirected: beta features must not rely on version compatibility and must tolerate failures with strong runtime robustness, surfacing version source on errors. intake, research-plan, and both spec deltas were rewritten to encode the two-kind fault-tolerance model. The version-law bump is retained but decoupled.
- **Revision 1** (earlier): added the version-law blocker as a prerequisite after discovering `openspec-compat.ts` blocked 1.5.0.

## Loopback Triggers

- (none yet) If the exit-code heuristic misclassifies a real data-incompatible case as command-unavailable (e.g., a CLI that exits non-zero on parse-internal errors), loop back to refine the classifier in research-plan.
- If polling the stores list proves noisy, loop back to reconsider interval/refresh UX.
