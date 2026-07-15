<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Decide App versus project-workspace ownership.
2. Decide whether Store Manager is required in the 6.0 release boundary.

Original request (2026-07-15): "我个人的想法，是把 --app 模式提上日程。"
-->

# Set the App and project surface boundary

Status: closed
Type: grilling

## Question

Does OpenSpecUI 6.0 include App-native Store mutation, or does 6.0 establish the App Home and environment protocol while Store Manager follows as a subsequent 6.x slice?

## Resolution

Store Manager is not a 6.0 release gate while `--app` remains explicitly experimental, but a complete throwaway prototype is required to validate the product-story closure before formal specs converge.

The production surface belongs in `packages/app`. It does not justify a new package until a stable environment/Store protocol module has multiple real consumers, and it does not belong in the single-project `packages/web`.

The full page-level decision is recorded in [App and project surface adaptation](../research/app-project-surface-adaptation.md). The three-variant validation asset is [Store Manager UI prototype](../prototypes/store-manager/README.md).
