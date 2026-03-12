## User Input

- Continue the GitHub Actions speed work after the previous PR quality speed patch merged.
- Keep improving PR throughput.
- Maintain compatibility with the existing protected check setup while optimizing the browser test stage.

## Objective Scope

- Reduce PR wall-clock time spent in browser testing by parallelizing the browser workload.
- Keep the change focused on `.github/workflows/pr-quality.yml`.
- Preserve the existing top-level protected check name used for browser validation.

## Non-Goals

- Add diff-based skip logic in the same loop.
- Rework release workflows or package publishing.
- Change test coverage or test commands themselves.

## Acceptance Boundary

- Browser testing runs in parallel shards instead of one monolithic browser job.
- The workflow still exposes a final `Browser Gate` check name for branch protection compatibility.
- Local CI-equivalent checks pass.
- PR checks pass and the loop is archived before merge.
