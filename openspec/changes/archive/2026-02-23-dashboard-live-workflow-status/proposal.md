## Why

The Dashboard top section currently oscillates between two extremes: subjective workflow labels that create noise, or flat metric stacking that loses operational clarity. We need a stable, objective layout that emphasizes real-time execution signals while avoiding redundant trend rendering.

## What Changes

- Refactor `Live Workflow Status` into two objective groups that focus on current execution state:
  - `Change Activity`
  - `Execution Signals`
- Remove subjective or inferred stage labels from top-level status presentation.
- Keep trend visualization responsibility in `Historical Trends` only; do not add additional mini trend widgets to the live status section.
- Preserve desktop comparison layout in the lower section (`Specifications` left, `Active Changes` right).

## Capabilities

### New Capabilities

- _None._

### Modified Capabilities

- `opsx-ui-views`: Tighten Dashboard status requirements so top-level status uses objective counters and execution signals, while historical trend responsibility remains in the dedicated trend section.

## Impact

- `packages/web/src/routes/dashboard.tsx`
- `openspec/specs/opsx-ui-views/spec.md` (delta)
- Dashboard tests/story updates for top status grouping and no-subjective-state behavior
