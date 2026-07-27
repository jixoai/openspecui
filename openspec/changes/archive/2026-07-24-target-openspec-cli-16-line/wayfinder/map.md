<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Index resolved adaptation decisions without duplicating their evidence.
2. Expose the current decision frontier before formal OpenSpec artifacts are written.
3. Bound work excluded from the OpenSpec 1.6 adaptation.

Original request (2026-07-14): "使用 $wayfinder 和我讨论具体的适配计划。我们最终使用openspec来管理 wayfinder 产出的文档。"
-->

# OpenSpec CLI 1.6 adaptation map

Status: closed

## Destination

Reach an implementation-ready OpenSpec change for the OpenSpecUI 6.x / OpenSpec CLI 1.6 line, with every root, Reference, workflow, project page, and App responsibility decided before artifacts converge under `loop/`.

## Notes

- This is a planning map. Implementation begins only after its decisions converge into formal OpenSpec artifacts.
- Use the checked-out `references/openspec` v1.6.0 source and tests as the upstream authority.
- Keep research, tickets, and this map under this change's `wayfinder/` directory.
- Preserve the CLI-first, root-correct, product-story-first constraints recorded in repository guidance.

## Decisions so far

- [Audit the OpenSpec 1.4 to 1.6 contract](tickets/audit-openspec-14-to-16.md) — The 1.6 line must include unresolved 1.4 workflow and 1.5 root/Store contracts, not only the new 1.6 surfaces.
- [Decide the OpenSpec data-scope boundary](tickets/decide-openspec-data-scope.md) — OpenSpecUI inherits `XDG_DATA_HOME` and does not add project-local registries, environment files, or overlays.
- [Set the App and project surface boundary](tickets/set-app-project-surface-boundary.md) — Store Manager belongs to the experimental App and needs a closure prototype, but production Store mutation is not a 6.0 release gate.
- [Select the Store Manager information architecture](tickets/select-store-manager-information-architecture.md) — Store Inspector is primary, Context Matrix is a sibling view, and Registry Table becomes the wide-screen Inventory view.
- [Specify the hosted environment and Store mutation protocol](tickets/specify-hosted-environment-store-protocol.md) — `envUri`, optional backend access, objective CLI projections, backend-owned mutations, and multi-root reactive invalidation define the App-to-backend boundary.
- [Define the task progress projection](tickets/define-task-progress-projection.md) — Formal tracked tasks drive workflow state, while document-wide checklists remain separately named secondary analytics and Apply preserves its raw CLI result.
- [Define the referenced-spec static export policy](tickets/define-referenced-spec-static-export-policy.md) — Live and static share a source-aware Spec Catalog; direct Reference export requires explicit include/omit consent and machine-sensitive provenance is removed.
- [Converge Wayfinder decisions into OpenSpec artifacts](tickets/converge-wayfinder-decisions-to-openspec-artifacts.md) — The declared `opsx-collab-pr-loop` artifacts under `loop/` are complete and apply-ready; Wayfinder is retained only as decision provenance.

## Not yet specified

None. The destination is reached; implementation is tracked only by the formal `loop/` artifacts.

## Out of scope

- Project-owned `openspec/.env`, `StoreRoot`, registry overlays, and OpenSpecUI-authored Store registry files.
- Automatic Store Git clone, pull, push, or synchronization.
- Turning one project tab into a multi-root writable workspace.
- Adding Workset orchestration before its independent product story is charted.
