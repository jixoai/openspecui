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
- Default translation engine ownership is now global; project ownership is an explicit opt-in detected from persisted project config field presence.
- Local-llama runtime planning now performs a model-size-aware memory preflight before `node-llama-cpp` model loading.

## Divergence Notes

- No product-scope divergence from the approved intake has been accepted.
- One implementation refinement was required during execution:
  - worker isolation stayed as an explicit executor strategy instead of becoming the hardcoded default inside `TranslationEngineService`,
  - runtime strategy ownership was centralized in the service to avoid smearing memory-budget logic across both service and host assembly code.
- One runtime-strategy correction was made during self-review:
  - worker memory budgeting now prefers `process.constrainedMemory()` and otherwise falls back to `os.totalmem()`,
  - it no longer derives the budget from transient `process.availableMemory()`, which would undercut the user-facing intent parameter.
- One follow-up correction was made after the local-llama resource discussion:
  - Apple Silicon/unified-memory defaults now use a conservative power-saver plan at the default 25% budget,
  - local-llama model loading is rejected before `loadModel()` when estimated model/context/native memory exceeds the safe runtime budget,
  - deterministic tests inject a runtime-memory snapshot instead of depending on the host machine's current free memory.
- One ownership readiness correction was made during verification:
  - the Settings UI now resolves the effective engine from the shared project-presence/global fallback resolver,
  - engine selection waits for the project presence signal and only waits for global settings when the project does not own `translation.engineId`.
- One native runtime isolation correction is being applied after a real `node-llama-cpp` crash:
  - native-crash-risk engines are moved from worker-thread isolation to process isolation,
  - local-llama uses the process host so native aborts become classified runtime failures instead of server process exits,
  - the same memory budget strategy feeds both JS heap limits and a process RSS watchdog.
- One process lifecycle correction is being applied after a real process-host observation gap:
  - child-process `disconnect` and `close` are promoted into first-class failure signals alongside `error` and `exit`,
  - one idempotent reducer owns all abnormal process termination paths,
  - per-batch process hosting remains the current law, and the next batch invocation creates the replacement process host.
- One runtime-budget correction is being applied after a false local-llama rejection:
  - unified-memory budget preflight no longer treats transient `os.freemem()` as a hard budget cap,
  - the user-selected percentage remains anchored to total/constrained memory,
  - the process RSS watchdog remains the runtime enforcement boundary for the selected budget.
- One translation-settings ownership correction is being applied after follow-up review:
  - managed-local lifecycle checks no longer import/probe runtimes on engine selection,
  - Settings prompts users to run Test Translate manually for errors and latency,
  - scalar `translation.*` fields default to global settings with explicit project override support,
  - model-selection writes use the related `translation.engines.*` ownership instead of `translation.engineId`.
- One patch-shape correction was required after real UI verification:
  - `config.update` and `globalSettings.update` now use dedicated update schemas instead of full schemas with defaults,
  - this preserves partial writes such as `displayMode` or `enabled` without rehydrating sibling defaults and overwriting the previous write.
- One markdown-table rendering correction was required after follow-up bug review:
  - HAST table-cell segments now keep `sourceKind: tableCell` instead of collapsing to `paragraph`,
  - `MarkdownContent` now applies translation block annotations to `th/td`, so bilingual table cells render translated targets instead of staying source-only.

## Loopback Triggers

- If a heavy local engine cannot support per-input timeout/error isolation without unsafe runtime hacks, loop back and revise the strategy boundary before widening UI promises.
- If retry UX requires target-specific rendering behavior that cannot be expressed through the shared segment renderer, loop back and re-evaluate the renderer law instead of hardcoding engine-specific UI branches.
- If CI or BDD checks reveal that partial-error streaming breaks existing translation availability flows, loop back through the research-plan and update the execution order before continuing.
- If future managed-local engines need process isolation beyond the current host selector, loop back and promote the host selector into per-engine manifest metadata rather than branching UI/runtime flow.
