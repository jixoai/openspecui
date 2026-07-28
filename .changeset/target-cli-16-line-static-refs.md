---
'@openspecui/core': major
openspecui: major
'@openspecui/web': major
---

Static export now supports direct OpenSpec References and publication privacy.

`ExportSnapshot.meta` is root-aware and privacy-safe: it carries `observedAt`,
`projectName`, CLI-resolved `root` provenance, and `referencePolicy`. The absolute
`meta.projectDir` is removed. `specs[].identity` is the compound `SpecIdentity`
union (owned | referenced) so exported referenced Specs keep `(storeId, specId)`
identity across routes, search, and the static catalog.

`openspecui export` gains `--references <include|omit>`, required when the planning
root declares effective References. `include` materializes direct Reference Specs
through official `list --specs --store --json` / `show --type spec --store --json`
(complete-or-fail, never transitive); `omit` records an explicit omission state.
A single publication redaction boundary strips absolute paths, host identity, and
gates the Git remote behind the explicit include policy.

Referenced Specs hydrate in the static provider/search/SSG under their compound
routes (`/specs/referenced/<storeId>/<specId>`), scoped to `referenced-specs`
search, with an explicit omission error when absent.
