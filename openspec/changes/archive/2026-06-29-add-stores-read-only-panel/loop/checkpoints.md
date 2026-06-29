## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved (beta fault-tolerance paradigm)
- [x] 1.4 Spec deltas authored and validated (`openspec-cli-integration` MODIFY+ADD, `opsx-ui-views` ADD)

## 2. Implementation

- [x] 2.1 Implementation started from approved plan
  - [x] A. Version-law bump in `packages/core/src/openspec-compat.ts` + tests (stable maintenance, decoupled from Stores)
  - [x] B. `packages/core/src/store-types.ts`: lenient zod + `StoreFeatureError` (two kinds) + `StoreFeatureResult`; export + subpath
  - [x] C. `CliExecutor.listStores()/doctorStores(id?)` + classifier (ok / data-incompatible / command-unavailable)
  - [x] D. `storesRouter` (list/doctor/subscribe) in `packages/server/src/router.ts`; never throws; carries `cliVersion`
  - [x] E. `stores-list.tsx`: Beta badge; data→list; data-incompatible→error+version; command-unavailable→hide entry; live-only; defensive
  - [x] F. `.changeset/stores-beta-discovery.md` (`@openspecui/core`/`server`/`web`)
- [x] 2.2 Progress synchronized with implementation artifact
- [x] 2.3 Unexpected issues loop back to intake/research-plan

## 3. PR and Release Gates

- [x] 3.1 Changeset included for release-impacting package changes
- [x] 3.2 CI-equivalent local checks passed (`format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`)
- [x] 3.3 SSG guard passed (`pnpm --filter @openspecui/web build:ssg`; stores not in static snapshot)
- [x] 3.4 Fault-tolerance contract tests pass (data-incompatible shows version; command-unavailable hides entry; frontend never crashes)
- [ ] 3.5 PR checks passed

## 4. Merge Readiness

- [ ] 4.1 OpenSpec archive flow completed
- [ ] 4.2 PR merge approved
