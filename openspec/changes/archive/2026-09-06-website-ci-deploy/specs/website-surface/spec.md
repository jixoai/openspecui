## ADDED Requirements

### Requirement: CI-driven production deployment

Pushes to main that affect the website (or a manual dispatch) SHALL build
the site in Actions and deploy the dist artifact to the existing
Cloudflare Pages project via token-authenticated wrangler, with a shape
check gating the deploy; the local `cf:deploy` remains a manual fallback
and the dist/_headers contract is unchanged.

#### Scenario: merge deploys

- **WHEN** a PR merging website changes lands on main
- **THEN** the workflow builds, checks, and deploys, and
  www.openspecui.com serves the new build without any manual step.
