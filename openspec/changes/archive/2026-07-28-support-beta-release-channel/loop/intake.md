<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Preserve the owner's request to release OpenSpecUI 6 through a beta channel first.
2. Bound beta versioning, registry tagging, GitHub release presentation, and retry-safe tag delivery.
3. Keep stable latest publication and unrelated product work outside this Change.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## User Input

> 我想先发布一个beta版本

## Objective Scope

- Generate the first OpenSpecUI 6 prerelease as `6.0.0-beta.0` from the accepted OpenSpec CLI 1.6 changesets.
- Publish every public changed workspace package under the npm `beta` dist-tag while preserving `latest=5.0.0`.
- Create package tags and an `openspecui@6.0.0-beta.0` GitHub prerelease without pushing a stale `main` ref.
- Make a rerun recover tags and release metadata after packages were published but tag delivery was interrupted.

## Non-Goals

- Do not publish stable `6.0.0` or move the npm `latest` dist-tag.
- Do not merge the independent Kanban PR or add product behavior.
- Do not redesign the complete release TUI or migration policy.
- Do not claim completion from a dry run alone.

## Acceptance Boundary

- `pnpm changeversion --pre beta` produces a reviewed version PR for `6.0.0-beta.0`.
- Stable versions publish with `latest`; prerelease versions publish with their explicit prerelease channel.
- A no-op workflow does not rewrite an old GitHub Release, while a tag-recovery run can finish after registry publication.
- Release tag delivery pushes tags only and remains valid when `main` advances during the build.
- Required CI passes before merge.
- npm shows `beta=6.0.0-beta.0` and `latest=5.0.0`; the corresponding Git tag and GitHub prerelease exist.
