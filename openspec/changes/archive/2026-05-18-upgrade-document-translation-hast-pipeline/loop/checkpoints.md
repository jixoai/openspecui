## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved
- [x] 1.4 HAST-stage translation architecture selected
- [x] 1.5 Placeholder protocol decisions captured
- [x] 1.6 Translation cache ownership and settings split captured

## 2. Implementation

- [x] 2.1 Implementation starts from `loop/research-plan.md` and `loop/implementation.md`
- [x] 2.2 Global settings manager added for `~/.openspecui/settings.json`
- [x] 2.3 Project config extended with translation cache enablement
- [x] 2.4 SQLite cache adapter added for `better-sqlite3` and `bun:sqlite`
- [x] 2.5 Shared cache service implements entry-count LRU cleanup from 90% to 60%
- [x] 2.6 MarkdownViewer exposes staged mdast/HAST processing contracts
- [x] 2.7 Translation projection moves to HAST placeholder protocol
- [x] 2.8 Settings exposes cache enablement, entry limit, clean, and clear controls
- [x] 2.9 Progress stays synchronized with implementation artifact
- [x] 2.10 Unexpected issues loop back to intake/research-plan before continuing

## 3. Verification

- [x] 3.1 Heading `### 1. Research and Planning` remains a heading after translation
- [x] 3.2 Inline semantic heading structure survives translation
- [x] 3.3 Link text translates while protected link attributes remain side-table-owned
- [x] 3.4 `title`, `alt`, and `aria-label` translation is covered
- [x] 3.5 `code`, `kbd`, and `samp` display policies are covered
- [x] 3.6 Malformed placeholder output falls back safely
- [x] 3.7 Cache key includes source language, target language, placeholder topology, translatable attributes, and display policy version
- [x] 3.8 Cache service covers disabled mode, async write failure, clean, clear, and LRU cleanup
- [x] 3.9 Global settings tests cover read/write/default pruning
- [x] 3.10 Scoped web/core/server tests pass

## 4. PR and Release Gates

- [x] 4.1 Changeset included for release-impacting package changes
- [x] 4.2 CI-equivalent local checks passed
- [x] 4.3 PR checks passed

## 5. Merge Readiness

- [x] 5.1 OpenSpec archive flow completed
- [ ] 5.2 PR merge approved
