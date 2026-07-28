<!--
Orthogonal intents (created 2026-07-28 Asia/Shanghai):
1. Provide executable apply-change checkpoints for information-hierarchy distillation.
2. Bind each production-owner migration to focused evidence.
3. Keep automated delivery, owner visual acceptance, archive, merge, and later release separate.

Original request (2026-07-28): implement the UI simplification autonomously, then hand final acceptance to the Owner.
-->

## 1. Research and Specification

- [x] 1.1 Capture the Owner request, non-goals, and acceptance boundary objectively
- [x] 1.2 Compare current 6.x surfaces with `openspecui@5.0.0` and inventory repeated evidence
- [x] 1.3 Define the Tier 1 action / Tier 2 scan / Tier 3 evidence hierarchy
- [x] 1.4 Add and strictly validate the `opsx-ui-views` delta plus repository terminology
- [x] 1.5 Commit the apply-ready Change artifacts separately from production code

## 2. Shared Presentation Primitives

- [x] 2.1 Add a keyboard-accessible `InformationBadge` backed by existing Badge and Tooltip owners
- [x] 2.2 Add a Base UI-backed `EvidenceDisclosure` with compact trigger and on-demand panel
- [x] 2.3 Prove default-collapsed, focus, accessible naming, Tooltip, open/close, and error-separation behavior

## 3. Shell and Dashboard

- [x] 3.1 Make Planning identity primary in the shell and move Launch/source/Store detail into indirect space
- [x] 3.2 Replace the Dashboard three-column Data scopes band with a compact context strip
- [x] 3.3 Keep Root/Reference/Git failures direct and preserve navigation to `/context`
- [x] 3.4 Add focused shell and Dashboard tests for compact summaries and direct failures

## 4. Change and OPSX Workflow

- [x] 4.1 Keep workflow target path and actions direct while compressing source/Store/Reference facts into badges
- [x] 4.2 Move Change CLI paths, artifact paths, action context, and raw evidence into shared disclosures
- [x] 4.3 Keep progress divergence, Root blockers, and workflow errors direct; collapse only supporting evidence
- [x] 4.4 Add focused Change/New/Propose/Compose/Verify tests for action visibility and evidence retrieval

## 5. Config, Settings, and Context

- [ ] 5.1 Keep Config forms and validation direct; collapse successful Root preview, Reference, settlement, and CLI evidence
- [ ] 5.2 Reduce Settings OpenSpec diagnostics to status summaries linked to Context and Config owners
- [ ] 5.3 Apply the shared disclosure vocabulary to Context command and Reference evidence without deleting facts
- [ ] 5.4 Preserve static unavailability/source attribution and add focused route/component tests

## 6. Catalog Metadata and Delivery

- [ ] 6.1 Replace redundant Catalog source/read-only/schema prose with compact badges where it reduces noise
- [ ] 6.2 Add a Web package changeset and synchronize implementation evidence
- [ ] 6.3 Pass focused Vitest, Web typecheck/lint/format, static tests, and a clean SSG build
- [ ] 6.4 Pass repository CI-equivalent gates, strict OpenSpec validation, and `git diff --check`
- [ ] 6.5 Open the PR and record successful remote checks
- [ ] 6.6 Owner completes final visual and real-browser walkthrough

## 7. Finalization

- [ ] 7.1 Owner approves the accepted presentation for merge
- [ ] 7.2 Sync/archive the Change in a dedicated commit
- [ ] 7.3 Merge the PR after required checks; do not publish another version without separate approval
