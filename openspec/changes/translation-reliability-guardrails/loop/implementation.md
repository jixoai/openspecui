## Implementation State

- The translation contract upgrade is now implemented end-to-end instead of remaining half-migrated:
  - translator options and batch events carry per-item `timeoutMs` and `output | error` results,
  - service-side translators normalize timeout/runtime/memory/abort outcomes without collapsing the whole batch,
  - managed local global settings persist per-engine `memoryBudgetPercent`.
- Heavy local runtime control is now wired through one shared backend law:
  - `resolveManagedLocalRuntimeStrategy()` maps the intent-level memory budget into engine-specific runtime config and worker policy,
  - `TranslationEngineService` owns that strategy resolution and passes both `runtimeConfig` and worker `resourceLimits` into the managed-local executor boundary,
  - the worker executor remains explicitly host-injected, so the service default stays direct for tests and source-runtime ergonomics.
- The web translation pipeline now consumes the new backend truth coherently:
  - Test Translate exposes timeout input with the shared default,
  - document translation accepts partial segment failures,
  - failed segments expose targeted retry flows instead of forcing a whole-document reset.

## Decisions Taken

- Treat partial failure as the new platform law for translation batches instead of layering one-off retry hacks in the document renderer.
- Keep the front end as a thin renderer of backend/runtime truth, but make segment-level failure visible and actionable in the renderer.
- Treat `memoryBudgetPercent` as both a stored configuration parameter and an intent-level strategy input; per-engine runtime mapping remains specialized.
- Restrict worker isolation to heavy local engines in this loop, because network/browser engines do not share the same resource-risk profile.
- Keep runtime-strategy ownership inside `TranslationEngineService` rather than duplicating global-settings logic in `server.ts`; the host injects the executor boundary, while the service computes the execution plan.
- Use shared timeout constants instead of per-surface magic numbers so smoke tests and document translation default to one contract value.

## Divergence Notes

- No product-scope divergence from the approved intake has been accepted.
- One implementation refinement was required during execution:
  - worker isolation stayed as an explicit executor strategy instead of becoming the hardcoded default inside `TranslationEngineService`,
  - runtime strategy ownership was centralized in the service to avoid smearing memory-budget logic across both service and host assembly code.
- One runtime-strategy correction was made during self-review:
  - worker memory budgeting now prefers `process.constrainedMemory()` and otherwise falls back to `os.totalmem()`,
  - it no longer derives the budget from transient `process.availableMemory()`, which would undercut the user-facing intent parameter.

## Loopback Triggers

- If a heavy local engine cannot support per-input timeout/error isolation without unsafe runtime hacks, loop back and revise the strategy boundary before widening UI promises.
- If retry UX requires target-specific rendering behavior that cannot be expressed through the shared segment renderer, loop back and re-evaluate the renderer law instead of hardcoding engine-specific UI branches.
- If CI or BDD checks reveal that partial-error streaming breaks existing translation availability flows, loop back through the research-plan and update the execution order before continuing.
- If future managed-local engines need process isolation that is not expressible via the current worker protocol, loop back and introduce a broader executor strategy interface rather than branching the UI/runtime flow.
