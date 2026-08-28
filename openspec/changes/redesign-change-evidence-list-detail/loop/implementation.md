<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Track the single implementation slice and its evidence.
2. Keep the walkthrough re-verification handoff explicit.

Original request (2026-08-28): "这种结构替代手风琴会更好"
-->

# Implementation state

```text
R0 change authored              DONE   intake / research-plan / opsx-ui-views delta
R1 implementation               DONE   touched files: web/components/evidence-workspace.tsx (new),
                                       web/components/change-diff-evidence.{tsx,test.tsx},
                                       web/components/archived-validation-evidence.{tsx,test.tsx},
                                       web/components/change-evidence-panel.{tsx,test.tsx},
                                       web/components/change-evidence-surface.browser.test.tsx,
                                       web/routes/change-view.{tsx,test.tsx}, .gitignore.
                                       Focused commands (run in this branch):
                                       `cd packages/web && npx vitest run src/routes/change-view.test.tsx`
                                       (20/20), the three component suites (24/24),
                                       `npx vitest run --config vitest.browser.config.ts
                                       src/components/change-evidence-surface.browser.test.tsx` (5/5),
                                       `pnpm --filter @openspecui/web typecheck`, `pnpm lint:ci`,
                                       `pnpm format:check`, plus web full unit (1181/1181).
                                       Deviation: none. Slice owner: one implementation subagent;
                                       integrator re-ran every focused suite.
R2 Codex review                 ROUND1 DONE (6.5/10) -> fixes; ROUND2 DONE (7.0/10) -> fixes; ROUND3
                                       PENDING
R3 rebuild walkthrough assets   PENDING  rebuild web bundle + copy-web + restart 3100/3101
R4 Owner re-walkthrough        PENDING  acceptance boundary
```

## Round-2 review disposition (herdr `evidence-reviewer`, 2026-08-28, 7.0/10)

- No-refetch test rewritten as a live 1.11 session (ready Root Context with cli 1.11.0 and a
  resolving diff fetch): waits for exactly one settled call before drilling, then asserts the
  count stays one across back and re-entry — no longer a vacuous 0==0.
- Spacious-transition focus: growing from crowded while drilled unmounts the back affordance;
  focus now migrates to the selected row when it was on the back button.
- implementation.md now carries the full touched-file list and the exact focused commands.
- Rejected with reason: synthesizing Enter/Space activation would require user-event solely to
  reproduce a native `<button type="button">` platform guarantee jsdom does not implement; the
  rows are native controls and the keyboard path is covered by focus/tab tests.

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
