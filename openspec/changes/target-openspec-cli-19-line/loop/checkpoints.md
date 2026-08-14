<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Track the v9 adaptation in dependency order with evidence-based closure.
2. Preserve focused-review and Owner-only acceptance gates.
3. Prevent release/archive work from being inferred from implementation completion.

Original request (2026-08-15): "完成后，我就会自己开始开发"
-->

# OpenSpecUI 9 checkpoints

## 1. Research and Planning

- [x] 1.1 Pin `references/openspec` to verified OpenSpec v1.9.0.
- [x] 1.2 Record v1.7 -> v1.8 -> v1.9 source and black-box protocol evidence.
- [x] 1.3 Define the v9 supported/current version law and non-goals.
- [x] 1.4 Create owner/red/green implementation plan and delta Specs.
- [x] 1.5 Independent planning review is incorporated and targeted Change validation is re-run.

### Planning review record (2026-08-15 Asia/Shanghai)

- Independent `gpt-5.6-sol` review found no justified correction to the upstream protocol scope, owner mapping,
  red/green evidence, task ordering, fixture requirement, or Change artifact structure.
- Supplemental checks: pinned `references/openspec` is v1.9.0 at `2826b8889e5223a9a8095d4428b60b56597e1020`;
  `git diff --check` passes; targeted `openspec validate target-openspec-cli-19-line --strict --json` passes.
- Review boundary remains unchanged: no production source, release, PR, archive, merge, or Owner browser acceptance
  was performed.

## 2. Core Admission and Contracts

- [ ] 2.1 Add the v9 compatibility classifier and public copy.
- [ ] 2.2 Prove red: stable 1.8.x blocked or prerelease 1.9.x admitted.
- [ ] 2.3 Prove green: 1.8.x supported non-current, 1.9.x current, all excluded versions block.
- [ ] 2.4 Decode successful Schema arrays and selected-root failure envelopes distinctly.
- [ ] 2.5 Decode v1.9 archived validation reports without treating CLI failure as data absence.
- [ ] 2.6 Pass focused Core compatibility/workflow/executor review before downstream consumers change.

## 3. Workflow Projection

- [ ] 3.1 Project `isPlanningComplete` as planning readiness only.
- [ ] 3.2 Preserve Apply `progress` independently from actionable task-list length.
- [ ] 3.3 Prove indented and blank-description checkbox total behavior with real 1.8.0 and 1.9.0 fixtures.
- [ ] 3.4 Pass focused Core/Server workflow and task-progress review.

## 4. Agent Delivery

- [ ] 4.1 Rebuild the registry from official 1.8/1.9 metadata.
- [ ] 4.2 Prove Codex `.agents` current root and `.codex` legacy evidence.
- [ ] 4.3 Prove MiniMax global skills, Rovo Dev, Shared `.agents`, Command Code, and IDE restart metadata.
- [ ] 4.4 Preserve migration/cleanup evidence while the official CLI remains the sole mutation owner.
- [ ] 4.5 Pass focused registry, state, Server projection, and Config-owner review.

## 5. Archive and Evidence Surfaces

- [ ] 5.1 Preserve archive retirement/scenario-loss/duplicate-requirement warning and failure facts.
- [ ] 5.2 Present archived validation as typed CLI evidence without local repair or automatic archive.
- [ ] 5.3 Prove static projections do not fabricate live validation/archive/Agent evidence.
- [ ] 5.4 Pass focused Change Evidence and Config Web review.

## 6. Fixture and Distribution Gates

- [ ] 6.1 Run the pinned 1.8.0 and 1.9.0 executable fixture matrix.
- [ ] 6.2 Run affected typecheck, lint, and unit/component tests after focused owners pass.
- [ ] 6.3 Build Web, App, and CLI outputs; inspect generated compatibility artifacts.
- [ ] 6.4 Pack and isolated-install the real `openspecui` tarball; prove installed v9 admission behavior.
- [ ] 6.5 Add one OpenSpecUI 9 major Changeset and release/changelog preparation only.

## 7. Owner Gates

- [ ] 7.1 Owner performs final browser/App walkthrough for 1.8.x and 1.9.x projects.
- [ ] 7.2 Owner reviews PR, authorizes merge, release, and archive independently.
