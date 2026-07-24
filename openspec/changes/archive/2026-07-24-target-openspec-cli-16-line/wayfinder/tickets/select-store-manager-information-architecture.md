<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Select the Store Manager information architecture that will constrain the environment protocol.

Original request (2026-07-15): "平铺所有功能和信息来验证故事闭环还是有必要的。"
-->

# Select the Store Manager information architecture

Status: closed
Type: prototype

## Question

Which prototype structure, or which deliberate combination of them, should become the App-native Store Manager baseline before the environment protocol is specified?

## Prototype

Evaluate [Store Manager UI prototype](../prototypes/store-manager/README.md):

- `A` prioritizes complete registry scanning and inline diagnostics.
- `B` prioritizes one Store's identity, relationships, doctor results, and destructive boundaries.
- `C` prioritizes project-to-Store Root and Reference relationships before registry mutation.

## Resolution

Use a deliberate composition rather than one variant unchanged:

- `B` Store Inspector is the primary Store Manager interaction.
- `C` Context Matrix is a sibling Context view for project-to-Store Root and Reference relationships.
- `A` Registry Table becomes a wide-screen Inventory view for complete registry scanning.

The inspector owns Store identity, Doctor results, and setup/register/unregister/remove operations. The Context view owns relationship comprehension. Inventory provides density without becoming the only navigation model.
