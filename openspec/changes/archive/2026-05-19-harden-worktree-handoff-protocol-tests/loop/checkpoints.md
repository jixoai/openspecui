## 1. Research and Planning

- [x] 1.1 Intake captured original bug and user requirement objectively
- [x] 1.2 Research facts recorded from router, health, notification provider, and worktree manager paths
- [x] 1.3 Platform decision selected: runtime capability handshake rather than notification special case
- [x] 1.4 Delta specs define worktree handoff compatibility and future verification gate

## 2. BDD Coverage

- [x] 2.1 Add failing BDD test: compatible sibling worktree server passes handoff readiness
- [x] 2.2 Add failing BDD test: projectDir-only healthy but protocol-incompatible server is rejected before navigation
- [x] 2.3 Add failing BDD test: stale runtime without required capability advertisement is rejected
- [x] 2.4 Add failing BDD test: handoff URL preserves route/search/hash for compatible target
- [x] 2.5 Add failing BDD test: `NotificationProvider` tolerates missing `config.notifications`
- [x] 2.6 Add failing BDD test: source-mode parent does not spawn child worktree servers from stale local dist

## 3. Test Platform

- [x] 3.1 Add shared worktree handoff health fixture/helpers for compatible and incompatible runtime scenarios
- [x] 3.2 Add typed health payload builders from the shared runtime compatibility contract
- [x] 3.3 Keep tests fast by using lightweight HTTP fixtures for protocol scenarios
- [x] 3.4 Document how future runtime/subscription/config changes should use the handoff harness

## 4. Platform Implementation

- [x] 4.1 Define runtime capability constants/types in core
- [x] 4.2 Include runtime capabilities in server `/api/health`
- [x] 4.3 Reuse shared health compatibility validation for hosted health and worktree readiness
- [x] 4.4 Reject incompatible worktree target before returning `GitWorktreeHandoff`
- [x] 4.5 Preserve existing compatible worktree route handoff behavior
- [x] 4.6 Harden notification config defaults without hiding platform compatibility failures
- [x] 4.7 Align child worktree server startup with parent runtime mode

## 5. Spec and Release Metadata

- [x] 5.1 Add delta spec for hosted/backend health runtime capability contract
- [x] 5.2 Add delta spec for Git worktree handoff compatibility behavior
- [x] 5.3 Add delta spec for build/test gate requiring worktree handoff coverage for runtime protocol changes
- [x] 5.4 Include changeset for publishable package behavior changes

## 6. Verification

- [x] 6.1 New BDD tests fail before implementation
- [x] 6.2 Focused CLI/core/server/web tests pass after implementation
- [x] 6.3 Affected package typechecks pass
- [x] 6.4 `openspec validate --all --strict --no-interactive` passes
- [x] 6.5 Browser or process-level handoff acceptance is run or explicitly scoped with rationale

## 7. Delivery

- [x] 7.1 Implementation artifact updated with actual decisions
- [x] 7.2 Worktree remains isolated from unrelated main checkout edits
- [ ] 7.3 Ready for PR after local CI-relevant checks pass
