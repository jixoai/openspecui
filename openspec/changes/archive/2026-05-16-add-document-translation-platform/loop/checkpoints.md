## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved

## 2. Implementation

- [x] 2.1 Unified Markdown AST pipeline contract implemented with named registration, replacement, and order
- [x] 2.2 Translation settings contract implemented in Settings
- [x] 2.3 Translation display mode contract implemented with direct as default
- [x] 2.4 Markdown AST final-stage translation projection implemented
- [x] 2.5 Shared document translation session state implemented
- [x] 2.6 ToC header translation action slot and icon button implemented
- [x] 2.7 ToC label projection implemented through `data-toc-label ?? innerText`
- [x] 2.8 Chrome Translator capability/init/download states implemented
- [x] 2.9 Direct-mode source mapping and bilingual layout rules implemented
- [x] 2.10 Spec heading pseudo-content migrated to real node structure
- [x] 2.11 Spec and artifact Markdown surfaces integrated
- [x] 2.12 Progress synchronized with implementation artifact
- [x] 2.13 Unexpected issues loop back to intake/research-plan

## 3. Verification Gates

- [x] 3.1 Focused web tests for ToC/settings/document translation pass
- [x] 3.2 ToC label law and Spec heading structure tests pass
- [x] 3.3 Mode, source mapping, and optional preview behavior tests pass when applicable
- [x] 3.4 Web typecheck passes
- [x] 3.5 Web SSG build passes
- [x] 3.6 Browser acceptance for narrow/wide ToC, settings jump, ToC labels, and translation modes passes

## 4. PR and Release Gates

- [x] 4.1 Changeset included for release-impacting package changes
- [x] 4.2 CI-equivalent local checks passed or scoped subset justified
- [ ] 4.3 PR checks passed

## 5. Merge Readiness

- [x] 5.1 OpenSpec archive flow completed after implementation acceptance
- [ ] 5.2 PR merge approved
- [x] 5.3 Research worktree `.worktree/translator-api` removed after change archive
