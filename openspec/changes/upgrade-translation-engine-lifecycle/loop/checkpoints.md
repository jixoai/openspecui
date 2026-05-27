## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved

## 2. Implementation

- [x] 2.1 Implementation started from approved plan
- [x] 2.2 Progress synchronized with implementation artifact
- [x] 2.3 Unexpected issues loop back to intake/research-plan

## 3. Lifecycle Platform

- [x] 3.1 Core lifecycle schema distinguishes dependency, runtime, and assets truth
- [x] 3.2 Descriptor registry exposes browser/local/local-ct2 through one shared contract
- [x] 3.3 Server install flow performs dependency install and automatic runtime probe as one lifecycle session
- [x] 3.4 Browser engine remains install-gate free through `not-applicable` lifecycle semantics

## 4. Managed-Local Engines

- [x] 4.1 Local and local-ct2 share managed-local lifecycle helpers and UI metadata
- [x] 4.2 Local-ct2 dependency detect is strengthened beyond dependency-tree presence
- [x] 4.3 Runtime host optional dependency truth remains rooted at `openspecui`
- [x] 4.4 Managed-local asset readiness remains separate from runtime health

## 5. Web Translation Settings

- [x] 5.1 Engine install gate renders from lifecycle truth instead of install-only state
- [x] 5.2 Install log streaming uses a bounded `pre` log card with bottom-stick behavior
- [x] 5.3 Runtime-ready engines automatically hand off from the gate to standard cards
- [x] 5.4 Shared settings UI removes new lifecycle-specific `engineId` branching

## 6. Native Runtime Packaging

- [x] 6.1 `ctranslate2` package manifest and loader truth are aligned
- [x] 6.2 Root package pack dry-run verifies expected published files
- [x] 6.3 Unsupported platform behavior is explicit when full coverage is unavailable

## 7. BDD Verification

- [x] 7.1 Browser no-install path is covered by tests
- [x] 7.2 Managed-local missing dependency and runtime probe failure paths are covered by tests
- [x] 7.3 Managed-local asset missing/ready page-flow is covered by tests
- [x] 7.4 Acceptance matrix and implementation artifact remain synchronized after each major slice

## 8. PR and Release Gates

- [x] 8.1 Changeset included for release-impacting package changes
- [x] 8.2 CI-equivalent local checks passed
- [ ] 8.3 PR checks passed

## 9. Merge Readiness

- [ ] 9.1 OpenSpec archive flow completed
- [ ] 9.2 PR merge approved
