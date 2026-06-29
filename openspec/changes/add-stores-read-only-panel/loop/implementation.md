## Implementation State

Status: **Not started** — planning approved, implementation pending kickoff.

Plan reference: `research-plan.md` sections A–F. The work is sequenced so the version-law update (A) lands first, since it is the hard prerequisite for any 1.5.0 user reaching the Stores panel.

Pending steps (will be checked off as code lands):
- [ ] A. Update `packages/core/src/openspec-compat.ts` version constants + tests.
- [ ] B. Add `packages/core/src/store-types.ts` (Zod schemas + types), export from `index.ts`.
- [ ] C. Add `CliExecutor.listStores()` / `doctorStores(id?)`.
- [ ] D. Add `storesRouter` in `packages/server/src/router.ts`, mount on `appRouter.stores`.
- [ ] E. Add `packages/web/src/components/stores/stores-panel.tsx` + Beta badge + subscription hook + nav mount (live-only).
- [ ] F. Add `.changeset/*.md`.
- [ ] Run local CI-equivalent checks.
- [ ] Open PR.

## Decisions Taken

- **Version-law is in-scope and first**: 1.5.0 currently falls outside `OPENSPEC_CLI_ACCEPTED_RANGE` and would block core interactions, so the compatibility bump is a prerequisite, not a nice-to-have.
- **No direct registry parsing**: all store data flows through `openspec store list/doctor --json` to avoid `<dataDir>` resolution drift and respect CLI-First.
- **Polling subscription**: the registry lives under `~/.local/share/openspec` (outside `projectDir`), so the reactive watcher cannot observe it; `stores.subscribe` will poll on an interval with `timer.unref()` plus a manual refresh control.
- **Spec deltas chosen**: MODIFY `openspec-cli-integration` (version law + add Stores CLI query mapping) and ADD to `opsx-ui-views` (Stores Discovery Panel Beta). Both validate cleanly via `openspec validate`.

## Divergence Notes

- Initial plan did not call out the version-law blocker; it surfaced during spec-delta authoring when `openspec-compat.ts` was inspected. Intake, research-plan, and the `openspec-cli-integration` delta were updated to keep all artifacts consistent. This is a scope expansion relative to the first draft, recorded here for traceability.

## Loopback Triggers

- (none yet) If the polling interval proves too noisy or the CLI `store doctor` latency is high for many stores, loop back to research-plan to reconsider the doctor-on-demand vs. eager-evaluation tradeoff.
