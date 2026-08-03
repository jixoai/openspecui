---
'openspecui': minor
---

Replace the single-source generated App icon with hand-designed light/dark variant assets. Darwin and Windows now project two AppIcon entries (`variant: ['default','light']` plus `variant: 'dark'`) from committed `resources/app-icon/`, generated from the designed 1024² PNGs via `scripts/build-native-icons.ts`. Windows uses the light variant. Linux keeps the implicit default PNG sizes.
