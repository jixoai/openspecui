## ADDED Requirements

### Requirement: Unified Markdown AST Processing Pipeline

OpenSpecUI SHALL expose a shared Markdown AST processing pipeline for document reading surfaces.

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

### Requirement: Browser-Side Document Translation Projection

OpenSpecUI SHALL provide document translation as a browser-side projection derived from the currently displayed Markdown document.

#### Scenario: Translate a supported Markdown document

- **GIVEN** a document surface is backed by processed Markdown
- **AND** translation is enabled in Settings
- **WHEN** the user activates translation for that document
- **THEN** OpenSpecUI SHALL derive a translated view from the current Markdown content
- **AND** SHALL NOT mutate the underlying source document
- **AND** SHALL NOT persist the translated text as a second document truth

#### Scenario: Preserve technical structure during translation

- **GIVEN** the document contains protected technical spans such as code, file paths, URLs, HTML tags, or OpenSpec structural keywords
- **WHEN** OpenSpecUI performs translation
- **THEN** it SHALL protect those spans before invoking the browser Translator
- **AND** SHALL recompose the document with structure preserved

### Requirement: AST-Final Translation Stage

OpenSpecUI SHALL apply document translation as the final transformation stage of the Markdown AST rendering pipeline.

#### Scenario: Upstream processing sees original Markdown

- **GIVEN** OpenSpecUI already computes Markdown facts, OpenSpec semantic projections, ToC metadata, or other structural annotations
- **WHEN** a document is prepared for rendering
- **THEN** those upstream processing stages SHALL operate on the original Markdown content
- **AND** translation SHALL be applied only after those stages have finished deriving structure

#### Scenario: Translation mode needs stable source-target spans

- **GIVEN** the document is rendered in a translated mode
- **WHEN** OpenSpecUI computes translated output
- **THEN** it SHALL preserve stable source-target span metadata from the AST projection
- **AND** that metadata SHALL support bilingual layout decisions and optional source preview surfaces

### Requirement: ToC Label Projection Contract

OpenSpecUI SHALL project ToC labels from document rendering metadata without coupling the ToC component to translation behavior.

#### Scenario: Direct translation projects translated ToC label

- **GIVEN** a document is rendered in direct translation mode
- **WHEN** a heading contributes navigation metadata to the ToC
- **THEN** the document rendering layer SHALL project the translated heading label into `data-toc-label`

#### Scenario: Bilingual translation projects source ToC label

- **GIVEN** a document is rendered in bilingual translation mode
- **WHEN** a heading contributes navigation metadata to the ToC
- **THEN** the document rendering layer SHALL project the source heading label into `data-toc-label`

#### Scenario: ToC remains translation-agnostic

- **GIVEN** a heading element may or may not expose `data-toc-label`
- **WHEN** the shared ToC reads a label for navigation
- **THEN** it SHALL use `data-toc-label` when present
- **AND** SHALL fall back to the heading text content when the attribute is absent
- **AND** SHALL NOT hardcode translation-mode branching inside the ToC component

### Requirement: Translation Display Modes

OpenSpecUI SHALL support direct and bilingual document translation display modes.

#### Scenario: Default to direct translation

- **WHEN** a user enables document translation without changing display preferences
- **THEN** the default display mode SHALL be direct translation
- **AND** the document surface SHALL show only the translated content

#### Scenario: Switch to bilingual mode

- **WHEN** the user selects bilingual mode in Settings
- **THEN** supported document views SHALL render both source and translated content
- **AND** subsequent document translation requests SHALL use bilingual presentation

### Requirement: Direct Translation Source Mapping

OpenSpecUI SHALL preserve source-target mapping in direct translation mode so source preview can be exposed without restoring source as the main display.

#### Scenario: Preserve source mapping for translated text

- **GIVEN** the document is rendered in direct translation mode
- **WHEN** OpenSpecUI renders translated source-mapped segments
- **THEN** it SHALL preserve the original source text for each mapped segment
- **AND** the main document display SHALL remain in translated mode

#### Scenario: Preview source text when the surface supports it

- **GIVEN** the document is rendered in direct translation mode
- **AND** the document surface supports hover or focus preview
- **WHEN** the user hovers or focuses a translated source-mapped segment
- **THEN** OpenSpecUI SHOULD display the original source text in a floating preview surface
- **AND** lack of this preview SHALL NOT block the direct translation mode itself

### Requirement: Bilingual Layout Rules

OpenSpecUI SHALL apply structure-aware bilingual layout rules rather than a single layout for every node type.

#### Scenario: Append bilingual headings and list items inline

- **GIVEN** the document is rendered in bilingual mode
- **WHEN** a translated node corresponds to a short structural element such as `h1`, `h2`, or `li`
- **THEN** the translated content SHALL be appended inline with the source content on the same rendered row

#### Scenario: Stack bilingual prose blocks

- **GIVEN** the document is rendered in bilingual mode
- **WHEN** a translated node corresponds to a prose block such as a paragraph or blockquote
- **THEN** the translated content SHALL render on its own line or block below or above the source content
- **AND** OpenSpecUI SHALL NOT force those prose blocks into a cramped inline layout

### Requirement: Translation Capability and Initialization State

OpenSpecUI SHALL model Chrome Translator capability and initialization as explicit user-visible runtime states.

#### Scenario: Translation requires downloadable language support

- **GIVEN** the browser Translator reports `downloadable`
- **WHEN** translation is enabled or requested
- **THEN** OpenSpecUI SHALL treat that state as initialization in progress
- **AND** SHALL surface that the browser is preparing translation capability
- **AND** SHALL NOT misreport the feature as permanently unavailable

#### Scenario: Translation is actively downloading or preparing

- **GIVEN** the browser Translator reports `downloading` or an equivalent preparation state
- **WHEN** the settings or document surface renders translation status
- **THEN** OpenSpecUI SHALL show an initializing/downloading state
- **AND** SHALL keep the user informed that translation is not yet ready

#### Scenario: Translation capability is missing or unavailable

- **GIVEN** the browser context does not expose Translator
- **OR** Translator reports `unavailable`
- **WHEN** the user opens translation settings or requests translation
- **THEN** OpenSpecUI SHALL render an explicit unavailable state
- **AND** SHALL fail closed without corrupting the document surface

### Requirement: Translation Settings Contract

OpenSpecUI SHALL expose translation enablement and target-language configuration in runtime Settings.

#### Scenario: Enable translation and start initialization

- **WHEN** the user enables translation in Settings
- **THEN** OpenSpecUI SHALL persist that preference as a runtime setting
- **AND** SHALL immediately probe browser translation capability
- **AND** SHALL begin translator initialization or language-pack preparation when supported

#### Scenario: Configure target language

- **WHEN** the user selects a target language in Settings
- **THEN** OpenSpecUI SHALL persist that target language preference
- **AND** subsequent document translation requests SHALL use the configured target language

### Requirement: Source Language Detection Fallback

OpenSpecUI SHALL support automatic source-language detection without making experimental browser detection a hard dependency.

#### Scenario: LanguageDetector is available

- **GIVEN** the browser exposes a usable LanguageDetector capability
- **WHEN** OpenSpecUI prepares a translation request
- **THEN** it MAY use that capability to improve source-language selection

#### Scenario: Reuse source-language detection across a document

- **GIVEN** automatic source-language detection is available
- **WHEN** OpenSpecUI prepares translation for a normal single-language Markdown document
- **THEN** it SHALL reuse detection results across the document or larger semantic blocks
- **AND** it SHALL NOT require a fresh detector call for every rendered line by default

#### Scenario: LanguageDetector is unavailable

- **GIVEN** the browser does not expose a usable LanguageDetector capability
- **WHEN** OpenSpecUI prepares a translation request
- **THEN** translation SHALL still remain available through the configured or default source-language strategy
- **AND** the missing detector SHALL NOT block the translation feature by itself

### Requirement: Abortable Translation Session

OpenSpecUI SHALL treat document translation as an abortable session owned by the current document view.

#### Scenario: Cancel an in-flight translation

- **GIVEN** a document translation request is currently in progress
- **WHEN** the user activates the translation control again to cancel
- **THEN** OpenSpecUI SHALL abort the in-flight translation request
- **AND** SHALL return the document surface to a non-translated state without stale partial output

### Requirement: Spec Heading Structural Projection

OpenSpecUI SHALL render OpenSpec semantic heading adornments through real DOM nodes instead of pseudo-content.

#### Scenario: Render requirement heading label as a real inline node

- **GIVEN** a requirement heading is projected into the rendered document
- **WHEN** OpenSpecUI applies OpenSpec semantic heading enhancements
- **THEN** the visible prefix label such as `Requirement:` SHALL render through a real inline child node
- **AND** the requirement title SHALL remain real selectable text inside the heading element

#### Scenario: Render scenario heading label as a real inline node

- **GIVEN** a scenario heading is projected into the rendered document
- **WHEN** OpenSpecUI applies OpenSpec semantic heading enhancements
- **THEN** the visible prefix label such as `Scenario:` SHALL render through a real inline child node
- **AND** OpenSpecUI SHALL NOT rely on `::before`, `::after`, or `content: attr(...)` as the primary visible heading text
