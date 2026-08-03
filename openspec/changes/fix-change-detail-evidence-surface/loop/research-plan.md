<!--
Orthogonal intents (created 2026-08-03 Asia/Shanghai):
1. Record source-backed causes of the unbounded Change Detail header surface.
2. Define the approved evidence hierarchy, module interfaces, and scroll ownership.
3. Name production owners and precise red/green verification boundaries.
4. Preserve static/live truth and owner-only final browser acceptance.

Original request (2026-08-03): optimize when and where Change Detail evidence is visible, and decide between Dialog and a dedicated tab page.
-->

## Research Findings

### Source-backed cause

```text
ChangeView toolbar
├─ retained Status error
├─ RootActionNotice
├─ ChangeContextEvidence
├─ ApplyProgressNotice
├─ OperationInputs
└─ ChangeCommandBar
          |
          v
OpsxDetailHeader
  flex + flex-wrap + justify-between
  [identity] [arbitrary-height toolbar]
```

- `packages/web/src/routes/change-view.tsx` places every status, evidence, input, and action surface in one `toolbar` node.
- `packages/web/src/components/opsx/opsx-detail-layout.tsx` renders that node as the Header identity's right-side sibling without a height, width, or scroll contract.
- The evidence component already separates readable facts, artifact outputs, References, CLI result, and raw payload. Its content hierarchy is useful; its Header placement is not.
- `OpsxEntityDetailView` is shared by active Change and Archive Detail, while only active Change owns CLI Status/Root evidence. The Evidence tab must therefore be an optional caller-provided tab rather than a mandatory shared tab.
- The existing Tabs module already owns bounded horizontal trigger scrolling and a `min-h-0` content panel. A dedicated Evidence panel can own the remaining vertical space without adding a route or Dialog.
- Current `rootAction.context?.references ?? []` collapses unavailable Root Context and an objectively observed empty Reference list into the same value. The presentation needs an explicit `current | retained | unavailable` state.
- Static `ChangeStatus` intentionally has `{ kind: 'static' }` provenance. No existing static contract publishes live Root/CLI evidence, so the correct projection is explicit unavailability rather than reconstruction.

### Product-use classification

```text
Tier 1: default decision plane
  Change identity | Schema | artifact progress | actions | direct failure/blocker

Tier 2: scan status
  Root source | Store | Reference count/currentness

Tier 3: audit evidence
  paths | action context | artifact mappings | Reference diagnostics | CLI envelopes
```

- Tier 3 is consulted when diagnosing Root/Store selection, Reference failures, artifact-output mapping, or CLI contract behavior. It is not required for routine Artifact reading.
- Apply context and operation guidance are action inputs, not audit evidence. They remain adjacent to workflow actions but collapse until explicitly requested.
- A Dialog is rejected because evidence is persistent, read-only, route-addressable, long-form, and compared repeatedly with Artifact tabs. Dialog ownership remains reserved for temporary operations and confirmation.

## Decision & Plan (For Approval)

1. Add a focused delta for `opsx-ui-views` defining the default decision plane, the routable Evidence tab, direct failures, explicit static/unavailable evidence, and one-tab scroll ownership.
2. Replace the shared `toolbar` interface with `headerActions` plus a full-width `statusRegion`; active Change passes all workflow content through `statusRegion`, while Archive remains unchanged.
3. Add optional `supplementaryTabs` to `OpsxEntityDetailView`; append them after `Folder` and preserve the existing query key. Active Change supplies one `evidence` tab, while Archive supplies none.
4. Split Change evidence presentation into a compact summary and a full Evidence panel. Derive one typed Reference presentation state at `ChangeView` so unavailable is never displayed as zero.
5. Order the Change status region as compact workflow actions/scan facts, then direct failure/blocker/divergence notices, then one collapsed Apply-input disclosure when content exists.
6. Give the Evidence panel the remaining tab height and primary vertical scrolling. Wrap paths, bound raw payload code, and prohibit page-level horizontal overflow.
7. Preserve all existing Core/Server/Router/subscription/mutation contracts and static snapshot structure.
8. Update source-intent headers, `AGENTS.md`, `i18n.zh.md`, Web browser-test admission, and an `@openspecui/web` patch changeset.

### Production owners and fixed evidence

| Production owner              | Precise red fixed point                                                                                     | Green result                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Shared OPSX detail layout     | A long caller toolbar is a descendant of the Header and grows its right side                                | Header contains identity/compact actions only; full-width status region is a sibling below it                                  |
| Change default decision plane | Artifact view exposes verbose evidence and expanded Apply context before user intent                        | Actions/direct failures remain visible; verbose evidence and Apply inputs require explicit disclosure/tab selection            |
| Change Evidence tab           | No routable tab owns complete evidence or vertical scrolling; missing Root Context reads as zero References | `?artifact=evidence` selects a bounded panel with complete source evidence and explicit current/retained/unavailable semantics |

## Capability Impact

### New or Expanded Behavior

- One route-preserving `Evidence` tab for active Changes.
- Explicit current, retained, unavailable, and static Reference-evidence presentation.
- A collapsed Apply-input disclosure on Change Detail.

### Modified Behavior

- Change workflow content moves out of the Header into a full-width region.
- Compact scan facts remain direct while verbose CLI evidence leaves the default Artifact surface.
- Shared detail callers can append caller-owned tabs without changing Archive behavior.

## Risks and Mitigations

| Risk                                               | Mitigation                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Progressive disclosure hides a blocker             | Keep transport, Root, Reference, stale-authority, and divergence messages outside the Evidence tab and collapsed Apply input |
| Generic extra tabs leak into Archive               | Make tabs caller-provided and assert Archive has no Evidence tab                                                             |
| Hidden evidence forks live/static semantics        | Reuse `ChangeStatus`; render static/unavailable states explicitly and add no data source                                     |
| A nested scroller recreates double-scroll behavior | Make the Evidence panel the tab's primary vertical owner; only the bounded raw payload may scroll internally                 |
| Tests assert class names instead of behavior       | Test public DOM regions, tab selection, accessible disclosure, visible failure states, and real component geometry           |
| Existing user work is overwritten                  | Restrict edits/staging to Change Detail, OpenSpec artifacts, docs vocabulary, test admission, and the new changeset          |

## Verification Strategy

```text
one failing seam test
  -> minimal production correction
  -> focused green
  -> next seam
  -> Web typecheck + component-browser preparation
  -> clean SSG
  -> repository CI-equivalent gates
  -> independent code review
  -> owner visual walkthrough
```

- Focused unit tests cover Header/status topology, supplementary-tab order, default hidden evidence, Apply disclosure, direct blockers, and Reference authority states.
- A checked browser fixture renders long realistic evidence at 390px, 768px, and 1280px containers; it asserts stable Header geometry, one Evidence panel vertical owner, and no page-level horizontal overflow.
- Run `pnpm --filter @openspecui/web typecheck`, focused Vitest and browser fixtures, then `pnpm --filter @openspecui/web build:ssg`.
- Run `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`, strict Change validation, changeset validation, and `git diff --check` at the exact implementation head.
- Automated browser evidence is preparation only. The owner performs final visual and end-to-end acceptance.
