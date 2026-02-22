## Context

OpenSpecUI currently exposes a legacy Project view that edits `project.md` and `AGENTS.md`, while OPSX 1.1.x moved project-level configuration into `openspec/config.yaml` and made schema.yaml + templates editable by users. The Settings panel already shows a partial OPSX configuration block (config.yaml + change metadata), but it is buried and incomplete. The UI also contains dedicated schema views; we now need a consolidated, first-class configuration surface that aligns with CLI outputs, supports editing of user-controlled schema assets, uses reactive file watching, and respects static export.

Constraints:

- UI must be CLI-driven (status, schemas, schema show, templates) and avoid local parsing.
- Replace Project view and nav entry with a single-word label: “Config”.
- Static export must include Config data in snapshots.

## Goals / Non-Goals

**Goals:**

- Replace Project view with a dedicated Config view (single word “Config”).
- Consolidate OPSX configuration surfaces: config.yaml, schema resolution, templates, change metadata.
- Provide explicit edit modes for config.yaml, schema.yaml, and templates when editable.
- Present configuration in a tabbed layout to reduce visual stacking.
- Provide schema preview/edit modes with a file list editor and structured preview.
- Support add/delete schema actions for project/user schemas.
- Back all Config data with official CLI JSON outputs where available.
- Preserve static export behavior and reactive updates.

**Non-Goals:**

- Do not reintroduce project.md/AGENTS.md editing (legacy-only).
- Do not implement new CLI features; only consume existing CLI outputs.
- Do not allow editing of package-provided schemas/templates (read-only).
- Do not broaden Settings beyond runtime/UI configuration (theme, CLI health, tool detection).
- Do not implement a full schema diff/merge UI (keep edit surface minimal).

## Decisions

1. **Create a dedicated Config route and remove Project**

- Rationale: OPSX 1.1.x no longer treats project.md/AGENTS.md as core config; using Config aligns navigation with CLI and user expectations.
- Alternative: keep Project and add Config as a tab. Rejected to avoid duplicative/legacy surface and reduce confusion.

2. **Config view is CLI-backed, with local reads only when CLI does not supply detail**

- Rationale: maintain CLI-as-source-of-truth principle; `openspec schemas` and `openspec templates` provide official lists, while schema.yaml is the authoritative detail file.
- Alternative: parse everything locally. Rejected due to divergence risk.

3. **Config sections map to OPSX concepts and are tabbed**

- Tabs: Config (config.yaml), Schemas (schema detail + templates), Changes (change metadata).
- Config.yaml: project config (schema/context/rules).
- Schemas: list + schema detail with source/resolution.
- Templates: artifact → template path mapping with source, embedded in schema detail.
- Change metadata: `.openspec.yaml` per change with selector + explanation.
- Rationale: mirrors `openspec schemas`, `openspec schema which`, `openspec templates`, and change metadata.

4. **Explicit edit modes**

- Config.yaml is read-only by default with Edit/Save/Cancel.
- Schema.yaml + templates are editable only for project/user sources.
- Rationale: avoid accidental edits and protect package-managed assets.

5. **Schema preview + editor split**

- Preview: show parsed schema.yaml in a structured view with template content embedded.
- Edit: provide file list (schema.yaml + templates) with a code editor and Preview toggle.
- Rationale: preview validates edited structure without forcing raw YAML in read-only mode.

6. **Static export includes Config data**

- Rationale: Config view must render in static mode without WebSocket access; maintain export parity.

7. **Settings panel refocus**

- Rationale: Settings should remain runtime/UI/CLI health and tool detection; OPSX config belongs in Config view.

8. **Explicit edit mode for artifacts**

- Rationale: avoid accidental edits; default to read-only and require an explicit user action to enter edit mode.

## Risks / Trade-offs

- **Risk**: CLI calls for templates/schemas may add latency. → **Mitigation**: cache last-known-good data and use reactive refresh triggers.
- **Risk**: Users relied on Project view for AGENTS.md visibility. → **Mitigation**: document migration and point to skills-based tooling in Settings.
- **Risk**: Static export snapshot size increases. → **Mitigation**: store only needed JSON fragments and avoid full template file contents.
- **Risk**: Users expect inline editing on open. → **Mitigation**: clear “Edit” action and visual read-only state.
- **Risk**: Editing schema/template may break workflows. → **Mitigation**: show validation errors from CLI where possible and keep package sources read-only.
- **Risk**: Add/delete schema actions could remove required workflows. → **Mitigation**: restrict deletion to project/user sources and confirm before delete.
