#!/usr/bin/env tsx
/**
 * Setup example directory for E2E testing
 *
 * Usage: pnpm example:setup [--clean]
 *
 * Creates an example project with:
 * - openspec/ directory structure
 * - Sample specs and changes
 * - openspec.config.json
 */

import { mkdir, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const EXAMPLE_DIR = join(import.meta.dirname, '..', 'example')

const SAMPLE_SPEC_AUTH = `# auth

## Overview
User authentication and authorization system.

## Requirements
- Support email/password login
- Support OAuth providers (Google, GitHub)
- JWT-based session management
- Role-based access control (RBAC)

## API Endpoints

### POST /api/auth/login
Login with email and password.

### POST /api/auth/register
Register a new user account.

### POST /api/auth/logout
Logout and invalidate session.

### GET /api/auth/me
Get current user profile.
`

const SAMPLE_SPEC_USER = `# user

## Overview
User profile and account management.

## Requirements
- User profile CRUD operations
- Avatar upload support
- Email verification
- Password reset flow

## Data Model

\`\`\`typescript
interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'admin' | 'user'
  createdAt: Date
  updatedAt: Date
}
\`\`\`

## API Endpoints

### GET /api/users/:id
Get user by ID.

### PATCH /api/users/:id
Update user profile.

### DELETE /api/users/:id
Delete user account.
`

const SAMPLE_CHANGE_PROPOSAL = `# Add Two-Factor Authentication

## Why
Enhance security by adding 2FA support for user accounts.

## What Changes
- Add TOTP-based 2FA
- Add backup codes generation
- Update login flow to support 2FA verification

## Deltas
- spec: auth (update)
`

const SAMPLE_CHANGE_TASKS = `# Tasks

- [ ] Design 2FA database schema
- [ ] Implement TOTP generation and verification
- [ ] Add backup codes support
- [ ] Update login API to handle 2FA
- [ ] Create 2FA setup UI
- [ ] Add 2FA management in user settings
- [ ] Write unit tests
- [ ] Update API documentation
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
    command: 'npx openspec',
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
    // Changes: each change is a directory with proposal.md + tasks.md
    [join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'proposal.md'), SAMPLE_CHANGE_PROPOSAL],
    [join(EXAMPLE_DIR, 'openspec', 'changes', 'add-2fa', 'tasks.md'), SAMPLE_CHANGE_TASKS],
    // Project-level files
    [join(EXAMPLE_DIR, 'openspec', 'project.md'), SAMPLE_PROJECT_MD],
    [join(EXAMPLE_DIR, 'openspec', 'AGENTS.md'), SAMPLE_AGENTS_MD],
    [join(EXAMPLE_DIR, 'openspec', 'openspec.config.json'), JSON.stringify(CONFIG, null, 2)],
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
