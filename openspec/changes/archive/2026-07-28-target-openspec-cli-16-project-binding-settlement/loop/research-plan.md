<!--
Orthogonal intents (created 2026-07-19 Asia/Shanghai):
1. Record the current mutation and subscription boundary.
2. Separate launch binding writes from Planning-root observation.
3. Define causal red evidence before any production correction.
-->

## Current boundary

```text
planningConfig.updateProjectBinding
  -> writeProjectBindingConfig(launch project file)
  -> resolveRootContext()
  -> readProjectBindingConfig(rootPreview)
  -> return ProjectBindingConfig
```

The previous browser observation (`Saving...` while files already showed B) did not prove a production
defect. The old fixture completed `resolveRootContext` immediately and did not expose a checked typed
transition fixed point.

## Required research

1. Trace the real server owner and subscription emissions around a launch binding write.
2. Define the response discriminant for launch write, preview state, transition id/state, and diagnostics.
3. Prove dirty-draft preservation and failure rendering at the real Config mutation owner.
4. Reject arbitrary sleeps, a generic generation barrier, and browser-only router rewrites.

## Verification

- Use typed server/router fixtures with watcher/subscription settlement enabled.
- Preserve raw CLI stdout/stderr, exit status, diagnostics, and root provenance.
- Run focused tests before any full package gates; stop on a fixture blocker after one bounded attempt.
