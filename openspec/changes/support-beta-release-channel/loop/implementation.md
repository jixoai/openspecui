<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track implementation state against the approved beta release plan.
2. Record owner and recovery decisions as code lands.
3. Preserve divergences and loopback triggers without rewriting history.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## Implementation State

Status: approved for implementation. No registry state has changed.

```text
release-channel projection   pending
changeversion prerelease     pending
retry-safe publication       pending
workflow tag-only delivery   pending
real beta publication        pending
```

## Decisions Taken

- SemVer package versions are the only authority for npm dist-tag and GitHub prerelease state.
- `.changeset/pre.json` is the only persisted prerelease-mode authority.
- The publish owner decides whether registry or tag work remains; the workflow consumes one objective output.
- Git pushes from release automation carry tag refs only.
- `release_created` is emitted only after package publication or tag recovery; a registry-and-tag-complete run skips downstream release mutation.
- Release scripts and their focused tests now have an explicit TypeScript lane instead of transpile-only evidence.

## Divergence Notes

None.

## Loopback Triggers

- Changesets cannot produce `6.0.0-beta.0` from the current major ledger.
- npm requires a channel mapping that cannot be derived from the generated SemVer version.
- A retry after registry success cannot reconstruct missing tags from repository state.
- Required CI or real registry verification exposes a broader release contract defect.
