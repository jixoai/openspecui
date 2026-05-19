## 1. Intake

- [x] 1.1 User idea captured objectively
- [x] 1.2 Research scope separated from implementation
- [x] 1.3 Non-goals protect active handoff and translation work

## 2. Repository Facts

- [x] 2.1 Current Node package builders identified
- [x] 2.2 Current Vite 8 consumers identified
- [x] 2.3 `tsc` role distinguished from runtime builder role

## 3. External And Local Evidence

- [x] 3.1 Vite 8 docs checked for Environment API / ModuleRunner
- [x] 3.2 Vite 8 docs checked for multi-entry library mode
- [x] 3.3 Vite 8 resolve condition behavior inspected
- [x] 3.4 Conditional exports behavior tested under Node, tsx, Bun, and workspace symlink layout
- [x] 3.5 Vite 8 multi-entry library output tested
- [x] 3.6 Vite 8 SSR library output tested for Node semantics
- [x] 3.7 Vite ModuleRunner tested with a TypeScript module

## 4. Recommendation

- [x] 4.1 Recommendation recorded: conditional exports/dev-condition law first
- [x] 4.2 Recommendation recorded: do not immediately replace tsdown
- [x] 4.3 Follow-up implementation phases recorded

## 5. Verification

- [x] 5.1 `openspec status --change evaluate-vite-node-runtime-build --json` shows artifacts complete
- [x] 5.2 `openspec validate --all --strict --no-interactive` passes
