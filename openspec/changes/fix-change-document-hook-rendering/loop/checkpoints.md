## 1. Research and Planning

- [x] 1.1 #140 reopened comments captured objectively
- [x] 1.2 Active translation work boundary recorded
- [x] 1.3 Existing hook/document-service law inspected
- [x] 1.4 Architecture options documented for manager discussion
- [x] 1.5 Manager approves Option A or Option B before implementation

## 2. Reproduction and Diagnosis

- [x] 2.1 Build or reuse a local fixture with an `onReadDocument` hook that marks document kind and stage
- [x] 2.2 Reproduce active change delta spec rendering behavior
- [x] 2.3 Reproduce active change tasks rendering behavior, including the reporter's flaky path
- [x] 2.4 Compare artifact preview, change overview, archive view, and folder/source editor behavior
- [x] 2.5 Record which paths are processed-mode and which paths are source-mode by design

## 3. Platform-Law Implementation

- [x] 3.1 Route rendered active change document reads through `DocumentService`
- [x] 3.2 Confirm rendered archive document reads through `DocumentService`
- [x] 3.3 Preserve explicit source/audit reads for folder/code-editor views
- [x] 3.4 Avoid page-local `delta-spec` special cases unless they are only display labels
- [x] 3.5 Keep translation-related files untouched unless confirmed necessary

## 4. Regression Coverage

- [x] 4.1 Server tests cover processed active change tasks and delta specs
- [x] 4.2 Server tests cover processed archived tasks and delta specs
- [x] 4.3 Web tests cover active artifact preview for delta specs and tasks
- [x] 4.4 Web tests cover source editor remaining unprocessed
- [x] 4.5 Tests cover or explicitly rule out the `changes/tasks` flaky path

## 5. Verification Gates

- [x] 5.1 Focused server tests pass
- [x] 5.2 Focused web tests pass
- [x] 5.3 Typecheck passes for affected packages
- [x] 5.4 Static/export checks run if snapshot or static provider paths change
- [x] 5.5 OpenSpec status and validation pass for this change
- [x] 5.6 Local walk-through fixture under `tmp/issue-140-hook-preview/` verifies processed preview reads and raw source reads

## 6. PR and Release Gates

- [ ] 6.1 Changeset included if package behavior changes
- [ ] 6.2 CI-equivalent local checks pass or scoped subset is justified
- [ ] 6.3 PR checks pass before merge

## 7. Merge Readiness

- [ ] 7.1 OpenSpec archive flow completed after implementation acceptance
- [ ] 7.2 PR merge approved
