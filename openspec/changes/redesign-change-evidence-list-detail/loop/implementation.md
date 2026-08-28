<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Track the single implementation slice and its evidence.
2. Keep the walkthrough re-verification handoff explicit.

Original request (2026-08-28): "这种结构替代手风琴会更好"
-->

# Implementation state

```text
R0 change authored              DONE   intake / research-plan / opsx-ui-views delta
R1 implementation               DONE   integrator-verified: change-view/diff/archived-validation/panel
                                       tests 42/42 (+2 added round-2), web unit full 1181/1181, Chromium
                                       browser 5/5, typecheck + lint + format green. Slice owner: one
                                       implementation subagent; integrator re-ran focused suites.
R2 Codex review                 ROUND1 DONE (6.5/10) -> fixes applied; ROUND2 PENDING
R3 rebuild walkthrough assets   PENDING  rebuild web bundle + copy-web + restart 3100/3101
R4 Owner re-walkthrough        PENDING  acceptance boundary
```

## Round-1 review disposition (herdr `evidence-reviewer`, 2026-08-28, 6.5/10)

- Major 1 fixed: crowded drill now hands focus to the back affordance and returns it to the
  originating row; keyboard test asserts `document.activeElement` both ways.
- Major 2 fixed: this file now records the real gate evidence (was left PENDING during review).
- Minor: no-refetch assertion added (drill + back + re-enter leaves the settled diff fetch count
  unchanged); ResizeObserver-absent fallback documented as an invariant (no-RO engines also lack
  @container, so the crowded base matches the rendered single column).
- Minor (accepted, no change): chip fact-type duplication across sections is cosmetic; the
  .gitignore `__screenshots__/` entry covers this change's browser-test artifacts (justified in
  the PR body).

## Evidence recording rule

Gate turns DONE only with the touched files, the focused test commands actually run, and any
deviation. The integrator re-runs focused tests locally before recording.
