<!--
Orthogonal intents (created 2026-07-28 Asia/Shanghai):
1. Record fixed-point 5.x versus 6.x information-density evidence.
2. Define the shared information hierarchy and affected production owners.
3. Sequence implementation, risk controls, and owner-only final acceptance.
4. Separate same-root presentation topology from repairable OpenSpec configuration diagnostics.

Original request (2026-07-28): restore 5.x-like clarity while keeping all 6.x facts retrievable and OPSX-primary.
-->

## Research Findings

### Fixed-point evidence

| Surface          | Current 6.x behavior                                                                                                             | 5.x / product consequence                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Global shell     | Expanded sidebar prints Launch, Planning, source, and Store on separate rows                                                     | Persistent navigation spends primary space on provenance rather than the current workspace              |
| Dashboard        | `DashboardContextSummary` renders three full columns for Planning, References, and Git before the task surfaces                  | Context facts repeat the shell and dedicated `/context` page, pushing OPSX progress lower               |
| Change Detail    | `ChangeContextEvidence` prints Root paths, action context, Reference counts, and artifact-path evidence above `ChangeCommandBar` | Supporting evidence visually outranks the command workflow it exists to protect                         |
| Workflow dialogs | `WorkflowTargetNotice` uses a multi-row definition list for Root, Store, source, and Reference diagnostics                       | The actual target is important, but the complete provenance consumes the same weight as the action      |
| Config           | Project Binding renders Root preview, observed References, and latest write evidence as separate always-visible sections         | The editable Store/Reference form loses focus; write settlement evidence is low-frequency after success |
| Settings         | Root and Environment diagnostics repeat full path, workflow, drift, and evidence grids                                           | Settings becomes a second Context page instead of a status summary with navigation to the owner         |
| Context          | High-level identities and raw `doctor/context` envelopes coexist at similar visual weight                                        | This is the correct detail owner, but command evidence should remain collapsed until requested          |

Repository comparison confirms the information growth is structural: between `openspecui@5.0.0` and current
6.x, the Web routes/components gained dedicated Root, Config, Settings, Reference, realtime, and provenance
projections. The facts are required by the 1.6 contract; their default visual expansion is not.

### Existing design-system facts

- `Badge` already provides compact tone/size/shape vocabulary.
- `Tooltip` is Base UI-backed and portal-mounted, so it can escape clipped scrolling regions.
- `@base-ui/react` already ships accessible Accordion primitives; no new dependency is required.
- Native `<details>` is currently styled ad hoc in Change, Context, Config, and OPSX routes, producing inconsistent
  density and disclosure affordance.
- The established UI uses a restrained monochrome/primary palette, square/beveled geometry, Lucide icons, and
  fixed product typography. This Change preserves those identity tokens.

### Product hierarchy law

```text
Tier 1  OPSX decision
        current task | next action | mutation | blocker | error
        -> visible without interaction

Tier 2  scan status
        source | Store | References | schema | freshness | counts
        -> Badge with accessible Tooltip

Tier 3  inspect evidence
        paths | provenance | raw CLI | diagnostics | settlement history
        -> collapsed Accordion, expanded on demand
```

Errors and authority loss are promoted to Tier 1 regardless of their source. A Tooltip may explain a visible
error badge, but it cannot be the only place where the failure is exposed.

## Decision & Plan (For Approval)

### Shared presentation owner

Add one small Web information-disclosure module:

```text
InformationBadge
  Badge + keyboard focus + Tooltip + explicit accessible label

EvidenceDisclosure
  Base UI Accordion item
  compact trigger + optional badges + chevron
  panel for paths, raw envelopes, and verbose diagnostics
```

The module owns presentation only. It receives already-resolved facts and never reads subscriptions, infers
health, or authorizes operations.

### Surface migration

1. **Shell and Dashboard**
   - Show the current Planning identity as the primary shell label.
   - Move Launch path, source, and Store into tooltip/status badges.
   - Replace the Dashboard three-column Data scopes band with one compact context strip; keep failures direct and
     retain the `/context` link.
2. **Change and OPSX workflow**
   - Keep Change phase/artifact summary and command bar direct.
   - Render Planning target path directly; compress source, Store, and Reference diagnostics into badges.
   - Collapse Change CLI paths/action context and raw workflow evidence behind shared disclosure.
   - Keep Apply divergence visible as a compact warning because it changes progress interpretation.
3. **Config**
   - Keep editable fields, Save state, and validation direct.
   - Convert successful Root preview, observed Reference facts, mutation settlement, data-scope provenance, and
     raw CLI evidence to summary badges/disclosures.
   - Keep preview/write/subscription errors direct.
4. **Settings and Context**
   - Settings shows compact current Root/Environment status and links to the owning Config/Context routes.
   - Context retains full objective facts, but groups command envelopes and Reference detail under consistent
     disclosures.
5. **Catalog metadata**
   - Where source/read-only/schema facts are already concise, use badges/tooltips instead of adding prose.
   - Do not hide source-specific enumeration failures or static unavailability.

### Documentation and delivery

- Add a delta to `opsx-ui-views` defining the three-tier information hierarchy.
- Add canonical Chinese terms to `i18n.zh.md` and update the repository architecture intent in `AGENTS.md`.
- Add one package changeset for publishable Web behavior.
- Commit specification artifacts before implementation commits.

## Capability Impact

### New or Expanded Behavior

- Shared keyboard-accessible information badges and consistent evidence accordions.
- One cross-route hierarchy for OPSX decisions, scan status, and inspectable evidence.
- Compact Root/Reference/Store summaries that remain source-attributed.

### Modified Behavior

- Secondary 6.x evidence becomes collapsed by default rather than being removed.
- Shell, Dashboard, Change, Config, Settings, and Context allocate their direct visual space according to OPSX
  decision relevance.
- Successful mutation/refresh evidence becomes on-demand; failure and blocked states remain direct.

## Risks and Mitigations

| Risk                                                                 | Mitigation                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A Tooltip hides required facts from keyboard or assistive technology | `InformationBadge` is focusable and owns an explicit accessible label; tests cover focusable trigger and content |
| Progressive disclosure accidentally hides a blocker                  | Tests assert error/stale/blocked text remains outside collapsed panels                                           |
| Refactor changes reactive ownership                                  | Shared components accept props only; subscription and mutation owners remain in their current modules            |
| Route-specific facts are flattened into an inferred health label     | Badges use objective labels/counts and preserve unknown/error states; no synthetic “healthy” aggregate           |
| Static and live surfaces drift                                       | Reuse the same pure presentation primitives and preserve existing static projection types                        |
| Large visual scope causes broad regressions                          | Migrate by owner group with focused tests before repository-wide gates                                           |

## Verification Strategy

```text
shared primitive tests
  -> surface-focused Vitest
  -> Web typecheck + lint/format
  -> clean SSG + static focused tests
  -> repository CI-equivalent gates
  -> PR checks
  -> Owner visual and real-browser walkthrough
```

- Primitive tests: keyboard focus, accessible naming, default-collapsed panel, open/close, tooltip content.
- Surface tests: direct OPSX action/blocker remains visible; secondary evidence is available through the shared
  trigger; direct errors remain outside disclosures.
- Static tests: existing source labels and unavailable states survive the presentation migration.
- Minimum gates: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci`, clean `pnpm --filter @openspecui/web build:ssg`, strict Change validation, and
  `git diff --check`.
- Automated browser/component evidence is preparation only. Final visual and end-to-end acceptance belongs to
  the Owner.

## Container-Responsive Follow-up (2026-07-29)

The first mobile/tablet pass found one remaining viewport-owned topology in Settings:

```text
viewport 768px - desktop rail 256px = Settings container 512px
                                         |
                                         +-- md:grid-cols-2 activates too early
```

Settings already owns an `@container-[size]` boundary, so its Light/Dark terminal-theme pair must follow that
container instead of `md`. The correction keeps one column at mobile and rail-constrained tablet widths, then
adds two columns only when the Settings content container itself is spacious. Browser evidence must record both
viewport and actual content widths at `390x844`, `768x1024`, and `1280x900`.

## Same-Root Presentation Follow-up (2026-07-29)

The Owner's live project exposes the upstream warning `root_pointer_ignored`: `openspec/config.yaml` declares a
Store while the same directory already has a real planning shape. OpenSpec 1.6 intentionally keeps the local root,
ignores only the pointer, and reports a structured non-blocking warning with a removal fix. Evidence:

- `references/openspec/src/core/root-selection.ts` selects the real nearest root before a declared Store fallback.
- `references/openspec/src/core/relationship-health.ts` emits `root_pointer_ignored` with warning severity.
- `references/openspec/openspec/work/simplify-context-and-workspace-model/slices/declared-store-fallback/spec.md`
  defines fallback-never-override and preserves `references:` beside the ignored pointer.
- A real local `openspec doctor --json` run reports Planning root source `nearest`, `store: null`, and the warning in
  top-level `status`; Root Context remains ready.

The product must therefore keep two axes orthogonal:

```text
Root topology                 Config hygiene
collapsed | distinct         clean | root_pointer_ignored
          | unresolved       | other diagnostics
          |                  |
          v                  v
presentation density         warning / repair ownership
```

### Implementation sequence

1. Add one subscription-free selector for `collapsed | distinct | unresolved`. It compares canonical,
   server-observed physical identities and never infers topology from Root source, Store id, warning text, or Git.
2. Omit Dashboard's entire context band only for the healthy collapsed default. References, refresh, failed or
   resolving Git, Root/transport failures, and distinct roots restore it.
3. Omit Terminal cwd selection for collapsed roots. Generic creation remains Launch-owned; workflow-locked
   Planning creation retains the Planning target and expected generation. The PTY protocol is unchanged.
4. Project Binding reads `root_pointer_ignored` from CLI Doctor diagnostics, renders warning severity, labels the
   declaration ignored, and clears it through the existing draft/save owner.
5. Context renders one Project root summary for collapsed topology and separate Launch/Planning facts otherwise.
6. Prove each production boundary with focused Vitest before repository gates. Final visual and browser acceptance
   remains Owner-owned.

### Hard stops

- Do not treat lexical display labels, Store identity, `nearest`, or one-Git scope as proof of same physical root.
- Do not remove `launch-project | planning-root` from the public PTY contract.
- Do not make `root_pointer_ignored` block Root actions or disappear outside Config/Context evidence.
- Do not touch the Owner's live `openspec/config.yaml` while implementing or validating this follow-up.
