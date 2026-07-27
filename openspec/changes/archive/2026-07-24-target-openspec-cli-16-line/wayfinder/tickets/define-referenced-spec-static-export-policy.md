<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Decide whether and how static exports may include specs from referenced Stores.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
-->

# Define the referenced-spec static export policy

Status: closed
Type: grilling

## Question

Should a static export include specs resolved through the active root's declared References, and what explicit scope, provenance, path, and redaction rules preserve read-only context without exporting every registered Store or silently crossing repository ownership boundaries?

## Resolution

[Referenced-spec static export policy](../research/referenced-spec-static-export-policy.md) defines one live/static Spec Catalog with compound source identity and explicit export consent:

- `--references=include` exports direct, declared, fully resolved Reference Specs through official CLI list/show commands.
- `--references=omit` preserves an explicit omission state; missing policy is an error whenever the active root declares References.
- Reference exports never include transitive References, changes, archives, config, Git data, the registry, or unrelated Stores.
- Static provenance retains Store/spec identity, source, read-only state, and observation time while removing absolute paths, remotes, runtime-environment identity, and path-bearing diagnostics.

The shared identity migration is the main work. Static-only work remains limited to consent, materialization, redaction, hydration, SSG route enumeration, and parity tests.
