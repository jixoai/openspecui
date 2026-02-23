MUST READ: CLAUDE.md

## Branch Protection Policy

- `main` is protected. Do not push commits directly to `main`.
- All code changes must be submitted via Pull Request from a feature branch.
- Merge to `main` only after required CI checks pass.
- For PRs that change publishable packages, include a `.changeset/*.md` file.  
  Exception: docs-only or CI-only changes that do not affect package behavior.
