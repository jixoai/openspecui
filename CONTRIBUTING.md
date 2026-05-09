# Contributing to OpenSpecUI

Thanks for your interest in improving OpenSpecUI.

## Prerequisites

- Node.js 20+ (24 recommended)
- `pnpm` 10+
- `bun` (for `pnpm dev`)

Optional:

- Nix (for reproducible shell/build)

## Local Setup

```bash
pnpm install
pnpm build
pnpm dev
```

With Nix:

```bash
nix develop
pnpm install
pnpm dev
```

## Development Workflow

1. Create a branch from `main`.
2. Start the repo development environment with `pnpm dev`.
3. Implement your changes against the source dev environment first.
4. When you need to verify the bundled/CLI-served result, open a second terminal and run `pnpm openspecui`.
5. Do not treat `pnpm openspecui` as the primary monorepo dev entry. It serves the built web assets and is meant for final packaged-behavior verification, so it can look stale if you skip `pnpm dev`.
6. Run checks locally:
   - `pnpm lint`
   - `pnpm test:ci`
   - `pnpm build`
7. Open a Pull Request.

## Branch and PR Rules

- `main` is protected: do not push directly to `main`.
- All changes go through PR review + required CI checks.
- Keep PRs focused and small when possible.

## Changesets and Releases

For user-facing changes, add a changeset:

```bash
pnpm changeset
```

Then include it in your PR.

Maintainers run versioning/release flows on `main`.

## Coding Notes

- Follow `CLAUDE.md` and repository conventions.
- Prefer type-safe implementations (avoid `any` unless unavoidable).
- Keep changes minimal and pragmatic (KISS/YAGNI/DRY/SOLID).

## Reporting Bugs and Proposing Features

- Open an issue with clear reproduction steps.
- Include environment details (`node`, `pnpm`, OS, and command output).
