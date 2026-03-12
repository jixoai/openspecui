## User Input

- Continue optimizing GitHub Actions speed.
- Prefer routing CI by the changed subproject: if only one subproject changes, only the related CI tasks should run.
- Avoid unnecessary CI work for unrelated subprojects.

## Objective Scope

- Make `PR Quality` compute affected scope from changed files.
- Route `Fast Gate` and `Browser Gate` by affected workspace packages and known implicit dependencies.
- Preserve the existing protected check names.

## Non-Goals

- Change test code or loosen test coverage.
- Redesign the release workflow.
- Guarantee perfect minimality for every possible implicit dependency without encoding known project-specific edges.

## Acceptance Boundary

- `PR Quality` can skip unrelated package checks when only a subset of subprojects changes.
- Workspace dependency closure is respected so shared-package changes still fan out to dependents.
- Known project-specific implicit edges such as `web -> app/website` are handled.
- Local CI-equivalent checks pass.
- PR checks pass and the loop is archived before merge.
