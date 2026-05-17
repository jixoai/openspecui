## 1. Spec Law

- [x] 1.1 Reject legacy `Change` as the archive detail platform contract
- [x] 1.2 Define schema-neutral entity identity and file truth
- [x] 1.3 Define stale/missing schema tolerance as required behavior
- [x] 1.4 Define generic artifact document identity for Markdown hooks

## 2. BDD Coverage

- [ ] 2.1 Add failing core utility/adapter test for custom schema archive detail
- [ ] 2.2 Add failing core utility/adapter test for missing schema fallback detail
- [ ] 2.3 Add failing server test for `onReadDocument` generic artifact refs
- [ ] 2.4 Add failing web route test for archive entity rendering without not-found
- [ ] 2.5 Add/update static snapshot test for archive entity files/artifacts

## 3. Platform Implementation

- [ ] 3.1 Add shared core OPSX entity utility module
- [ ] 3.2 Refactor adapter to expose active/archive entity file detail reactively
- [ ] 3.3 Refactor DocumentService to process entity artifact Markdown generically
- [ ] 3.4 Refactor router/subscriptions to expose archive entity detail
- [ ] 3.5 Refactor ArchiveView to render entity artifacts/files instead of legacy Change overview
- [ ] 3.6 Refactor static export/runtime to preserve and consume entity detail
- [ ] 3.7 Remove rejected schema-specific projection code

## 4. Verification

- [ ] 4.1 Focused core tests pass
- [ ] 4.2 Focused server tests pass
- [ ] 4.3 Focused web route/static tests pass
- [ ] 4.4 Affected package typechecks pass
- [ ] 4.5 Static export build passes if snapshot shape changes
- [ ] 4.6 `openspec validate --all --strict --no-interactive` passes

## 5. Delivery

- [ ] 5.1 Commit OpenSpec breaking-change artifacts separately
- [ ] 5.2 Commit implementation/tests separately
