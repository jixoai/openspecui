## Why

OpenSpecUI still exposes a legacy “Project” tab that hard-binds `project.md` and `AGENTS.md`, but OpenSpec 1.1.x moved project configuration into `openspec/config.yaml` with schema-driven workflows. As a result, the UI hides core OPSX configuration (schema resolution, templates, and change metadata) behind a generic Settings panel while surfacing files that are no longer standard. We need a first-class OPSX Config Center that matches current CLI behavior and user expectations.

## What Changes

- **BREAKING**: Replace the legacy Project view (project.md/AGENTS.md editor) with a dedicated OPSX Config Center.
- Introduce a Config Center view (tabbed: Config / Schemas / Changes) that surfaces:
  - `openspec/config.yaml` (schema/context/rules)
  - Schema resolution (project/user/package, shadowing info)
  - Artifact template mappings per schema (from `openspec templates --json`)
  - Change metadata (`.openspec.yaml`) with change selector and explanation
- Add explicit edit modes:
  - Config.yaml is read-only by default with Edit/Save/Cancel
  - Schema.yaml + templates are editable for project/user sources (package sources stay read-only)
- Add schema management utilities:
  - Preview-focused schema view parsed from schema.yaml (no raw dump in read-only)
  - Edit view with file list + editor, plus Preview toggle for validation
  - Add/delete schema actions via CLI-backed scaffolding
- Refocus Settings to runtime/UI configuration (theme, CLI health, tool detection), moving OPSX configuration details out of Settings.
- Use official CLI outputs for schema list, resolution, and template map; read schema.yaml from resolved paths for detail.

## Capabilities

### New Capabilities
- `opsx-config-center`: Dedicated OPSX configuration hub covering config.yaml, schemas/templates, and change metadata with explicit edit modes.

### Modified Capabilities
- `opsx-ui-views`: Replace Project entry with Config, add tabbed layout, and align section organization.
- `opsx-workflow-ui`: Expand configuration visibility to include templates embedded in schema detail and edit affordances where allowed.
- `openspec-cli-integration`: Add CLI queries for schema list, schema resolution, and template mapping.
- `opsx-artifact-editor`: Default to read-only and require explicit user action to enter edit mode (unchanged).

## Impact

- **Web UI**: New route and components for Config Center; remove Project route; update navigation.
- **Web UI**: Tabbed Config layout with explicit edit modes; schema + template editing when allowed.
- **Server**: Add/extend endpoints for templates and schema resolution (CLI-backed).
- **Core types**: Add types for template map and schema resolution display.
- **Static export**: Include Config Center data in snapshots.
- **Tests**: Update route/navigation and CLI integration tests.
