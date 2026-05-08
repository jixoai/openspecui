## Implementation State

- OpenSpec change scaffold created for `opsx-agent-invocation-modes`.
- Added `opsx.agentInvocationMode` to core config schema, defaults, update type, persistence pruning, and server config update input.
- Exported the new core config schema/type for downstream type-safe consumption.
- Added `packages/web/src/lib/opsx-agent-invocation.ts` as the shared Web invocation rule for action capability fallback and payload generation.
- Updated Quick Propose to support compose/command mode, persist the selection globally, and preview the actual terminal payload.
- Refined Quick Propose and Settings to use the shared ButtonGroup atom for compose/command selection, and aligned Quick Propose terminal target placement with the compose send action group.
- Tightened the shared ButtonGroup atom to shrink to content inside column flex layouts instead of stretching full width.
- Updated `/opsx-compose` to honor global preference for command-equivalent actions and to keep compose fallback for selected-artifact actions.
- Updated Settings with an OPSX Invocation section.
- Updated dashboard/change-list copy to point users at Quick Propose instead of command-only `/opsx:propose` wording.
- Updated static config defaults with `opsx.agentInvocationMode`.
- Added targeted tests for config and invocation helpers.
- Local verification passed:
  - `openspec validate opsx-agent-invocation-modes --type change --strict`
  - `pnpm --filter @openspecui/core test -- src/config.test.ts`
  - `pnpm --filter @openspecui/web test -- src/lib/opsx-agent-invocation.test.ts src/lib/opsx-compose.test.ts src/lib/static-data-provider.dashboard.test.ts`
  - `pnpm --filter @openspecui/server test -- src/router.test.ts`
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter @openspecui/web build:dist`
- Browser walkthrough passed against source dev server (`http://localhost:13003`, backend
  `http://localhost:3914`), with screenshots under `/tmp/openspecui-opsx-invocation-browser`:
  - Settings Command and Compose buttons persisted/restored `opsx.agentInvocationMode`.
  - Dashboard Start Propose opened Quick Propose.
  - Changes empty-state Start Propose opened Quick Propose in a temporary empty project.
  - Quick Propose Compose and Command buttons switched payload previews correctly.
  - Quick Propose Advanced opened Create OPSX Change.
  - Change Apply and Archive buttons produced `/opsx:apply` and `/opsx:archive` command payloads in command mode.
  - Change Continue and direct fast-forward routes fell back to compose mode and did not emit `/opsx:continue` or `/opsx:ff`.
- Follow-up UI walkthrough passed against refreshed CLI-served dist (`http://localhost:3103`), with screenshots under `/tmp/openspecui-settings-button-group-dist.png` and `/tmp/openspecui-propose-action-group-dist.png`:
  - Settings OPSX Invocation renders the shared Compose/Command ButtonGroup with `aria-pressed`.
  - Quick Propose renders the shared Compose/Command ButtonGroup with `aria-pressed`.
  - Quick Propose places the Target select and Send button in the same footer action group.

## Decisions Taken

- Store invocation preference in project-level OpenSpecUI config, not OpenSpec CLI global config.
- Default to `compose` because it is the least surprising mode for skills-only installations and does not depend on command installation.
- Treat command capability as an action semantic property, not as a terminal installation probe.
- Keep Web helper type aligned to core via type-only import/export to avoid a second enum law.

## Divergence Notes

- The implementation does not attempt automatic slash command availability detection because the selected terminal can represent any agent/runtime, and the UI cannot reliably prove that agent's live slash command registry.
- The OpenSpec artifact shape follows the repository's current `opsx-collab-pr-loop` schema instead of creating legacy delta specs.

## Loopback Triggers

- If maintainers require automatic command availability detection, return to research-plan and define an explicit terminal-agent capability contract first.
- If `/opsx:continue` or `/opsx:ff` later gain selected-artifact command semantics, update the command-capability map and tests.
- If invocation preference should become per-user rather than per-project, return to research-plan before changing config storage.
