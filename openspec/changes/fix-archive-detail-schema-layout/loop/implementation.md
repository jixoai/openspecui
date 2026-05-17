## Implementation State

Spec rewrite in progress for a breaking schema-neutral entity detail model.

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
- Static export/runtime atoms: preserve and consume entity detail without rebuilding a legacy `Change` projection.

## BDD Targets

- RED: Archive detail for a custom schema archive without root `proposal.md` returns entity data.
- RED: Unknown schema archive returns files and diagnostics instead of null.
- RED: Custom artifact Markdown invokes `onReadDocument` with `kind: "artifact"`.
- RED: `/archive/<archive-id>` renders entity content and does not show `Archived change not found:`.

## Verification Evidence

- Pending.
