## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved
- [x] 1.4 HAST-stage translation architecture selected
- [x] 1.5 Placeholder protocol decisions captured
- [x] 1.6 Translation cache ownership and settings split captured

## 2. Implementation

- [ ] 2.1 Implementation starts from `loop/research-plan.md` and `loop/implementation.md`
- [ ] 2.2 Global settings manager added for `~/.openspecui/settings.json`
- [ ] 2.3 Project config extended with translation cache enablement
- [ ] 2.4 SQLite cache adapter added for `better-sqlite3` and `bun:sqlite`
- [ ] 2.5 Shared cache service implements entry-count LRU cleanup from 90% to 60%
- [ ] 2.6 MarkdownViewer exposes staged mdast/HAST processing contracts
- [ ] 2.7 Translation projection moves to HAST placeholder protocol
- [ ] 2.8 Settings exposes cache enablement, entry limit, clean, and clear controls
- [ ] 2.9 Progress stays synchronized with implementation artifact
- [ ] 2.10 Unexpected issues loop back to intake/research-plan before continuing

## 3. Verification

- [ ] 3.1 Heading `### 1. Research and Planning` remains a heading after translation
- [ ] 3.2 Inline semantic heading structure survives translation
- [ ] 3.3 Link text translates while protected link attributes remain side-table-owned
- [ ] 3.4 `title`, `alt`, and `aria-label` translation is covered
- [ ] 3.5 `code`, `kbd`, and `samp` display policies are covered
- [ ] 3.6 Malformed placeholder output falls back safely
- [ ] 3.7 Cache key includes source language, target language, placeholder topology, translatable attributes, and display policy version
- [ ] 3.8 Cache service covers disabled mode, async write failure, clean, clear, and LRU cleanup
- [ ] 3.9 Global settings tests cover read/write/default pruning
- [ ] 3.10 Scoped web/core/server tests pass

## 4. PR and Release Gates

- [ ] 4.1 Changeset included for release-impacting package changes
- [ ] 4.2 CI-equivalent local checks passed
- [ ] 4.3 PR checks passed

## 5. Merge Readiness

- [ ] 5.1 OpenSpec archive flow completed
- [ ] 5.2 PR merge approved
