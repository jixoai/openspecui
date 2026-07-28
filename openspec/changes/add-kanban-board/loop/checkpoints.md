<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Provide executable apply-change checkpoints for the PR #208 rewrite.
2. Bind each implementation checkbox to code and focused evidence.
3. Preserve CI, owner acceptance, archive, and merge as separate boundaries.

Owner decision (2026-07-28): implement the reviewed rewrite now.
-->

## 1. Research and Specification

- [x] 1.1 Audit PR #208 against current main, OpenSpec 1.6, realtime, static, and frontend standards
- [x] 1.2 Approve objective lanes: no tracked tasks / tasks remaining / tasks complete / archived
- [x] 1.3 Approve interactive `/board`, Dashboard `ReadonlyKanban`, and shared Operator ownership
- [x] 1.4 Supersede old completion evidence and validate the revised delta

## 2. Projection Contract

- [ ] 2.1 Add shared archive timestamp/range helpers with malformed-date fallback tests
- [ ] 2.2 Extend Dashboard Summary with exact phase counts and bounded recent archive summaries
- [ ] 2.3 Derive the same contract in Server and static providers with typed tests

## 3. Shared Presentation

- [ ] 3.1 Implement objective lane model and motion-enabled `ReadonlyKanban`
- [ ] 3.2 Replace Dashboard Workflow Progress while retaining Active Changes
- [ ] 3.3 Register static/live Kanban routes through current route owners

## 4. Interactive Board

- [ ] 4.1 Extract `useChangeOperatorLauncher` and migrate Change Detail
- [ ] 4.2 Implement independent active/archive lifecycle regions and progressive/error evidence
- [ ] 4.3 Add Apply/Archive icon actions plus archive drag using `DataTransfer` identity
- [ ] 4.4 Prove Root/projection locks, current-row drop lookup, static readonly behavior, and launcher ownership

## 5. Delivery

- [ ] 5.1 Update grouped package changeset and pass focused typed/component tests
- [ ] 5.2 Pass clean SSG, strict OpenSpec validation, and all CI-equivalent local gates
- [ ] 5.3 Push PR #208 and record remote checks
- [ ] 5.4 Owner completes final visual and real browser walkthrough

## 6. Finalization

- [ ] 6.1 Owner approves merge
- [ ] 6.2 Archive/sync this Change in a dedicated commit
- [ ] 6.3 Merge PR #208; do not publish without a separate owner decision
