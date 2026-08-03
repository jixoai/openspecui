<!--
Orthogonal intents (created 2026-08-03 Asia/Shanghai):
1. Track implementation truth for the Change Detail evidence-surface correction.
2. Record verified red/green and delivery evidence without claiming owner acceptance.
3. Preserve deviations and loopback triggers against the approved research plan.

Original request (2026-08-03): implement the approved Change Detail Evidence-tab plan.
-->

## Implementation State

Status: **Production, browser preparation, documentation, review, and scoped implementation commit complete; full repository gate and owner acceptance pending.**

The approved scope is limited to the Web Change Detail presentation, shared OPSX detail layout/tabs interface,
focused OpenSpec/docs vocabulary, checked tests, browser preparation evidence, and one Web patch changeset.

## Decisions Taken

- Use a dedicated `Evidence` tab, not a Dialog, for persistent read-only Change evidence.
- Replace the ambiguous Header `toolbar` ownership with compact `headerActions` and a full-width `statusRegion`.
- Append caller-owned `supplementaryTabs` after `Folder`; active Change supplies Evidence and Archive supplies none.
- Keep Apply inputs action-adjacent but collapsed; keep all failures, blockers, stale authority, and divergence direct.
- Model Reference evidence as `current | retained | unavailable`; never coerce unavailable Root Context to an empty observed list.
- Keep the current Core/Server/static snapshot contracts unchanged.

## Divergence Notes

None. The existing `ChangeStatus` and retained `RootActionState.context` contracts were sufficient; no Core,
Server, Router, subscription, mutation, or static snapshot contract changed.

## Verified Implementation Evidence

### Shared Detail and Change Decision Plane

- Red fixed point: the focused second-slice command failed `6` tests because the shared Header still owned the
  arbitrary `toolbar`, `OperationInputsDisclosure` did not exist, and active Change supplied neither status-region
  content nor an Evidence tab.
- Green command:

  ```bash
  pnpm --filter @openspecui/web exec vitest run --project unit \
    src/components/change-context-summary.test.tsx \
    src/components/change-evidence-panel.test.tsx \
    src/components/opsx/opsx-entity-detail-tabs.test.tsx \
    src/components/opsx/opsx-detail-layout.test.tsx \
    src/components/opsx/operation-inputs.test.tsx \
    src/routes/change-view.test.tsx
  ```

- Result: `6` files and `22` tests passed. Public DOM topology proves compact Header actions remain in the Header,
  the full-width status region is its sibling, Change alone appends Evidence after Folder, Artifact/Content remains
  default, Apply inputs stay collapsed, direct failures remain visible, and unavailable References never read as
  an observed zero.
- Type evidence: `pnpm --filter @openspecui/web typecheck` passed all configured Web TypeScript lanes.
- Migration cleanup: the obsolete `ChangeContextEvidence` component and its test were removed after all production
  imports moved to `ChangeContextSummary` and `ChangeEvidencePanel`.

### Component-browser Preparation

- Command: `pnpm --filter @openspecui/web exec vitest run --config vitest.browser.config.ts src/components/change-evidence-surface.browser.test.tsx`.
- First Chromium run passed 768px and 1280px but failed 390px because the shared Header still wrapped one compact
  icon action to a second row. Replacing `flex-wrap` with a stable `minmax(0, 1fr) + auto` grid removed that geometry
  defect.
- The next 390px run exposed `428px` content inside a `390px` host. The owner was the compact Store Badge's inherited
  no-wrap geometry, not the Evidence panel. The Badge now has a bounded ellipsis while its complete Store id remains
  in the accessible label, Tooltip, and Evidence tab.
- Final result: `1` browser file and `3` Chromium cases passed at `390px`, `768px`, and `1280px`. Each case expanded
  artifact outputs, References, CLI result, and raw payload before proving stable Header/status topology, Evidence
  vertical scroll ownership, and no host/document horizontal overflow. This is component-browser preparation only,
  not owner visual or end-to-end acceptance.

### Documentation and Admission

- Every changed TypeScript/TSX production and test file retains a timestamped orthogonal-intent/original-request
  header for the 2026-08-03 Change Detail request.
- `AGENTS.md` and `i18n.zh.md` now preserve the Change decision-plane, Detail status-region, Change Evidence-tab,
  and Reference-evidence-authority laws.
- `@openspecui/web` has one patch changeset, and its CI browser command admits the new Chromium fixture.

### Delivery Gates

- `pnpm --filter @openspecui/web build:ssg` passed for both client and Server output. The build retained the
  repository's existing CSS `scroll-button` and ineffective dynamic-import warnings.
- `pnpm lint:ci` passed with `0` warnings/errors; `pnpm typecheck` passed every workspace lane.
- Browser-equivalent lanes passed independently with exact exits: xterm-input-panel `60` passed / `1` skipped,
  App `10/10`, Web Chromium `14/14`, and Web Storybook `12/12`.
- `CHANGESET_CHECK_BASE_SHA=159efa15459a2a94902e33562cbc75da060a5d14 pnpm changeset:check`, strict Change
  validation, and `git diff --check` passed.
- Full `pnpm test:ci` passed Root `61/61`, Core `598/598`, and Server `628/628`, then stopped on three unrelated
  App failures: titlebar Settings ownership, mobile favorite navigation, and branded-titlebar `aria-expanded`.
- Full `pnpm format:check` is blocked only by the pre-existing user-owned
  `packages/server/src/dashboard-summary-router.test.ts` and `packages/server/src/server-startup.test.ts`; every
  file in this Change passes the explicit Prettier check. Those unrelated files remain untouched, so checkpoint
  `6.4` stays open rather than claiming a full repository gate.
- The repository pre-commit hook currently rejects every commit because `vite.config.ts` has no Vite+ `staged`
  config. The independently verified spec commit therefore used `--no-verify`; the implementation commit will
  preserve the same explicit evidence instead of modifying unrelated hook configuration.
- A later full Web unit attempt ran concurrently with another complete Web Vitest process and ended with two timeout
  failures plus an objective `ENOSPC` while only `2.2 GiB` remained on the shared Data volume. It still passed
  `179/181` files and `1109/1112` tests. Focused Change tests remained green, and no production timeout was widened or
  unrelated temporary data removed to manufacture a green result.
- The scoped implementation and matching evidence were committed on the current feature branch as
  `7fc074025e2f9bfef6e772af9405bd237dbb4e49` (`fix(web): restructure Change Detail evidence`). No user-owned App,
  Guide, Settings, Server-test, icon, lockfile, or other unrelated worktree changes were included, and nothing was
  pushed.

### Independent Review Corrections

- Standards review found one truth-ledger mismatch: the status line still called browser/docs pending after their
  checkpoints closed. The line now matches the evidence. It also noted a non-blocking responsibility-density risk at
  the five-intent `ChangeView` ceiling; future evidence-authority expansion should move to a dedicated owner.
- Spec review found that retained Status authority was only a button Tooltip, static Evidence discarded published
  artifact output paths, and route tests mocked the tab query owner. The correction added a direct Status notice,
  preserved static artifact outputs, exercised production `useRoutedCarouselTabs` against real window history, and
  asserted Archive owns no Evidence tab.
- Spec re-review found simultaneous Root/Status locks could collapse into one message and action-specific Continue,
  Fast-forward, and Apply reasons remained title-only. Status and Root messages are now independent, while the command
  surface directly lists every inapplicable workflow action. It also found and corrected unescaped Markdown table
  separators in the Reference-authority vocabulary.
- Final focused evidence after all review corrections: Web typecheck passed; unit `8` files / `34` tests and Chromium
  `1` file / `5` tests passed. Post-correction inspection found no remaining Standards or Spec blocker.

## Loopback Triggers

- A required Evidence fact is absent from the existing `ChangeStatus` or retained Root Context contract.
- Supplementary tabs require a shared Tabs contract change beyond caller-provided `Tab[]`.
- Direct failure presentation cannot remain visible without creating a second page-level scroll owner.
- Static Evidence requires new snapshot data rather than explicit unavailability.
- Focused browser evidence reveals an interaction or geometry conflict that changes the approved information hierarchy.
