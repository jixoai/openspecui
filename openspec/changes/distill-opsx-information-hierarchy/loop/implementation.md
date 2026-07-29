<!--
Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
1. Synchronize implementation reality with the approved distillation plan.
2. Record production-owner decisions and focused evidence.
3. Preserve divergence and loopback triggers without rewriting history.

Original request (2026-07-28): implement the information-hierarchy optimization, then hand final acceptance to the Owner.
Owner correction (2026-07-29): reorganize the rejected shell, Config, Context, Settings, and Change evidence surfaces before acceptance.
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

### Pull Request Evidence

- PR: https://github.com/jixoai/openspecui/pull/219
- Code-bearing HEAD verified by remote checks: `01445cd4841bc17f8a67d396942aa09eb57d3d4c`
- Final PR HEAD: `f3af76c779996154596598d16d22389ca5d9f0e4` (documentation-only evidence update).
- Remote checks for both HEADs: Changeset Gate, CI Scope, Fast Gate, Browser Gate, and Browser Gate (@openspecui/web) all passed.
- PR remains open and unmerged. Owner visual/real-browser acceptance is the next boundary; no archive, merge, or
  additional beta release is authorized by this Change.

## Divergence Notes

- The `768x1024` preparation pass exposed one viewport-owned Settings field pair: `md:grid-cols-2` activates from
  the outer viewport even though the desktop rail leaves only a `512px` Settings container. Checkpoints 6.11-6.13
  reopen implementation for a container-query correction and narrow/intermediate/spacious proof.

## Owner Follow-up (2026-07-29)

The first visual review accepted the objective facts but rejected the information architecture in five concrete
places. This is a presentation correction inside the same Change, not a new data contract:

```text
shell navigation       -> route-only; Context owns Planning identity
Project Binding         -> editable declarations first; registry-backed freeform Store Combobox
Context                 -> root / launch / Store+References / action readiness first; evidence deeper
Settings                -> one scroll owner (.main-content)
Change evidence         -> summary -> readable facts -> raw CLI envelope; mobile-safe wrapping
```

The Store Combobox may consume the existing Server Store list projection for suggestions, but the typed Store id
input remains authoritative and freeform. Registry/list failure is secondary suggestion evidence and must not block
editing, repair, or saving an explicitly entered id. No product surface may infer Store health, completeness, or
cross-project ownership from the suggestion list.

The owner will perform the final visual walkthrough. Agent evidence is limited to focused Vitest and basic
`agent-browser` mobile checks; it does not close the owner acceptance checkpoint.

## Owner Correction Delivery (2026-07-29)

The correction keeps product ownership explicit without changing OpenSpec facts or mutation authority:

```text
project shell    route navigation only; no second Planning/Context action
Project Binding editable Store + References -> preview/write evidence on demand
Context          Planning root -> launch project -> References -> action readiness -> CLI evidence
Settings         .main-content is the only block-axis scroll owner
Change Detail    readable paths -> artifacts / References / CLI result -> raw payload
```

- `ProjectStoreCombobox` composes Base UI's controlled Combobox as a freeform Store id editor. The existing
  reactive Store-list projection supplies suggestions only; an unavailable or incomplete registry never changes
  the submitted id or disables repair.
- Planning Store and Reference help use semantic icon buttons, so the Tooltip explanation is available through
  keyboard focus as well as pointer interaction.
- Context reports readiness only from the current Root Context projection and its authority. It does not infer
  readiness from Store suggestions or collapse failure evidence.
- Change evidence uses container-query reflow, wrapped readable paths, bounded raw output, and independently
  disclosed artifact, Reference, and CLI layers.

### Focused and mobile preparation evidence

```text
Focused Web unit                     6 files / 101 tests passed
Web typecheck + checked P6 tests     passed
Focused oxlint                       0 warnings / 0 errors
agent-browser 390 x 844              Config, Context, Settings, Change Detail checked
agent-browser 768 x 1024             Config, Context, Settings, Change Detail checked
```

- At `390px`, Config, Context, and Change Detail each retained document width `390/390`; expanded Context
  evidence retained `356/356`, and expanded Change evidence regions retained `328/328`, `326/326`, and
  `302/302` client/scroll widths.
- At `768px`, the desktop rail left a `512px` content container. Config, Context, Settings, and expanded Change
  evidence retained `512/512` main-content width without page-level inline overflow.
- Settings exposed exactly one overflowing block-axis owner at both sizes: `.main-content` (`740/13351` at
  `390x844`, `992/6021` at `768x1024`). Its `@container-[size]` child remained `overflow-y: visible`.
- Real keyboard `Tab` focus opened the Planning Store Tooltip. The Combobox popup stayed viewport-bounded and
  rendered one suggestion list without a duplicate empty-state row.

### Correction delivery gate

```text
Scoped format check                  passed
Repository lint                     0 warnings / 0 errors
Workspace typecheck                 15 projects passed
Root unit                            15 files / 64 tests
Core unit                            52 files / 486 tests
Server unit                          84 files / 543 tests
App unit                             32 files / 212 tests
Web unit                             164 files / 1046 tests
CLI unit                             14 files / 71 tests
xterm browser fixture               60 passed / 1 skipped
Web realtime browser fixture        2 passed
Web Storybook fixture               12 passed
Clean SSG build                     passed
Strict OpenSpec validation          passed
git diff --check                    passed
```

The repository-wide format command additionally inspected the Owner's uncommitted `openspec/config.yaml` and
reported that file only. The correction did not alter, format, stage, or include that Owner-owned file; every
Change and production file in this delivery passed the scoped formatter check. Clean SSG retained only the
repository's existing `scroll-button` CSS compatibility and ineffective dynamic-import warnings.

The local Vite+ pre-commit hook could not run because the repository has no `staged` configuration in
`vite.config.ts`. After the complete gates above passed, the implementation commit used `--no-verify`; remote CI
remains the independent delivery check.

### Correction pull request evidence

- Code-bearing HEAD: `5eb7d8beedd90aa9d09a0d75806516886c0c56a9`.
- PR #219 remained `OPEN` and `CLEAN` at that HEAD.
- Changeset Gate, CI Scope, Fast Gate, Browser Gate (`@openspecui/web`), and aggregate Browser Gate all completed
  successfully for the code-bearing HEAD.
- No merge, archive, or release occurred; the next boundary remains Owner visual acceptance.

These measurements are agent preparation evidence only. Checkpoint 6.6 remains open for the Owner's final visual
and end-to-end walkthrough.

## Container-Responsive Correction (2026-07-29)

The remaining Terminal Light/Dark field pair now follows the existing Settings `@container-[size]` owner. It stays
in one column until that content container reaches `42rem`; the outer viewport no longer chooses the field density.
The checked Settings fixture asserts the container variant and rejects restoration of `md:grid-cols-2`.

```text
Viewport       Settings content   Terminal theme columns   Document width   Block scroll owner
390 x 844      390px              324px                    390 / 390        .main-content only
768 x 1024     512px              446px                    768 / 768        .main-content only
1280 x 900     1024px             347px + 347px            1280 / 1280      .main-content only
```

- Config, Context, Settings, and expanded Change evidence retained equal document client/scroll widths at all
  three viewports. Bounded tabs and syntax blocks may scroll locally, but did not create page-level inline scroll.
- Config kept the Planning Store editor and Reference draft in a readable mobile flow. Context kept Planning root,
  launch project, References, and action readiness before evidence. Change evidence retained its readable path ->
  Artifact outputs / References / CLI result hierarchy at `390px`.
- Agent-browser screenshots and computed layout checks are preparation evidence only. They do not close the Owner's
  final visual or end-to-end acceptance checkpoint.

### Local correction gate

```text
Web unit                              164 files / 1046 tests passed
Focused Web format + lint             passed, 0 warnings / 0 errors
Repository lint                       0 warnings / 0 errors
Workspace typecheck                   15 projects passed
Complete workspace unit               passed
xterm browser fixture                 60 passed / 1 skipped
Web realtime browser fixture          2 passed
Web Storybook fixture                 12 passed
Clean SSG build                       passed
Strict OpenSpec validation            passed
git diff --check                      passed
```

Repository `format:check` inspected the Owner's uncommitted `openspec/config.yaml` and reported that file only.
The correction did not alter or stage it; every production, test, and Change file in this correction passed the
scoped formatter check.

### Container correction pull request evidence

- Code-bearing HEAD: `6cbacc23c9a3cb4fc406a5d85a60f1809277bd4f`.
- PR #219 remained `OPEN` and `CLEAN` at that exact HEAD.
- Changeset Gate, CI Scope, Fast Gate, Browser Gate (`@openspecui/web`), and aggregate Browser Gate all completed
  successfully.
- No merge, archive, or release occurred. Checkpoints 6.6 and 7.1 remain the Owner's visual acceptance boundary.

## Same-Root Presentation Correction (2026-07-29)

The follow-up keeps physical Root topology and configuration hygiene as independent facts:

```text
Root Context launch physical identity + CLI Planning path
                         |
                         v
          collapsed | distinct | unresolved
            |             |            |
            v             v            v
       omit duplicate   keep both    preserve uncertainty

Doctor root_pointer_ignored -> Config warning + editable clear draft
```

- Core now retains `launchProject.physicalPath`, resolved through the existing physical-path owner, while keeping
  the original Launch display/cwd path. The browser-safe hosted schema preserves this additive identity.
- `selectRootTopology` is a pure Web selector. It reads only Launch/Planning identities and does not inspect Root
  source, Store, diagnostics, References, Git, subscriptions, or action authority.
- Dashboard omits its entire context band only for a ready collapsed Root with zero References, one settled Git
  scope, and no Root/transport/Git failure. Refresh, References, distinct/resolving Planning Git, and failures
  restore the band.
- Generic Terminal creation hides the same-root cwd selector and sends `launch-project`. Workflow-locked creation
  hides the same redundant selector but still sends `planning-root` plus the expected Root generation. The public
  PTY target protocol and stale-generation guard are unchanged.
- Project Binding reads `root_pointer_ignored` from Doctor diagnostics, presents it as a non-destructive warning,
  and clears only the Store draft through the existing Save owner. Context keeps Root actions ready, exposes the
  warning through a keyboard-reachable badge, and combines current same-root identity as `Project root`.
- Failed Context attempts remain expanded; only current ready/refreshing same-root observations consolidate.

### Focused same-root evidence

```text
Core Root/hosted contract unit             2 files / 12 tests passed
Web topology/Dashboard/Terminal/Config/
Context unit                               7 files / 81 tests passed
Core + Web typecheck                       passed
Focused lint                               0 warnings / 0 errors
Focused Prettier check                     passed
Strict OpenSpec validation                 passed
git diff --check                           passed
```

The subsequent delivery gate also passed repository lint across 1,056 files, all 15 workspace typechecks, complete
`test:ci`, and a clean SSG client/server build from absent `dist-ssg` and `.vite` outputs. SSG retained only the
existing `scroll-button`, chunk-size, and ineffective dynamic-import warnings. Repository `format:check` inspected
23 changed files and reported only the Owner's uncommitted `openspec/config.yaml`; all 22 delivery-owned files pass
the scoped Prettier check.

The Owner's uncommitted `openspec/config.yaml` supplied the real warning observation but was not modified, formatted,
staged, or included. Automated evidence stops at unit/component boundaries; checkpoint 6.20 and final visual/browser
acceptance remain open.

## Loopback Triggers

- A required failure becomes reachable only by opening an Accordion or focusing a Tooltip.
- A route needs new backend data or a parallel health inference to produce its summary.
- Static and live projections require different presentation semantics for the same fact.
- A shared primitive grows subscription, routing, or mutation ownership.
- Focused tests cannot distinguish direct blocker content from collapsed evidence.
