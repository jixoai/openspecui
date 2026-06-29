---
'@openspecui/core': minor
'@openspecui/server': minor
'@openspecui/web': minor
---

Add a read-only Stores panel (beta) and a beta-feature fault-tolerance model.

## Stores panel (beta)

OpenSpecUI 1.5.0 Stores are now surfaced in a read-only panel with a visible
Beta badge. It lists machine-registered OpenSpec stores (id + root) via
`openspec store list --json`, refreshes on a 5s poll (the registry lives outside
the project directory, so the file watcher can't observe it), and is live-only
(not part of the static/SSG snapshot).

## Beta-feature fault tolerance

Beta features no longer rely on the stable version gate. Stores tolerates CLI
absence/incompatibility at runtime with lenient (passthrough, optional-field)
zod parsing and classifies failures into two kinds:

- **data-incompatible** (CLI exits 0 but the payload fails lenient parsing) →
  the panel shows an objective error **with the OpenSpec CLI version source**.
- **command-unavailable** (the `store` command is missing or changed; non-zero
  exit) → the Stores navigation entry is hidden.

The frontend never crashes on either failure kind.

## Version law (stable maintenance)

OpenSpecUI 4.x now accepts OpenSpec CLI `>=1.3.0 <1.6.0`. The 1.5 line is the
target, 1.4 remains current/recommended, and 1.3 stays legacy-compatible. This
is independent stable maintenance (previously 1.5.0 was hard-blocked).
