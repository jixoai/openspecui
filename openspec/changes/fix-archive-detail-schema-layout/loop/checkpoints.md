## 1. Spec Law

- [x] 1.1 Reject legacy `Change` as the archive detail platform contract
- [x] 1.2 Define schema-neutral entity identity and file truth
- [x] 1.3 Define stale/missing schema tolerance as required behavior
- [x] 1.4 Define generic artifact document identity for Markdown hooks

## 2. BDD Coverage

- [x] 2.1 Add failing core utility/adapter test for custom schema archive detail
- [x] 2.2 Add failing core utility/adapter test for missing schema fallback detail
- [x] 2.3 Add failing server test for `onReadDocument` generic artifact refs
- [x] 2.4 Add failing web route test for archive entity rendering without not-found
- [x] 2.5 Add/update static snapshot test for archive entity files/artifacts

## 3. Platform Implementation

- [x] 3.1 Add shared core OPSX entity utility module
- [x] 3.2 Refactor adapter to expose active/archive entity file detail reactively
- [x] 3.3 Refactor DocumentService to process entity artifact Markdown generically
- [x] 3.4 Refactor router/subscriptions to expose archive entity detail
- [x] 3.5 Refactor ArchiveView to render entity artifacts/files instead of legacy Change overview
- [x] 3.6 Refactor static export/runtime to preserve and consume entity detail
- [x] 3.7 Remove rejected schema-specific projection code

## 4. Verification

- [x] 4.1 Focused core tests pass
- [x] 4.2 Focused server tests pass
- [x] 4.3 Focused web route/static tests pass
- [x] 4.4 Affected package typechecks pass
- [x] 4.5 Static export build passes if snapshot shape changes
- [x] 4.6 `openspec validate --all --strict --no-interactive` passes

## 5. Delivery

- [x] 5.1 Commit OpenSpec breaking-change artifacts separately
- [x] 5.2 Commit implementation/tests separately
