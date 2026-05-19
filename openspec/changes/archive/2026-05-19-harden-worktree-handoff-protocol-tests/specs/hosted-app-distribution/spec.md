# Delta for hosted-app-distribution

## MODIFIED Requirements

### Requirement: Backend-Owned Embedded UI Contract

The hosted shell SHALL depend on backend-declared embedding metadata instead of a hosted version manifest.
The backend health payload SHALL also declare runtime protocol capabilities used by cross-runtime Web shells.

#### Scenario: Backend health advertises embedded UI entrypoint

- **WHEN** the hosted shell probes `/api/health`
- **THEN** the payload SHALL include `hostedShellProtocolVersion`
- **AND** the payload SHALL include `embeddedUiUrl`
- **AND** the payload SHALL include runtime capabilities
- **AND** the shell SHALL reject payloads that do not satisfy that contract

#### Scenario: Reject backend without required runtime capabilities

- **GIVEN** a backend health endpoint returns `status: "ok"` and project metadata
- **WHEN** the payload omits a runtime capability required by the current Web shell
- **THEN** the payload SHALL be treated as incompatible
- **AND** the caller SHALL reject the backend before embedding or handoff navigation

#### Scenario: Hosted shell launches backend-owned page

- **WHEN** the backend advertises a compatible `embeddedUiUrl`
- **THEN** the shell SHALL load that URL in the iframe
- **AND** it SHALL append the active backend `api` parameter
- **AND** it SHALL append the tab-local `session` parameter
