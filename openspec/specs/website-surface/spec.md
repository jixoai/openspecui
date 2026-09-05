# website-surface Specification

## Purpose
TBD - created by archiving change renew-website-v9-surface. Update Purpose after archive.

## Requirements

### Requirement: Single-page v9 narrative

The website home page (`/[lang]/`) SHALL present a single-page scrolling narrative for the current
OpenSpecUI 9 line only: hero with quick-start copy command and terminal typing card, an eight-entry
feature index, the three usage surfaces, and a run-it control band. It SHALL NOT publish retired
surfaces (PWA, `--app=<url>`), version-archived guidance, or the translation platform feature.

#### Scenario: Compatibility boundary is current

- **WHEN** the home page renders in either language
- **THEN** it states that OpenSpecUI 9 supports OpenSpec CLI 1.8.x and 1.9.x with 1.9 recommended
- **AND** it contains no PWA wording and no translation-platform feature copy

### Requirement: Terminal typing card placement

The hero terminal typing card SHALL render inside the hero grid's second column when the hero container
has room (≥1100px) and SHALL fall back to its own row directly below the hero copy otherwise; in both
layouts it SHALL precede the feature section. The typing animation SHALL degrade to the fully rendered
terminal under `prefers-reduced-motion: reduce` and when JavaScript is unavailable.

#### Scenario: Narrow viewport degradation

- **WHEN** the hero is viewed below the two-column breakpoint
- **THEN** the terminal card occupies a full-width row after the hero copy and before the features

### Requirement: Restrained scroll motion

Scroll-driven presentation SHALL be limited to IntersectionObserver reveals (small rise or rule draw),
the feature index scroll-spy highlight, and the terminal typing effect. All motion SHALL be disabled
under `prefers-reduced-motion: reduce`, and content SHALL remain fully visible when JavaScript or the
reveal observer is unavailable.

#### Scenario: Reduced motion keeps content visible

- **WHEN** the page loads with reduced motion enabled
- **THEN** every reveal element is in its revealed state without transition

### Requirement: Launch controls stay production-accurate

The run-it band SHALL keep the runner selection (npm/pnpm/bun with persisted preference), the App/Web
flag toggle that rewrites the serve command (`<prefix> openspecui@latest --app|--web`) with matching
behavior summaries, the static export command, and the `--auth` access-gate row. Surfaced commands
SHALL match the published CLI surface exactly.

#### Scenario: Flag toggle rewrites the serve command

- **WHEN** the App mode flag is toggled off
- **THEN** every serve command element shows `--web` and the Direct Web summary replaces the App summary

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
