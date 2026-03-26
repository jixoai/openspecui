---
'@openspecui/web': patch
---

Fix wide Git commit detail file-tree navigation so observer-driven reveal only runs while the diff stream owns navigation, preventing the left tree from snapping back during manual tree scrolling and adding regression coverage in Storybook and unit tests.
