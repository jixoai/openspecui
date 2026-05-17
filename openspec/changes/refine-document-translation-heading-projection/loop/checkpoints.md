## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved

## 2. Implementation

- [x] 2.1 Implementation started from approved plan
- [x] 2.2 OpenSpec heading badge projection restored
- [x] 2.3 Semantic heading labels preserved for accessibility and translation projection
- [x] 2.4 Translation segment DOM shape unified across direct and bilingual modes
- [x] 2.5 Progressive document translation session implemented with per-segment snapshot updates
- [x] 2.6 Abort clears in-flight progressive translation without stale partial output
- [x] 2.7 ToC remains generic and consumes projected labels only
- [x] 2.8 Progress synchronized with implementation artifact
- [x] 2.9 Unexpected issues loop back to intake/research-plan
- [x] 2.10 MarkdownViewer is the only Markdown rendering entry
- [x] 2.11 OpenSpec spec rendering is a path-aware render plugin
- [x] 2.12 SpecMarkdownDocument compatibility wrapper removed

## 3. Verification Gates

- [x] 3.1 Focused unit tests for Spec heading projection pass
- [x] 3.2 Focused unit tests for translation segment projection pass
- [x] 3.3 Focused unit tests for progressive translation pass
- [x] 3.4 Affected package typecheck passes
- [x] 3.5 Affected SSG build passes
- [x] 3.6 Focused unit tests for change delta spec artifact rendering and spec ToC translation action pass
- [x] 3.7 Rendered Playwright walkthrough verifies change detail specs artifact semantic heading and translation entry
- [x] 3.8 Focused unit tests for MarkdownViewer plugin composition and nested ToC action registration pass

## 4. PR and Release Gates

- [x] 4.1 Changeset included or release impact explicitly justified
- [x] 4.2 CI-equivalent local checks passed or scoped subset justified
- [ ] 4.3 PR checks passed

## 5. Merge Readiness

- [ ] 5.1 OpenSpec archive flow completed
- [ ] 5.2 PR merge approved
