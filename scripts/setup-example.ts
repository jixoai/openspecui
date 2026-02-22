#!/usr/bin/env tsx
/**
 * Setup example directory for E2E testing
 *
 * Usage: pnpm example:setup [--clean]
 *
 * Creates an example project with:
 * - openspec/ directory structure
 * - Sample specs and changes
 * - .openspecui.json
 */

import { existsSync } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'

const EXAMPLE_DIR = join(import.meta.dirname, '..', 'example')

const SAMPLE_SPEC_AUTH = `# auth Specification

## Purpose
User authentication and authorization capability.

## Requirements

### Requirement: Email And Password Login
The system SHALL allow users to sign in with an email address and password.

#### Scenario: Valid credentials succeed
- **WHEN** a user submits the correct email and password
- **THEN** the system SHALL issue a session token

### Requirement: OAuth Providers
The system SHALL support Google and GitHub as external identity providers.

#### Scenario: Redirect and callback
- **WHEN** the user selects an OAuth provider
- **THEN** the system SHALL redirect to the provider and complete the callback flow.
`

const SAMPLE_SPEC_USER = `# user Specification

## Purpose
User profile and account preferences.

## Requirements

### Requirement: Profile Management
The system SHALL allow users to view and update their profile details.

#### Scenario: Update display name
- **WHEN** the user saves a new display name
- **THEN** the profile SHALL persist the change and show the updated value.
`

const SAMPLE_CHANGE_PROPOSAL = `# Change: Add Two-Factor Authentication

## Why
Password-only logins leave accounts exposed to credential stuffing and phishing.

## What Changes
- **auth**: add a TOTP challenge after password verification and support backup codes
- **user**: let users manage 2FA settings in their profile, including backup codes export
- Add a short design note for the 2FA enrollment and verification flow

## Impact
- Affected specs: auth, user
- Affected code: api/auth/*, web/settings/*, auth worker
`

const SAMPLE_CHANGE_TASKS = `# Tasks: add-2fa

## 1. API
- [ ] 1.1 Add TOTP verification endpoint and rate limits
- [ ] 1.2 Store 2FA secret and backup codes securely (hashed)

## 2. Web
- [ ] 2.1 Build 2FA setup screen (QR + recovery codes)
- [ ] 2.2 Add 2FA challenge step to login form

## 3. Quality
- [ ] 3.1 Add unit tests for TOTP validation and backup code rotation
- [ ] 3.2 Document happy path and lockout scenarios
`

const SAMPLE_CHANGE_DESIGN = `# Design: 2FA

## Context
- Demo design to exercise the Overview + ToC merge across multiple markdown files.
- Mirrors the real design template we expect for changes.

## Goals / Non-Goals
- Goals: keep login usable while adding a second factor; provide recovery codes.
- Non-Goals: hardware keys, WebAuthn, or SMS delivery.

## Decisions
1) Use TOTP as the primary second factor.
2) Back up access via single-use recovery codes.
3) Reuse existing session issuance after second factor success.

## Risks / Trade-offs
- Additional latency on login → mitigated by caching the latest TOTP window.
- Recovery codes leakage → mitigate with hashing and one-time visibility.

## Open Questions
- Should we allow remember-this-device?
- Do we need rate limits per IP or per account?
`

const SAMPLE_DELTA_AUTH = `# Delta for auth

## ADDED Requirements

### Requirement: Time-Based One-Time Password
The system SHALL prompt for a 6-digit TOTP after password verification when the user has enabled 2FA.

#### Scenario: Valid TOTP continues login
- **WHEN** a user submits the correct TOTP within the allowed window
- **THEN** the system SHALL issue the session token and record the verification method

#### Scenario: Invalid TOTP blocks login
- **WHEN** the TOTP is missing or invalid
- **THEN** the system SHALL reject the login attempt and keep the session unauthenticated

## MODIFIED Requirements

### Requirement: Email And Password Login
The system SHALL treat password verification as the first factor and require a second factor when 2FA is enabled for the account.
`

const SAMPLE_DELTA_USER = `# Delta for user

## ADDED Requirements

### Requirement: Backup Codes Management
The system SHALL allow users to view, regenerate, and revoke backup codes from their profile settings.

#### Scenario: Regenerate invalidates previous
- **WHEN** a user regenerates backup codes
- **THEN** previous codes SHALL be revoked and the UI SHALL present the new set once for download.
`

const SAMPLE_CHANGE_NOTES = `# Notes

- Demo change that includes multiple delta specs (auth, user)
- Extra file so the Folder tab can show non-spec assets
`

// Second sample change: session timeout improvements
const SAMPLE_CHANGE2_ID = 'improve-session-timeout'

const SAMPLE_CHANGE2_PROPOSAL = `# Change: Improve session timeout handling

## Why
- Sessions currently expire abruptly without user warning, leading to lost work.
- Security review requests shorter idle timeout with explicit renewal path.

## What Changes
- Add pre-expiry warning and renewal flow for web clients.
- Shorten default idle timeout to 20 minutes with configurable value.
- Ensure re-auth uses existing auth methods (password, OAuth, 2FA when enabled).

## Impact
- Affected specs: auth
- Affected code: web session manager, auth API, client timer hooks
`

const SAMPLE_CHANGE2_TASKS = `# Tasks: ${SAMPLE_CHANGE2_ID}

## 1. Backend
- [ ] 1.1 Add configurable idle timeout (default 20m) and expose in config
- [ ] 1.2 Emit pre-expiry warning event 2 minutes before timeout

## 2. Web
- [ ] 2.1 Show renewal dialog on warning; retry extends session without full logout
- [ ] 2.2 Add client heartbeat to keep-active only on user activity

## 3. Quality
- [ ] 3.1 Add unit tests for warning timing and renewal
- [ ] 3.2 Update docs for timeout and renewal UX
`

const SAMPLE_CHANGE2_DELTA_AUTH = `# Delta for auth

## ADDED Requirements

### Requirement: Session Timeout Warning
The system SHALL warn signed-in users at least 2 minutes before idle session expiry and offer renewal without losing work.

#### Scenario: Warn before expiry and renew
- **WHEN** a user's idle time reaches the warning threshold
- **THEN** the UI SHALL display a renewal prompt and, if confirmed, refresh the session without forcing re-login (respecting 2FA if required)

## MODIFIED Requirements

### Requirement: Email And Password Login
The system SHALL issue session tokens that honor the configured idle timeout and support renewal after warning.

#### Scenario: Session respects configured timeout
- **WHEN** the user signs in with email/password and stays idle beyond the configured timeout
- **THEN** the session SHALL expire, requiring re-authentication per policy
`

const SAMPLE_PROJECT_MD = `# Example Project

This is an example project for testing OpenSpec UI.

## Tech Stack
- Node.js + TypeScript
- React frontend
- PostgreSQL database

## Getting Started
1. Install dependencies
2. Run database migrations
3. Start development server
`

const SAMPLE_AGENTS_MD = `# AI Agent Instructions

## Code Style
- Use TypeScript strict mode
- Follow ESLint rules
- Write unit tests for all new code

## Architecture
- Clean architecture with layers
- Repository pattern for data access
- Service layer for business logic

## Commit Messages
- Use conventional commits format
- Include ticket number if applicable
`

const CONFIG = {
  cli: {
    command: 'npx @fission-ai/openspec',
  },
}

async function setup(clean = false) {
  console.log('Setting up example directory...')

  if (clean && existsSync(EXAMPLE_DIR)) {
    console.log('Cleaning existing example directory...')
    await rm(EXAMPLE_DIR, { recursive: true })
  }

  // Create directory structure
  // OpenSpec expects: specs/{id}/spec.md and changes/{id}/proposal.md + tasks.md
  const dirs = [
    EXAMPLE_DIR,
    join(EXAMPLE_DIR, 'openspec'),
    join(EXAMPLE_DIR, 'openspec', 'specs'),
    join(EXAMPLE_DIR, 'openspec', 'specs', 'auth'),
    join(EXAMPLE_DIR, 'openspec', 'specs', 'user'),
    join(EXAMPLE_DIR, 'openspec', 'changes'),
    join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa'),
    join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'specs'),
    join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'specs', 'auth'),
    join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'specs', 'user'),
    // second change
    join(EXAMPLE_DIR, 'openspec', 'changes', SAMPLE_CHANGE2_ID),
    join(EXAMPLE_DIR, 'openspec', 'changes', SAMPLE_CHANGE2_ID, 'specs'),
    join(EXAMPLE_DIR, 'openspec', 'changes', SAMPLE_CHANGE2_ID, 'specs', 'auth'),
    join(EXAMPLE_DIR, 'openspec', 'archive'),
  ]

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true })
    console.log(`Created: ${dir}`)
  }

  // Write sample files
  const files: Array<[string, string]> = [
    // Specs: each spec is a directory with spec.md
    [join(EXAMPLE_DIR, 'openspec', 'specs', 'auth', 'spec.md'), SAMPLE_SPEC_AUTH],
    [join(EXAMPLE_DIR, 'openspec', 'specs', 'user', 'spec.md'), SAMPLE_SPEC_USER],
    // Changes: proposal + tasks + design + delta specs
    [join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'proposal.md'), SAMPLE_CHANGE_PROPOSAL],
    [join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'tasks.md'), SAMPLE_CHANGE_TASKS],
    [join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'design.md'), SAMPLE_CHANGE_DESIGN],
    [join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'notes.md'), SAMPLE_CHANGE_NOTES],
    [
      join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'specs', 'auth', 'spec.md'),
      SAMPLE_DELTA_AUTH,
    ],
    [
      join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'specs', 'user', 'spec.md'),
      SAMPLE_DELTA_USER,
    ],
    // Second change files
    [
      join(EXAMPLE_DIR, 'openspec', 'changes', SAMPLE_CHANGE2_ID, 'proposal.md'),
      SAMPLE_CHANGE2_PROPOSAL,
    ],
    [join(EXAMPLE_DIR, 'openspec', 'changes', SAMPLE_CHANGE2_ID, 'tasks.md'), SAMPLE_CHANGE2_TASKS],
    [
      join(EXAMPLE_DIR, 'openspec', 'changes', SAMPLE_CHANGE2_ID, 'specs', 'auth', 'spec.md'),
      SAMPLE_CHANGE2_DELTA_AUTH,
    ],
    // Project-level files
    [join(EXAMPLE_DIR, 'openspec', 'project.md'), SAMPLE_PROJECT_MD],
    [join(EXAMPLE_DIR, 'openspec', 'AGENTS.md'), SAMPLE_AGENTS_MD],
    [join(EXAMPLE_DIR, 'openspec', '.openspecui.json'), JSON.stringify(CONFIG, null, 2)],
  ]

  for (const [path, content] of files) {
    await writeFile(path, content, 'utf-8')
    console.log(`Created: ${path}`)
  }

  console.log('\nExample directory setup complete!')
  console.log(`\nTo test with the UI, run:`)
  console.log(`  pnpm preview -- ./example`)
}

// Parse args
const args = process.argv.slice(2)
const clean = args.includes('--clean')

setup(clean).catch(console.error)
