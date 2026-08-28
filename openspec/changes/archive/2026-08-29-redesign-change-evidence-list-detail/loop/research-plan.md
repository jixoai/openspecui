<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Record the current Evidence composition and the constraints that carry over.
2. Define the list-detail topology and its container-responsive behavior.
3. Assign one production owner and red/green evidence to the single implementation slice.

Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
-->

# Change Evidence list-detail redesign plan

## Current state (verified)

```text
packages/web/src/routes/change-view.tsx:115-122
  Evidence tab = stacked panels:
    <ChangeEvidencePanel/>      summary, paths, artifacts, references (full-w sections)
    <ChangeDiffEvidence/>       requirement diffs (own Accordion, full-w)
    <ArchivedValidationEvidence/> archived validation (own Accordion, full-w)
```

Constraints that carry over unchanged (AGENTS.md laws):

- Evidence layering order: readable paths/facts -> artifact outputs/references -> requirement
  diffs -> archived validation -> CLI result -> raw payload.
- The tab owns primary vertical scrolling; no page-level horizontal overflow; paths wrap.
- Container queries, never viewport breakpoints, choose the project-surface topology.
- Failures stay on the direct plane; unavailable evidence is typed-unavailable, never fabricated.
- Keyboard reachability for every list item; no hover-only information.

## Design

1. New `EvidenceWorkspace` owner inside the Evidence tab:
   - evidence item list: one row per evidence section, in the law's layer order, each with a
     compact status chip derived only from already-available facts (e.g., MODIFIED delta count
     for diffs; pass/fail/unavailable for archived validation); no fabricated counts.
   - detail pane: renders the selected section's existing content components.
2. Container-responsive topology via `@container` on the workspace:
   - spacious: two columns `auto 1fr` (list ~clamp 220-260px; detail takes the rest); both panes
     scroll independently, detail remains the tab's primary reading surface.
   - crowded: single column; the list is the entry surface; selecting an item reveals the detail
     with a back affordance; returning restores the list without refetch.
3. Sub-selection is presentational local state (default: first item); the routed unit remains the
   Evidence tab. No route/storage persistence.
4. Existing content components become structure-agnostic: `ChangeDiffEvidence` and
   `ArchivedValidationEvidence` drop their own Accordion wrappers and expose content sections the
   workspace mounts; their fetching/provenance/degradation logic is untouched.
5. `ChangeEvidencePanel` splits presentation-wise into list-addressable sections (summary/paths
   first, CLI/raw payload last) without changing its data contract.

## Slice

| Owner                                                                                                                                                                                                 | Red case                                                                                                                                                                      | Green case and focused gate                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/src/components/evidence-workspace.tsx` (new) + `change-view.tsx` Evidence composition + de-accordioned `change-diff-evidence.tsx` / `archived-validation-evidence.tsx` + affected tests | Evidence still renders stacked full-width accordions; list rows are not keyboard reachable; crowded container shows two cramped columns; a11y tree loses the section headings | Wide container: list + detail, detail scrolls independently; crowded container: list -> detail -> back; layer order preserved; de-accordioned sections keep provenance and typed-unavailable behavior. Run `change-view.test.tsx`, `change-diff-evidence.test.tsx`, `archived-validation-evidence.test.tsx` (rewritten to the new structure). |

## Risks

- Existing tests drive Accordion triggers; they must be rewritten against the workspace
  (structure-only assertions; keep provenance assertions intact).
- The mobile back-navigation must not unmount fetching state (keep components mounted or accept
  refetch; prefer keep-mounted with hidden pane).
