## 1. Navigation & Routing

- [x] 1.1 Remove legacy Project route and navigation entry
- [x] 1.2 Add new Config route with single-word label “Config”
- [x] 1.3 Ensure route guards and static mode banners work in Config view

## 2. Config View UI

- [x] 2.1 Create Config view layout with sections: config.yaml, schemas, templates, change metadata
- [x] 2.2 Reuse or extract shared panels (code viewer, selectors) for Config view
- [x] 2.3 Add empty-state messaging for missing config.yaml and metadata

## 3. CLI-Backed Data & Server Routes

- [x] 3.1 Add CLI executor methods for `openspec schemas --json`, `openspec schema which --json`, and `openspec templates --json`
- [x] 3.2 Add server router endpoints + subscriptions for schemas list, schema detail, template map
- [x] 3.3 Wire reactive refresh triggers for schema/templates data on file changes

## 4. Opsx Settings Refactor

- [x] 4.1 Remove OPSX config panels from Settings view
- [x] 4.2 Keep runtime settings (theme/CLI health/tool detection) intact

## 5. Artifact Editor Edit Mode

- [x] 5.1 Default artifact editor to read-only mode when dependencies are satisfied
- [x] 5.2 Add explicit Edit action to enter edit mode and Cancel to return to read-only
- [x] 5.3 Ensure blocked artifacts remain read-only regardless of edit actions

## 6. Static Export & Snapshot

- [x] 6.1 Extend snapshot generation to include Config view data (config.yaml, schemas, templates, change metadata)
- [x] 6.2 Update static data provider to read Config snapshot data

## 7. Types & Tests

- [x] 7.1 Add core types for schema resolution and template mappings
- [x] 7.2 Update web tests for navigation + Config view rendering
- [x] 7.3 Update server tests for new CLI-backed routes

## 8. Config UX Refinements

- [x] 8.1 Convert Config view into tabs to reduce visual stacking (Config / Schemas / Changes)
- [x] 8.2 Add Config edit mode for `openspec/config.yaml` (read-only by default, explicit Edit/Save/Cancel)
- [x] 8.3 In Schemas tab, merge template mapping into schema detail for the selected schema
- [x] 8.4 Allow editing schema.yaml + templates for project/user sources (package sources remain read-only)
- [x] 8.5 Add inline explanation for Change Metadata (.openspec.yaml) and why it might be missing

## 9. Schema Management UX

- [x] 9.1 Add Preview/Edit toggle in Schemas tab; Preview uses structured read-only view
- [x] 9.2 Replace raw schema.yaml read-only dump with structured preview + embedded template preview
- [x] 9.3 Edit mode uses file list (schema.yaml + templates) + text editor
- [x] 9.4 Add schema create actions (init/fork) via CLI execution
- [x] 9.5 Add schema delete action for project/user sources with confirmation
- [x] 9.6 Render template content inline under each artifact in preview
- [x] 9.7 Render known + unknown artifact fields with type-aware formatting

## 10. Schema File Explorer

- [x] 10.1 Refactor archive-style file explorer into a shared component
- [x] 10.2 Use shared explorer for schema read/edit layout
- [x] 10.3 Add create file/folder + delete + properties actions with contextual menus
- [x] 10.4 Add opsx schema file CRUD endpoints + subscriptions
