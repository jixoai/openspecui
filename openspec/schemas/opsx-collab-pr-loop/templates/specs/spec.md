## ADDED Requirements

### Requirement: Approval-gated execution loop

The workflow SHALL require proposal and plan approval before implementation begins.

#### Scenario: Plan approved

- **WHEN** proposal and plan are reviewed and approved
- **THEN** implementation tasks can start

#### Scenario: Plan rejected

- **WHEN** proposal and plan are not approved
- **THEN** workflow returns to proposal update and re-review

### Requirement: Continuous progress synchronization

The workflow SHALL keep tasks and related OpenSpec artifacts synchronized during implementation.

#### Scenario: Task progress updates

- **WHEN** implementation advances
- **THEN** tasks.md and related artifacts are updated to reflect current state

### Requirement: Unexpected issue loopback

The workflow SHALL loop back to research and planning when unexpected blockers or scope changes occur.

#### Scenario: Blocker found

- **WHEN** implementation hits unexpected issues
- **THEN** workflow returns to proposal/spec/design update and approval before continuing

### Requirement: PR and release gating

The workflow SHALL produce a PR with changeset and pass CI gates before merge.

#### Scenario: Release-impacting change

- **WHEN** package behavior changes
- **THEN** PR includes changeset and all required CI gates pass

### Requirement: Archive-before-merge

The workflow SHALL complete OpenSpec archive flow before final merge confirmation.

#### Scenario: Ready to merge

- **WHEN** implementation is complete
- **THEN** change is archived and only then considered merge-ready
