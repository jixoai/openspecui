<!--
Orthogonal intents (created 2026-07-28 Asia/Shanghai):
1. Synchronize implementation reality with the approved distillation plan.
2. Record production-owner decisions and focused evidence.
3. Preserve divergence and loopback triggers without rewriting history.

Original request (2026-07-28): implement the information-hierarchy optimization, then hand final acceptance to the Owner.
-->

## Implementation State

Status: **implementation active; presentation migration and focused delivery gate complete**.

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

### Config, Settings, and Context

- Project Binding keeps Store/Reference inputs, validation, convergence, and errors direct. Successful Root
  preview, observed Reference warnings, and write settlement share one collapsed disclosure; duplicate direct
  preview/subscription errors are deduplicated without suppressing the failure.
- Active Root keeps the selected Planning path and the external-write consequence direct while source, Store,
  external ownership, and file path use keyboard-reachable badges.
- Environment Global keeps its JSON/Profile/Update mutations direct. Config/data-scope paths use badges and the
  raw `config path`/`config list`/drift envelope uses the shared disclosure.
- Settings now summarizes Root compatibility/selection and Environment profile/delivery/drift/workflows with
  links to the owning Context and Config routes; lifecycle failures remain direct.
- Live Context keeps the Planning path direct, promotes CLI/Reference/contract errors, and collapses Reference
  plus Doctor/Context command evidence. Static Context retains published source/Store identity and the explicit
  Reference export policy without inventing live authority.

```text
Config / Settings / Context unit     5 files / 80 tests
Web typecheck + checked P6 tests     passed
Focused oxlint                       0 warnings / 0 errors
```

### Catalog Metadata

- Referenced Spec Store headings remain the direct source identity. Their repeated count/read-only prose is one
  keyboard-reachable lock badge whose Tooltip states the exact Store projection boundary.
- Live enumeration failures, CLI diagnostics, static-source failure conditions, compound links, and neutral empty
  states remain direct and source-specific.
- The publishable presentation change carries a Web-only patch changeset; it does not alter Core or Server
  contracts and does not authorize another release.

```text
Spec Catalog unit                    3 files / 20 tests
Web typecheck + checked P6 tests     passed
Focused oxlint                       0 warnings / 0 errors
Focused format                       passed
```

### Focused Delivery Gate

- The six stale layout-contract suites now locate the compact accessible owners instead of expecting Tier 2 or
  Tier 3 evidence to remain expanded. `WorkflowTargetNotice` exposes a stable named region so Compose lifecycle
  evidence crosses the real production owner.
- Static Context SSR asserts the accessible evidence boundary and published Reference disclosure trigger; Tooltip
  Portal copy is intentionally absent from server-rendered HTML.
- A clean SSG build completed from absent `dist-ssg` and `.vite` outputs. It retained only the repository's
  existing `scroll-button` CSS compatibility and ineffective dynamic-import warnings.

```text
Stale contract correction unit      6 files / 28 tests
Static focused unit                 3 files / 23 tests
Web typecheck + checked P6 tests    passed
Focused oxlint                      0 warnings / 0 errors
Focused format                      passed
Clean SSG build                     passed
```

### Repository Delivery Gate

```text
Repository format check             passed
Repository lint                     0 warnings / 0 errors
Workspace typecheck                 15 projects passed
Root unit                           15 files / 64 tests
Core unit                           52 files / 486 tests
Server unit                         84 files / 543 tests
App unit                            32 files / 212 tests
Web unit                            165 files / 1047 tests
CLI unit                            14 files / 71 tests
xterm browser fixture               60 passed / 1 skipped
Web realtime browser fixture        2 passed
Web Storybook fixture               12 passed
Strict OpenSpec validation          passed
git diff --check                    passed
```

Web unit retained the existing jsdom Canvas `getContext` not-implemented diagnostics while all tests passed;
that non-failing environment log is not evidence of a presentation regression. Automated browser evidence remains
component/fixture preparation only and does not close the Owner walkthrough.

## Divergence Notes

- None.

## Loopback Triggers

- A required failure becomes reachable only by opening an Accordion or focusing a Tooltip.
- A route needs new backend data or a parallel health inference to produce its summary.
- Static and live projections require different presentation semantics for the same fact.
- A shared primitive grows subscription, routing, or mutation ownership.
- Focused tests cannot distinguish direct blocker content from collapsed evidence.
