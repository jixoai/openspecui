<!--
Orthogonal intents (created 2026-07-28 Asia/Shanghai):
1. Synchronize implementation reality with the approved distillation plan.
2. Record production-owner decisions and focused evidence.
3. Preserve divergence and loopback triggers without rewriting history.

Original request (2026-07-28): implement the information-hierarchy optimization, then hand final acceptance to the Owner.
-->

## Implementation State

Status: **implementation active; Change and OPSX workflow distillation complete**.

```text
spec artifacts -> shared primitives -> owner groups -> focused evidence -> delivery -> owner acceptance
```

The beta release preceding this Change completed as `6.0.0-beta.1`; package publication is not part of this
Change.

## Decisions Taken

- Presentation primitives remain subscription-free and mutation-free.
- `InformationBadge` is the Tier 2 status carrier; it must be keyboard-focusable and Tooltip-attributed.
- `EvidenceDisclosure` is the Tier 3 owner; it uses the installed Base UI Accordion primitive.
- Errors, stale authority, blocked actions, and destructive consequences remain Tier 1 direct content.
- Existing route/subscription/mutation owners remain intact; this is a presentation architecture change.
- The `opsx-ui-views` delta and canonical Chinese terminology encode the three-tier hierarchy; strict OpenSpec
  validation passes.
- `InformationBadge` composes the existing Badge and Tooltip with a focusable `note` role and explicit accessible
  identity; it adds no data ownership.
- `EvidenceDisclosure` composes the installed Base UI Accordion with browser-findable collapsed content and a
  reduced-motion-safe height transition.

## Focused Evidence

```text
Information disclosure unit          1 file / 3 tests
Web typecheck                         passed
Focused oxlint                       0 warnings / 0 errors
Focused format                       passed
```

The unit test focuses the real Tooltip trigger and activates the real Base UI Accordion trigger. It separately
proves a direct alert remains visible while supporting evidence is collapsed.

### Shell and Dashboard

- Expanded and mobile shell variants now keep Planning identity direct; Launch path, full Planning path, Root
  source, and Store remain in the Context link's accessible Tooltip.
- Dashboard Data scopes is a single compact strip. Planning path remains direct; Store, Reference, and Code versus
  Planning Git facts use `InformationBadge`.
- Root resolution failures, Reference error counts, Git subscription failures, and Planning Git identity failures
  remain direct alert content.

```text
Shell / Dashboard unit               2 files / 12 tests
Web typecheck                         passed
Focused oxlint                       0 warnings / 0 errors
Focused format                       passed
```

### Change and OPSX Workflow

- Workflow targets keep the Planning path direct while Root source, Store, and direct Reference counts use
  keyboard-reachable `InformationBadge` instances.
- A stale target and Reference errors remain direct alerts outside Tooltip content.
- Change paths, artifact paths, action context, Reference diagnostics, and the complete Status command envelope
  now share one collapsed `EvidenceDisclosure`; static snapshots retain an explicit compact source condition.
- Propose, Compose, and Verify reuse one pure `WorkflowEvidenceDisclosure`; New's Advanced Arguments remains a
  real form disclosure rather than being mislabeled as evidence.
- Root blocker title/message and Apply progress divergence remain direct. Their verbose CLI evidence and objective
  source counts move into disclosure/badge space without changing mutation ownership.

```text
Change / OPSX focused unit           7 files / 38 tests
Web typecheck + checked P6 tests     passed
```

## Divergence Notes

- None.

## Loopback Triggers

- A required failure becomes reachable only by opening an Accordion or focusing a Tooltip.
- A route needs new backend data or a parallel health inference to produce its summary.
- Static and live projections require different presentation semantics for the same fact.
- A shared primitive grows subscription, routing, or mutation ownership.
- Focused tests cannot distinguish direct blocker content from collapsed evidence.
