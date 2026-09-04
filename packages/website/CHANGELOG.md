# @openspecui/website

## 12.0.0

### Major Changes

- d272b1f: OpenSpecUI 12: adapt the OpenSpec CLI 1.12 line.
  - Compatibility window: OpenSpec CLI `>=1.12.0 <1.13.0` (single-series; stable 1.12.x current and
    recommended). CLI `1.10.x`/`1.11.x` (the OpenSpecUI 11 window) and older lines are blocked by default;
    prereleases and `>=1.13.0` remain blocked.
  - `validate --report findings` is a new capability-gated typed contract and validation evidence surface:
    findings-only items with preserved full-run totals and exit codes; `invalid_validation_report_request`
    request errors flow through the shared diagnostic envelope.
  - Merge-conflict advisory findings (`Archive would refuse this delta` / `Could not check archive merge
conflicts`) render as a first-class informational (INFO) class without changing validity evidence.
  - Agent delivery adds SourceCraft Code Assistant (`.codeassistant`, natural-language skill references,
    commands at `.codeassistant/commands/opsx-<id>.md`, no IDE restart, no migration) for 1.12 sessions;
    generator staleness rotates to the 1.12.0 baseline.
  - Pinned executable fixtures: `openspec-cli-112` proves the new contracts; the retained
    `openspec-cli-111` proves capability-boundary rejections.

## 11.1.0

### Minor Changes

- 97aca09: Expose spec-scope validation on the Specifications surfaces: a shared
  read-only evidence component at the all-specs header and the owned-spec
  detail header, with typed transport and report schemas, contract-drift
  and static degradation, making spec-level findings such as the 1.11
  Purpose-placeholder warning reachable in the UI.

## 11.0.0

### Major Changes

- 56e20c8: OpenSpecUI 11 adapts OpenSpec CLI 1.10 and 1.11 in one release line: stable `>=1.10.0 <1.12.0` is admitted with the 1.11 line current and recommended and the 1.10 line supported non-current, while CLI `<1.10.0` (including 1.9.x and older), every prerelease, `>=1.12.0`, and unparseable versions stay blocked by default behind the session-scoped version-bypass dialog. 1.11 sessions load the full change status list through one `openspec status --all --json` spawn behind a capability gate — 1.10 keeps the serial per-change path — with partial-failure batches preserved as per-change diagnostics instead of failing the whole status projection. Change Detail MODIFIED deltas render the CLI's own `openspec show --diff` unified diff body and exact upstream warnings as separate evidence without recomputing or backfilling the local delta projection, `openspec init --language` passes through on both admitted lines, and validate surfaces the Purpose-placeholder warning class. The Agent delivery registry is rebuilt from the pinned 1.11 inventory: Zed joins from 1.10 (skills-only at `.agents/skills`, shared-root owner candidate), Antigravity declares `.agents` current with `.agent` legacy/migration evidence from 1.11 only while 1.10 keeps `.agent` current, opencode command templates carry the `**Provided arguments**` passthrough, and per-tool IDE-restart guidance follows actually written artifacts. Pinned 1.10.0/1.11.0 executable fixtures prove every accepted contract plus both capability-boundary rejections, and the references/openspec pin advances to verified v1.11.

  The 10.0.0 base version is consumed without a release so this major changeset publishes as OpenSpecUI 11.0.0: the v11 line deliberately skips a separate 1.10-only OpenSpecUI 10 release while still taking on every 1.10 protocol obligation.

### Minor Changes

- de39f9c: Present the Change Detail Evidence tab as a container-responsive list-detail workspace:
  evidence rows in the decision-plane layer order with fact-derived status chips, a detail
  pane that owns the tab's reading surface, and a crowded drill with a back affordance that
  keeps settled evidence mounted — replacing the stacked full-width accordions. Evidence
  semantics, CLI provenance, and typed degradation are unchanged.

### Patch Changes

- 4cc5289: Consume the 10.0.0 base version without a release so the pending major
  changeset publishes OpenSpecUI as 11.0.0 (the v11 line skips a separate
  10.x release, the same base-consumption the v9 release performed).

## 9.0.3

### Patch Changes

- 9faeda4: Renew the website home page as a single-page OpenSpecUI 9 narrative (Broadside Log direction): hero with quick-start copy command and terminal typing card beside the headline on wide screens, an eight-entry feature index with sticky scroll-spy rail, the three usage surfaces, an inverted run-it band with runner and App/Web controls plus the `--auth` access-gate row, and the current OpenSpec CLI 1.8.x/1.9.x compatibility boundary. The retired PWA surface and the pending-rework translation platform are intentionally absent.

## 9.0.2

## 9.0.1

## 9.0.0

## 7.0.2

## 7.0.1

## 7.0.0

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.1

## 6.0.0

## 6.0.0-beta.1

## 6.0.0-beta.0

## 5.0.0

## 4.1.0

## 4.0.2

## 4.0.1

### Patch Changes

- 962795a: Re-release the 4.x line as 4.0.1.

  `4.0.0` is permanently blocked on npm: it was published then unpublished on
  2026-05-22 for `@openspecui/core`, `@openspecui/search`, and `openspecui`, and
  npm forbids re-using a published-then-unpublished version. The fixed group moves
  together, so the first installable 4.x release is `4.0.1`. No code changes beyond
  the 4.0.0 CLI-1.4 line bump.

## 4.0.0

### Major Changes

- b8d85f9: Release OpenSpecUI 4.0 aligned with OpenSpec CLI 1.4 workflows.
  - Establish OpenSpecUI 4.x as the OpenSpec CLI 1.4.x target line while accepting 1.3.x as legacy-compatible.
  - Block OpenSpec CLI versions outside `>=1.3.0 <1.5.0`.
  - Sync AI tool metadata with OpenSpec CLI 1.4.1, including Kimi CLI and Mistral Vibe skills-only tools.
  - Update documentation, reference guard, and in-app copy for the OpenSpec CLI 1.4 line.

## 3.12.0

## 3.11.6

## 3.11.5

## 3.11.4

## 3.11.3

## 3.11.2

## 3.11.1

## 3.11.0

## 3.10.0

## 3.9.0

## 3.8.0

## 3.7.2

## 3.7.1

## 3.7.0

## 3.6.1

## 3.6.0

## 3.5.2

## 3.5.1

## 3.5.0

## 3.4.1

## 3.4.0

### Minor Changes

- 23d9e26: Migrate the public website to SvelteKit static generation, add hooks documentation, build-time Shiki highlighting, and light/dark/system theme switching.

### Patch Changes

- a3d1d1a: Fix hooks documentation to match the shipped hooks API, and generalize website
  syntax highlighting so `.svx` documentation code fences share the same
  build-time Shiki pipeline as hook examples.

## 3.3.0

## 3.2.3

## 3.2.2

## 3.2.1

## 3.2.0

## 3.1.2

## 3.1.1

## 3.1.0

## 3.0.1

## 3.0.0

## 2.3.7

## 2.3.6

## 2.3.5

## 2.3.4
