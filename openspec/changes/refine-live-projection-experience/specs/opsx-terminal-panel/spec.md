<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Apply local visual command activity to Terminal controls without rewriting terminal evidence.
2. Preserve command labels, dialog drafts, and explicit user recovery when terminal operations wait or fail.
3. Keep raw terminal streams, CLI output, and logs textual rather than replacing them with decorative lifecycle state.

Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言。"
-->

# Delta for OPSX Terminal Panel

## ADDED Requirements

### Requirement: Local Command Activity Continuity

The Terminal panel and its creation/send dialogs SHALL show pending command activity through local visual feedback and interaction locking while preserving the command label, user draft, and raw terminal evidence.

#### Scenario: Create or Send is pending

- **GIVEN** a user activates Create, Send, history, or terminal configuration work
- **WHEN** the corresponding operation is pending
- **THEN** only that control and its local dialog region SHALL render activity and reject duplicate activation
- **AND** the visible command label SHALL remain the command rather than changing to routine status copy

#### Scenario: Terminal operation fails or completes

- **GIVEN** a local terminal operation settles
- **WHEN** it completes or fails
- **THEN** the UI SHALL remove the pending lock at the correct terminal state transition
- **AND** SHALL retain raw CLI, stream, and error evidence as textual content with actionable recovery where applicable

