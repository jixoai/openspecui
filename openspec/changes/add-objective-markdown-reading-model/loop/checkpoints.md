## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Current parser and reading model overfit points identified
- [x] 1.3 Platform-law plan captured
- [x] 1.4 Explore-mode implementation boundary recorded

## 2. Markdown Facts Platform

- [x] 2.1 Core Markdown facts interfaces defined
- [x] 2.2 Markdown parser dependency selected and wrapped behind core-owned API
- [x] 2.3 Source range and raw Markdown slice support verified
- [x] 2.4 Headings, lists, blockquotes, tables, code fences, and unknown nodes represented objectively
- [x] 2.5 Fenced-code fake headings do not become heading facts

## 3. OpenSpec Annotation Layer

- [x] 3.1 Annotation interfaces define semantic kind, target fact id, rule id, and confidence
- [x] 3.2 Current canonical OpenSpec forms annotate strongly
- [x] 3.3 Non-canonical or future-looking structures remain visible when unannotated
- [x] 3.4 Scenario steps attach to list-item facts before projection
- [x] 3.5 `#### Notes`-style nested sections are not forced into scenarios
- [x] 3.6 Generic Markdown reading plugin pipeline supports ordered annotation and projection rules
- [x] 3.7 Built-in OpenSpec semantics are exposed as a default plugin, not platform hardcoding
- [x] 3.8 Loose AI-mutated forms such as `Capabilities`, `Capability:`, and `Example:` annotate weakly

## 4. Projections and UI Consumption

- [x] 4.1 `MarkdownParser.parseSpec` consumes projected reading documents instead of local line scanning
- [x] 4.2 `Spec` remains available as a local projection output
- [x] 4.3 `SpecReadingModel` consumes annotated facts instead of web-local string splitting
- [x] 4.4 `SpecMarkdownDocument` keeps unknown authored Markdown visible and navigable
- [x] 4.5 ToC labels derive from objective headings plus explicit semantic labels only where needed
- [x] 4.6 Community-style custom annotation/projection behavior is covered by pipeline tests
- [x] 4.7 OpenSpec keyword annotations drive inline keyword visual emphasis

## 5. Verification Gates

- [x] 5.1 Core Markdown facts tests pass
- [x] 5.2 Core Markdown reading and OpenSpec annotation tests pass
- [x] 5.3 Existing parser and validator tests pass
- [x] 5.4 Web reading model/rendering tests pass
- [x] 5.5 Typecheck passes for affected packages
- [x] 5.6 Browser walkthrough passes on canonical and AST-stress fixtures
- [x] 5.7 Keyword annotation and rendering tests pass

## 6. PR and Release Gates

- [x] 6.1 Changeset included for release-impacting package changes
- [x] 6.2 CI-equivalent local checks passed or scoped subset justified
- [ ] 6.3 PR checks passed

## 7. Merge Readiness

- [ ] 7.1 OpenSpec archive flow completed after implementation acceptance
- [ ] 7.2 PR merge approved
