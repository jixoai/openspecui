## 1. Research and Planning

- [x] 1.1 Intake captured objective user request and prior plan
- [x] 1.2 Research facts recorded from prior Vite/runtime research
- [x] 1.3 Current package exports/scripts inspected
- [x] 1.4 Implementation path selected: conditional exports first, no builder migration

## 2. BDD Coverage

- [x] 2.1 Add failing BDD test for default dist resolution
- [x] 2.2 Add failing BDD test for explicit development source resolution
- [x] 2.3 Add failing BDD test for OpenSpecUI package export maps
- [x] 2.4 Add failing BDD test for source-mode worktree child `NODE_OPTIONS`
- [x] 2.5 Observe the tests fail before implementation
- [x] 2.6 Add failing BDD test for nested source worker bootstrap URL canonicalization
- [x] 2.7 Add failing BDD test for root-owned worker handoff delegation
- [x] 2.8 Add failing BDD test that server ready returns before background warmup starts

## 3. Platform Implementation

- [x] 3.1 Add development branches to required package exports
- [x] 3.2 Add explicit development condition to source dev scripts
- [x] 3.3 Propagate development condition to source-mode worktree child commands
- [x] 3.4 Preserve packaged/default dist behavior
- [x] 3.5 Strip parent `tsx` loader query/hash from source self-bootstrap entries
- [x] 3.6 Make root runtime the worktree handoff owner for nested worker switches
- [x] 3.7 Defer watcher/search/dashboard/kernel warmup until after runtime ready

## 4. Verification

- [x] 4.1 Focused CLI BDD tests pass
- [x] 4.2 Relevant package typechecks pass
- [x] 4.3 Process-level worktree child smoke passes
- [x] 4.4 `openspec validate --all --strict --no-interactive` passes
- [x] 4.5 Real consecutive worktree switching succeeds: main -> worktree A -> worktree B -> main
- [x] 4.6 Hot switching between already-started worktree runtimes reuses root-owned siblings

## 5. Delivery

- [x] 5.1 Implementation artifact updated with actual decisions
- [x] 5.2 Change remains isolated from handoff and translation edits where possible
