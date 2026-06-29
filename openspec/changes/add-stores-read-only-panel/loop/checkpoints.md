## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved
- [x] 1.4 Spec deltas authored and validated (`openspec-cli-integration` MODIFY + ADD, `opsx-ui-views` ADD)

## 2. Implementation

- [ ] 2.1 Implementation started from approved plan
  - [ ] A. Version-law bump in `packages/core/src/openspec-compat.ts` + unit tests
  - [ ] B. `packages/core/src/store-types.ts` Zod schemas/types + export
  - [ ] C. `CliExecutor.listStores()` / `doctorStores(id?)`
  - [ ] D. `storesRouter` in `packages/server/src/router.ts` (list/doctor/subscribe) + mount
  - [ ] E. `packages/web/src/components/stores/stores-panel.tsx` + Beta badge + hook + live-only nav mount
  - [ ] F. `.changeset/*.md`
- [ ] 2.2 Progress synchronized with implementation artifact
- [ ] 2.3 Unexpected issues loop back to intake/research-plan

## 3. PR and Release Gates

- [ ] 3.1 Changeset included for release-impacting package changes (`@openspecui/core`/`server`/`web`)
- [ ] 3.2 CI-equivalent local checks passed (`format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`)
- [ ] 3.3 SSG guard passed (`pnpm --filter @openspecui/web build:ssg`; stores not in static snapshot)
- [ ] 3.4 PR checks passed

## 4. Merge Readiness

- [ ] 4.1 OpenSpec archive flow completed
- [ ] 4.2 PR merge approved
