# Delta for opsx-ui-views

## ADDED Requirements

### Requirement: Change Delta Spec Document Rendering

The UI SHALL render active change delta spec artifact previews through the same path-aware Markdown viewer entry used by main spec detail pages.

#### Scenario: Render delta spec artifacts with spec document semantics

- **GIVEN** a change artifact output path resolves to `specs/<spec>/spec.md`
- **WHEN** the user opens that artifact in the change detail view
- **THEN** the UI SHALL render the Markdown through the shared `MarkdownViewer` entry with that artifact path
- **AND** requirement and scenario headings SHALL expose the same OpenSpec semantic metadata as the main spec detail page

#### Scenario: Select OpenSpec rendering by path

- **GIVEN** a Markdown document is passed to the shared viewer with path `specs/<spec>/spec.md`
- **WHEN** the viewer prepares render plugins
- **THEN** the OpenSpec spec rendering plugin SHALL activate from the path
- **AND** the page SHALL NOT use a separate spec-only Markdown component as the rendering entry

#### Scenario: Preserve ordinary artifact rendering for non-spec files

- **GIVEN** a change artifact output path does not match `specs/<spec>/spec.md`
- **WHEN** the user opens that artifact in the change detail view
- **THEN** the UI SHALL render it through the ordinary artifact Markdown reader
- **AND** SHALL NOT infer OpenSpec spec semantics for proposal, tasks, or other non-spec artifacts

#### Scenario: Render translation entry for spec document artifacts

- **GIVEN** a change delta spec artifact is rendered through the shared Markdown viewer with path `specs/<spec>/spec.md`
- **WHEN** its ToC header renders
- **THEN** the UI SHALL expose the document translation action in the same ToC header surface used by main spec detail pages
- **AND** the translation action SHALL be available in both narrow and wide ToC layouts

#### Scenario: Preserve a single root ToC for glob artifacts

- **GIVEN** a change artifact output glob contains one or more Markdown files
- **WHEN** the glob preview renders nested file contents
- **THEN** the UI SHALL keep one root ToC and one root scroll container for the artifact preview
- **AND** nested spec documents SHALL register their document actions into that root ToC header
- **AND** the UI SHALL NOT create independent full-page ToC layouts for each nested spec file
