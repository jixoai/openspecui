# Checkpoints

- [x] Add `.chat/` to gitignore and preserve the accepted hooks design in `.chat`.
- [x] Add public V1 hook types and export path.
- [x] Implement project hook loader for `openspec/openspecui.hooks.ts`.
- [x] Implement document service with source/processed modes and `onReadDocument`.
- [x] Wire processed document reads into live spec view, search, and static export while preserving raw source reads.
- [x] Implement workflow invocation service with `onRunWorkflow` and default-compatible OPSX payloads.
- [x] Wire OPSX UI invocation entrypoints through the workflow invocation service.
- [x] Add focused tests for loader, document processing, #103 enrichment, search/export parity, and workflow invocation overrides.
- [x] Run scoped local verification.
