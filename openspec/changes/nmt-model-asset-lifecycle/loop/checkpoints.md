## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved for implementation start

## 2. Platform Updates

- [x] 2.1 NMT package install and model asset lifecycle are separated
- [x] 2.2 NMT model asset store/service persists local model state outside global settings
- [x] 2.3 Model download/resume ensures NMT runtime package is installed first
- [x] 2.4 Partial local cache is surfaced as resumable state after refresh/restart

## 3. Settings Interaction

- [x] 3.1 NMT model controls are coupled directly to NMT engine selection
- [x] 3.2 Persisted selected model can show Download on initial Settings render
- [x] 3.3 Unknown-size models remain disabled in the selector
- [x] 3.4 Local models sort before remote-only models and expose local progress/status
- [x] 3.5 Selected model detail text wraps and does not depend on viewport-only breakpoints

## 4. Verification

- [x] 4.1 Implementation progress synchronized with loop artifacts
- [x] 4.2 Focused typecheck passes for affected packages
- [x] 4.3 Focused server tests pass
- [x] 4.4 Focused Settings tests pass
- [x] 4.5 Updated NMT smoke path verified or explicitly reported if skipped

## 5. Workflow Gates

- [x] 5.1 Changeset exists for publishable package changes
- [x] 5.2 CI-equivalent local checks passed or scoped exceptions documented
- [ ] 5.3 PR checks passed

## 6. Merge Readiness

- [ ] 6.1 OpenSpec archive flow completed after acceptance
- [ ] 6.2 PR merge approved
