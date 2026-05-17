# Delta for document-translation

## MODIFIED Requirements

### Requirement: Unified Markdown AST Processing Pipeline

OpenSpecUI SHALL expose `MarkdownViewer` as the single Markdown document rendering entry for document reading surfaces, with path-aware render plugins layered on the shared Markdown AST processing pipeline.

#### Scenario: Render Markdown through the single viewer entry

- **GIVEN** a document-reading feature needs to render Markdown content
- **WHEN** the feature renders that document
- **THEN** it SHALL use the shared `MarkdownViewer` entry
- **AND** it MAY pass raw Markdown content, a builder function, a document path, document metadata, and document-specific render configuration into that entry
- **AND** it SHALL NOT introduce a second spec-only or translation-only Markdown viewer entry

#### Scenario: Activate document plugins from path

- **GIVEN** a Markdown document is rendered with path `specs/<spec>/spec.md`
- **WHEN** `MarkdownViewer` prepares render plugins
- **THEN** it SHALL activate the OpenSpec spec rendering plugin from that path
- **AND** the plugin SHALL provide OpenSpec heading transforms, semantic block annotations, inline keyword annotations, and document styling through the shared render plugin contract

#### Scenario: Register a named markdown processor

- **GIVEN** a document-reading feature needs to transform or annotate Markdown structure
- **WHEN** that feature integrates with the shared processing pipeline
- **THEN** it SHALL register through a unique processor name
- **AND** the pipeline SHALL support dynamic processor registration

#### Scenario: Replace an existing markdown processor

- **GIVEN** a processor name is already registered
- **WHEN** a new processor with the same unique name is intentionally provided as a replacement
- **THEN** the pipeline SHALL replace the prior processor definition rather than run both implicitly

#### Scenario: Sort markdown processors by explicit order

- **GIVEN** multiple processors are registered in the same pipeline
- **WHEN** OpenSpecUI prepares a document for rendering
- **THEN** the pipeline SHALL execute them according to their configured `order:number`
- **AND** the execution order SHALL be deterministic

#### Scenario: Compose nested viewer document actions

- **GIVEN** a nested Markdown document render plugin provides a ToC header action
- **WHEN** the nested viewer renders inside a root `MarkdownViewer`
- **THEN** the root viewer SHALL expose that action through the root ToC header
- **AND** the nested viewer SHALL NOT create a second root scroll container or independent ToC sidebar
- **AND** action updates SHALL be keyed by explicit semantic action keys rather than component identity
