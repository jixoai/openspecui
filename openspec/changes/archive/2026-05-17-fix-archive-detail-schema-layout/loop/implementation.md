## Implementation State

Implementation is complete pending final broad verification and commit.

## Architecture Boundary

Platform law:

- OPSX entity detail is a directory/file/artifact read model.
- Schema-driven artifact grouping is optional and best-effort.
- Legacy spec-driven `Change` parsing is not the platform detail contract.
- Information display wins over structural validation when schema binding is missing or stale.

Atom responsibilities:

- Core utility atom: path normalization, metadata parsing, schema detail parsing, artifact matching, diagnostics, entity detail assembly.
- Core adapter atom: reactive directory/file reads for active and archived entity roots.
- Server document atom: `onReadDocument` projection over generic artifact/file document refs.
- Web archive atom: render entity artifacts/files through shared MarkdownViewer and folder viewer.
- Web Markdown render atom: select document-specific render plugins from Markdown path/content only, with no page-owned schema props on `MarkdownViewer`.
- Static export/runtime atoms: preserve and consume entity detail without rebuilding a legacy `Change` projection.
- Search/dashboard atoms: consume archive entity files and directory identity instead of parsing archived `Change` projections.

## BDD Targets

- RED: Archive detail for a custom schema archive without root `proposal.md` returns entity data.
- RED: Unknown schema archive returns files and diagnostics instead of null.
- RED: Custom artifact Markdown invokes `onReadDocument` with `kind: "artifact"`.
- RED: `/archive/<archive-id>` renders entity content and does not show `Archived change not found:`.

## Verification Evidence

- RED observed:
  - `pnpm --filter @openspecui/core exec vitest run src/opsx-entity.test.ts` failed because `adapter.readEntityDetail` did not exist.
  - `pnpm --filter @openspecui/server exec vitest run src/document-service.test.ts` failed because `service.readEntityDetail` did not exist.
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts` failed because static archive detail still returned legacy `Change`.
- GREEN observed:
  - `pnpm --filter @openspecui/core exec vitest run src/opsx-entity.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/document-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/archive-view.test.tsx src/lib/static-data-provider.opsx.test.ts`
  - `pnpm --filter openspecui exec vitest run src/export.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/router.test.ts src/search-service.test.ts src/dashboard-overview-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/view-transitions/detail-prepare.test.ts src/lib/static-data-provider.dashboard.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.dashboard.test.ts src/lib/static-data-provider.opsx.test.ts src/routes/archive-view.test.tsx src/lib/view-transitions/detail-prepare.test.ts`
  - `pnpm --filter @openspecui/core typecheck`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter openspecui typecheck`
  - `pnpm --filter @openspecui/web build:ssg`
  - `pnpm exec openspec validate --all --strict --no-interactive`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/opsx/artifact-output-viewer.test.tsx src/components/markdown-viewer.test.tsx`

Notes:

- `pnpm --filter @openspecui/web build:ssg` passed with existing non-blocking CSS warning for `scroll-button` and existing dynamic import warning for `src/lib/trpc.ts`.
- Root `git diff --check` is still blocked by unrelated `CHAT.md` trailing whitespace from the parallel translation work; this change did not edit or stage that file.

## Self-Review Hardening

Follow-up work from self-review:

- Live entity detail must preserve schema parsing diagnostics, not only missing-schema diagnostics.
- Search indexing must use the same schema-aware entity read options as archive detail so artifact document refs include schema artifact identity when the schema is known.
- The public archive router must not keep a legacy raw endpoint whose existence contract still depends on root `proposal.md`.
- MarkdownViewer must remain the single generic Markdown entrypoint. OpenSpec rendering effects must be driven by `path` and Markdown content so nested spec documents in change/archive views cannot drift from the spec detail page.

Follow-up GREEN observed:

- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/opsx/artifact-output-viewer.test.tsx src/components/markdown-viewer.test.tsx`
- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/change-overview.test.tsx src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/opsx/artifact-output-viewer.test.tsx src/components/markdown-viewer.test.tsx src/routes/archive-view.test.tsx src/components/document-translation-action.test.tsx`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm exec oxlint packages/web/src/components/change-overview.test.tsx packages/web/src/components/markdown-viewer.tsx packages/web/src/components/markdown-viewer-open-spec-plugin.tsx packages/web/src/components/markdown-viewer-open-spec-plugin.test.tsx packages/web/src/routes/spec-view.tsx --ignore-path .gitignore`
- `pnpm exec openspec validate --all --strict --no-interactive`

Rendered follow-up evidence:

- `http://localhost:13003/specs/opsx-ui-views` rendered 12 OpenSpec requirement nodes with `REQ-01`, OpenSpec container class, ToC, and computed requirement indentation.
- `http://localhost:13003/archive/2026-03-11-add-hosted-app-distribution` rendered 10 OpenSpec requirement nodes across 4 nested spec documents with `REQ-01`, OpenSpec container class, ToC, and the same computed requirement indentation.
