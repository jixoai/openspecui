<!--
Orthogonal intents (created 2026-07-24 Asia/Shanghai):
1. Preserve the independent-review correction to the old tracker.
2. Map every unresolved old obligation to its successor without claiming completion.
3. Define the honest partial-archive boundary.

Original request (2026-07-23): "建议review后，关闭当前的change，将所有问题在一个新开的change中展开，这样上下文更干净。"
Original request (2026-07-24): "旧的change可以archive吗?openspec有相关的标准管理"
-->

# Supersession Ledger

`close-openspec-cli16-delivery-gaps` is the sole successor for delivery correction. This ledger transfers
ownership; it does not turn an unchecked item into completed evidence.

The old tracker was `109/131` before the 2026-07-24 independent product-chain review. That review disproved
three earlier completion claims and reopens `8.12`, `9.4`, and `9.5`; the honest archival state is therefore
`106/131`, with 25 unchecked items. `8.11` remains checked because Server admission does reject every named
surface; the separate defect is browser credential delivery into those protected surfaces.

## Reopened Candidate Claims

| Old item | Why the prior evidence is insufficient | Successor evidence owner |
| --- | --- | --- |
| 8.12 | App can consume a manually supplied fragment, but CLI auto-launch never supplies the resolved gate credential and the iframe never receives it. | New 2.8--2.12; manager 6.7--6.8 |
| 9.4 | Environment Center groups `envUri` but does not show grouped connected-project provenance. | New 3.3--3.4; manager 6.9 |
| 9.5 | `activeTabId` exists, but current authority joins by locator rather than exact tab/generation. | New 3.1, 3.5--3.6; manager 6.9 |

## Unresolved-Item Transfer

| Old item | Successor task/evidence | Archive truth |
| --- | --- | --- |
| 8.6 | New 3.3--3.4 and manager 6.11 | Transferred; unchecked |
| 8.14 | New 2.11--2.12, 3.2--3.5 and manager 6.7--6.9 | Transferred; unchecked |
| 9.1 | New 3.1--3.4 and manager 6.9 | Transferred; unchecked |
| 9.2 | New 3.1, 3.5 and manager 6.9 | Transferred; unchecked |
| 9.3 | New 2.8--2.11 and manager 6.7 | Transferred; unchecked |
| 9.7 | New 3.3--3.4 and manager 6.11 | Transferred; unchecked |
| 9.8 | Manager 6.9 and 6.12 | Owner walkthrough; unchecked |
| 9.9 | New 4.4--4.6 and manager 6.10 | Transferred; unchecked |
| 9.10 | New 4.1--4.7 and manager 6.10 | Transferred; unchecked |
| 9.13 | Manager 6.12 | Owner walkthrough; unchecked |
| 10.8 | New 2.11, 3.5, 4.3--4.6 and 5.5 | Transferred; unchecked |
| 10.9 | Manager 6.7--6.12 | Owner walkthrough; unchecked |
| 10.11 | New 6.3 | Full gate; unchecked |
| 10.14 | New 6.1--6.3 | External regression plus full gate; unchecked |
| 10.15 | New 6.3 | Automated browser gate; unchecked |
| 11.3 | New 6.3--6.5 | Delivery gate; unchecked |
| 11.4 | New 6.6 | Remote PR gate; unchecked |
| 11.5 | New 6.7--6.12 and 7.4 | Corrective completion gate; unchecked |
| 11.6 | New 7.3 | Explicitly superseded: partial archive preserves unresolved tasks |
| 11.7 | New 7.4 | Protected merge; unchecked |
| 11.8 | New 7.4 | Post-merge release decision; unchecked |
| 11.9 | New 7.4 | Conditional release automation; unchecked |

## Partial Archive Boundary

The old loop Change has no `specs/` delta directory. Its artifact graph is complete, but standalone strict
change validation therefore reports `Change must have at least one delta`; creating a retrospective delta
merely to silence that check would falsify its history. OpenSpec 1.6 archive validation checks delta specs
only when they exist, so this known generic-validation result is not a reason to disable archive validation.
After manager confirmation, strictly validate the successor, recheck this old artifact/task status, and
archive the old Change with:

```bash
openspec archive target-openspec-cli-16-line -y --skip-specs
```

The incomplete-task warning and `106/131` state are intentional. The archive closes the active planning
folder only; it does not claim completed walkthroughs, green delivery gates, merge, or release.
