<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Explain the throwaway Store Manager prototype question and launch path.
2. Keep prototype behavior explicitly separate from production implementation.

Original request (2026-07-15): "Store Manager的存在才能使得整个产品故事形成闭环，所以我仍然需要看到一个初版的 Store Manager。"
-->

# Store Manager UI prototype

Question: Which App-native information architecture makes environment-scoped Store management understandable while keeping all upstream operations visible?

This throwaway prototype provides three variants on one page:

- `A` - Registry table: inventory-first, with diagnostics below.
- `B` - Store inspector: selection-first master/detail workflow.
- `C` - Context matrix: project-to-Store relationships first.

Open `index.html` directly, or choose a variant with `?variant=A`, `?variant=B`, or `?variant=C`. The floating switcher and left/right arrow keys change variants.

```bash
open openspec/changes/target-openspec-cli-16-line/wayfinder/prototypes/store-manager/index.html
```

All setup, register, doctor, unregister, and remove actions are simulated in memory. Reloading resets the prototype. No OpenSpec CLI command or filesystem mutation occurs.

## Selected direction

- `B` becomes the primary Store Inspector.
- `C` becomes a sibling Context view.
- `A` becomes the wide-screen Inventory view.

The production design should compose these responsibilities rather than promote one prototype variant unchanged.
