## Implementation State

Status: **Not started** — revised plan approved (beta fault-tolerance paradigm), implementation pending kickoff.

The plan was revised to center on the **beta feature fault-tolerance model**: Stores does NOT rely on the stable version gate; instead it tolerates CLI absence/incompatibility at runtime, classifying failures into two kinds (data-incompatible → show error + version; command-unavailable → hide entry). The version-law bump (A) remains, but as independent stable maintenance, not a Stores prerequisite.

Pending steps (checked off as code lands):
- [ ] A. Update `packages/core/src/openspec-compat.ts` version constants + tests (stable maintenance, independent of Stores).
- [ ] B. Add `packages/core/src/store-types.ts`: lenient zod schemas + `StoreFeatureError` (two kinds) + `StoreFeatureResult`; export from `index.ts`.
- [ ] C. Add `CliExecutor.listStores()` / `doctorStores(id?)` + a classification helper (exit-code + zod → ok / data-incompatible / command-unavailable).
- [ ] D. Add `storesRouter` in `packages/server/src/router.ts` (list/doctor/subscribe); every endpoint wraps try/catch, returns `StoreFeatureResult`, never throws; `cliVersion` from `checkAvailability`.
- [ ] E. `packages/web/src/components/stores/stores-panel.tsx`: Beta badge; data→list; data-incompatible→error+version; command-unavailable→hide entry; live-only; defensive render.
- [ ] F. Add `.changeset/*.md`.
- [ ] Run local CI-equivalent checks.
- [ ] Open PR.

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
