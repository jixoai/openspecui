## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved for implementation start

## 2. Implementation

- [x] 2.1 Parser regression tests capture issues #139/#140 and the temporary reproduction cases
- [x] 2.2 Core parser preserves requirement body Markdown and only starts scenarios from explicit scenario headings
- [x] 2.3 Shared spec-aware Markdown rendering primitive added
- [x] 2.4 Live spec detail route renders processed Markdown as the primary visual source
- [x] 2.5 Static spec detail route uses the same Markdown-first rendering path
- [x] 2.6 OpenSpec semantic markers support visual enhancement without CSS-owned business facts
- [x] 2.7 ToC entries and rendered anchors stay aligned for spec sections, requirements, scenarios, and normal Markdown headings
- [x] 2.8 Implementation artifact updated when code decisions or scope diverge
- [ ] 2.9 Unexpected blockers loop back to intake/research-plan before implementation continues

## 3. Verification Gates

- [x] 3.1 Core parser tests pass
- [x] 3.2 Web rendering and ToC tests pass
- [x] 3.3 Web typecheck passes
- [x] 3.4 Static SSG build passes
- [x] 3.5 Temporary reproduction project verifies fixed UI behavior in browser

## 4. PR and Release Gates

- [x] 4.1 Changeset included for release-impacting package changes
- [x] 4.2 CI-equivalent local checks passed or scoped subset justified
- [ ] 4.3 PR checks passed

## 5. Merge Readiness

- [ ] 5.1 OpenSpec archive flow completed after implementation acceptance
- [ ] 5.2 PR merge approved
