# Implementation Notes

## Platform Updates

- Added a V1 hook type surface in `@openspecui/core` and public `openspecui/hooks` export path.
- Added project hook loading for `openspec/openspecui.hooks.ts` in the server/executable layer.
- Added `DocumentService` as the shared source/processed markdown projection law for live view, search, and static export.
- Added `WorkflowInvocationService` as the OPSX final invocation payload law for `agent-prompt`, `agent-command`, and `cli-command` results.
- Static export now stores processed content plus raw source fields, so enriched publishing/search does not destroy raw audit data.

## Atoms Created or Modified

- Modified live spec/change/archive reads to use processed document service while raw endpoints stay on adapter source reads.
- Modified search indexing to consume processed documents when the service is available.
- Modified static export/static provider to preserve source content for raw views and use processed content by default.
- Modified OPSX propose/compose/new/verify entrypoints to request final invocation payloads from the server service.
- Added focused tests for hook loading, source bypass, processed enrichment, fail-open diagnostics, search/export parity, workflow override, and router delegation.

## Loopback Triggers

- If hook loading requires a package dependency not acceptable for publishable packages, pause and revisit loader strategy.
- If routing all OPSX actions through server creates excessive frontend churn, implement a narrow server service first and migrate actions incrementally.

## Verification Notes

- `pnpm --filter @openspecui/server test -- src/router.test.ts src/hook-runtime.test.ts src/document-service.test.ts src/search-service.test.ts src/workflow-invocation-service.test.ts`
- `pnpm --filter openspecui test -- src/export.test.ts`
- `pnpm --filter @openspecui/core typecheck`
- `pnpm --filter @openspecui/server typecheck`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm --filter openspecui typecheck`
