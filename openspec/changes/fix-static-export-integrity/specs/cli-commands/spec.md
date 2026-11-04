<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Add the one requirement the four #319 defects lacked a statement for: the generated
   document's insertion and loading steps are integrity boundaries.
2. Keep the base-path and routing promises where they already live (web-rendering) rather
   than restating them here.

Original request (2026-11-04): "同时，处理一下#319"
-->

## ADDED Requirements

### Requirement: Static Export Output Integrity

The static export SHALL preserve snapshot content byte-for-byte in the generated document:
inserting rendered markup, bootstrap data, or a document title SHALL NOT interpret `$`
replacement patterns found in the inserted value. The export SHALL load its build-owned server
entry through a `file:` URL so every supported platform, including Windows drive-letter paths,
can resolve it.

#### Scenario: Content carrying `$` sequences round-trips

- **GIVEN** a snapshot whose spec, design, or code-block text contains `$'`, `` $` ``, `$&`, or `$$`
- **WHEN** `export` generates the pages
- **THEN** every occurrence SHALL appear verbatim in the bootstrap data
- **AND** the emitted document SHALL remain one well-formed document with exactly one bootstrap
  script, rather than embedding copies of the template

#### Scenario: An absolute server-entry path loads on every platform

- **GIVEN** the SSG CLI resolves its server entry to an absolute filesystem path
- **WHEN** it imports that entry
- **THEN** the import SHALL go through a `file:` URL
- **AND** a Windows drive-letter path SHALL NOT reach the ESM loader as a bare path

#### Scenario: A missing template placeholder fails loudly

- **GIVEN** a client template that no longer contains the app-html or head-tags placeholder
- **WHEN** the SSG CLI renders a page
- **THEN** it SHALL fail with an error naming the missing placeholder
- **AND** it SHALL NOT emit a document that silently drops the rendered content or bootstrap data
