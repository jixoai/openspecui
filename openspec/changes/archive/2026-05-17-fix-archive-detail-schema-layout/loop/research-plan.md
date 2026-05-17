## Research Findings

- `ArchiveList` is directory-based: it lists directories under `openspec/changes/archive/`.
- `ArchiveView` is not directory-based: it subscribes to `archive.subscribeOne`, which returns `DocumentService.readArchivedChange(id)`.
- `DocumentService.readArchivedChange(id)` and `OpenSpecAdapter.readArchivedChange(id)` parse a legacy `Change` object.
- `OpenSpecAdapter.readArchivedChangeRaw(id)` still treats root `proposal.md` as the existence gate for archived detail.
- `MarkdownParser.parseChange()` is intentionally spec-driven: it knows `Why`, `What Changes`, tasks, and delta specs.
- `DocumentService.processChangeFile()` only assigns document identities to `proposal.md`, `tasks.md`, `design.md`, and `specs/<id>/spec.md`.
- Static export compresses active/archived changes into proposal/tasks/design/deltas, then reconstructs folder files from that compressed shape.
- Static runtime has its own artifact output helpers that reconstruct files from legacy change fields and fallback artifact IDs.
- Search and dashboard still derive archive content/statistics from parsed `Change` data.
- The failed implementation direction replaced spec-driven coupling with `loop/*` coupling, which is still schema-specific and unsuitable for OPSX custom schemas.

## Platform Diagnosis

The current platform law is inconsistent:

- Active change detail uses OPSX schema artifacts from CLI status.
- Archive detail uses legacy OpenSpec `Change`.
- Static export uses a third projection that serializes legacy fields.
- Markdown hook identity uses a fixed list of official document kinds.

This is not one broken page. It is a broken platform boundary. The system treats structure as truth, but OPSX's actual product law is that structure is schema-defined and may drift over time.

## Decision

Adopt a schema-neutral OPSX entity read model.

- Entity identity is stage plus directory id:
  - active: `openspec/changes/<id>`
  - archive: `openspec/changes/archive/<id>`
- Entity truth is its readable file tree.
- Schema metadata is optional context:
  - parse `.openspec.yaml` best-effort for `schema`;
  - resolve schema detail best-effort when available;
  - match schema artifacts to files through output paths;
  - collect diagnostics instead of throwing when schema data is missing or invalid.
- Unknown schemas still render through an ungrouped file view and Markdown documents still flow through `onReadDocument`.
- Known schemas render artifact tabs derived from schema artifacts, not hardcoded filenames.
- Legacy `Change` parsing remains only for places that explicitly need spec-driven semantics; it is not the archive detail platform model.

## Utility Law

Create shared utilities around an `OpsxEntityDetail` model:

- normalize entity/file paths once;
- parse change metadata YAML best-effort once;
- parse schema YAML/detail best-effort once;
- classify Markdown files and build `DocumentRefV1` values once;
- match direct and glob artifact output paths once;
- build entity artifact groups once;
- return non-fatal diagnostics instead of hiding entities.

Live server, static export, and static runtime SHALL call these utilities rather than reimplementing mapping locally.

## Implementation Plan

1. Rewrite OpenSpec change artifacts for the breaking schema-neutral detail model.
2. Add failing tests:
   - custom schema archive with no root `proposal.md` returns entity detail;
   - unknown schema archive still returns file detail and diagnostics;
   - Markdown artifact processing calls `onReadDocument` with generic artifact identity;
   - archive route renders entity artifact/file content instead of not-found.
3. Add core `opsx-entity` utilities and types.
4. Refactor `OpenSpecAdapter` to expose directory/file based entity reads for active and archived changes.
5. Refactor `DocumentService` to process entity detail files/artifacts through `onReadDocument`.
6. Refactor archive router/subscription and web archive view to consume entity detail.
7. Update static snapshot/export/runtime to preserve entity detail with the same utility mapping.
8. Run focused tests, typechecks, SSG build if snapshot shape changes, and OpenSpec validation.

## Risks and Mitigations

- Risk: Schema detail is unavailable for old archives.
  Mitigation: Show ungrouped files plus diagnostics; never return not-found when the directory exists.
- Risk: Static and live detail drift.
  Mitigation: Put mapping logic in core utilities and make static runtime consume stored entity details.
- Risk: Dashboard/search lose task-specific numbers for non-spec-driven archives.
  Mitigation: Treat task statistics as optional structured facts; fall back to file content and objective counts when no compatible task artifact exists.
- Risk: Hook consumers depend on old `proposal/tasks` kinds.
  Mitigation: Introduce generic `artifact` document refs for schema artifacts and keep old kinds only for explicit legacy files.
