## ADDED Requirements

### Requirement: Identity sourced from the @jixoai registry

The website's color tokens and site chrome SHALL come from the `@jixoai`
registry (jixoai-theme with `--brand-hue: 27` plus locked chrome items),
with `jixoai-ui.lock` describing every installed file, while the product
packages (`packages/web` and friends) remain untouched.

#### Scenario: registry is the only color source

- **WHEN** the website css is audited after the change
- **THEN** no palette import from `packages/web/src/index.css` remains and
  the rendered hue matches the pre-change red (oklch hue 27).

#### Scenario: upgrade convergence

- **WHEN** `npx jixoai-ui upgrade` runs
- **THEN** locked items refresh from the registry and the build still
  passes; a second run performs zero writes.

### Requirement: Functional surface preservation

The locale routing (en/zh), mdsvex hooks documentation, Shiki dual-theme
highlighting, and Cloudflare Pages build contract (`dist` output,
`_headers`) SHALL behave exactly as before the chrome swap.

#### Scenario: locales and docs intact

- **WHEN** `/en/`, `/zh/`, `/en/hooks/`, `/zh/hooks/` are built
- **THEN** each renders with the registry chrome, code blocks highlight
  under both Shiki themes, and `dist` contains the pages plus `_headers`.

### Requirement: AI export layer

The site SHALL ship `llms.txt`, `llms-full.txt`, and per-page `.md` mirrors
for both locales, generated from one build-time point with absolute URLs.

#### Scenario: stable regeneration

- **WHEN** the build runs twice without content changes
- **THEN** the export files are byte-identical.
