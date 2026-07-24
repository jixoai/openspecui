# Mission: Understand OpenSpec multi-root planning

## Why

Build enough shared understanding of OpenSpec 1.5/1.6 Stores to decide which multi-root capabilities belong in OpenSpecUI 6.0, without mistaking repository topology for a package-manager-style monorepo model.

## Success looks like

- Distinguish an OpenSpec root, Store, Reference, Context, and Workset.
- Predict where a command will act from its root-selection inputs.
- Separate root-correct project UX from higher-level multi-root orchestration UX.
- Make an informed scope decision for the OpenSpecUI 6.0 change.

## Constraints

- Use OpenSpec v1.6.0 source, tests, and first-party documentation as truth.
- Keep teaching artifacts inside `target-openspec-cli-16-line/wayfinder/`.
- Do not turn exploratory product boundaries into formal change artifacts prematurely.

## Out of scope

- Implementing the OpenSpecUI adapter.
- Teaching Git monorepo tooling or package dependency management.
