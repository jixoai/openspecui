## 1. Research and Planning

- [x] 1.1 Intake captured objectively (issue #258 + Owner request + community trace)
- [x] 1.2 Research facts recorded (failure chain, cmd-shim formats, EINVAL probe, scripts mirror)
- [x] 1.3 Plan reviewed and approved (Codex independent review 2026-08-28; both blockers folded in)

## 2. Implementation

- [x] 2.1 Implementation started from approved plan (red extraction test captured before the fix)
- [x] 2.2 Progress synchronized with implementation artifact
- [x] 2.3 Unexpected issues loop back to intake/research-plan (none triggered)

## 3. PR and Release Gates

- [x] 3.1 Changeset included for release-impacting package changes
- [x] 3.2 CI-equivalent local checks passed (pre-existing exceptions proven on pristine main: macOS path-realpath env, board date-bomb — the latter fixed here)
- [x] 3.3 PR checks passed (Fast / Windows Portability / Browser gates green; PR #259 merged)

## 4. Merge Readiness

- [x] 4.1 OpenSpec archive flow completed (this archive delivery)
- [x] 4.2 PR merge approved (release: 9.0.3 on npm latest, remote tags, GitHub Release)
