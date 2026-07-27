---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
---

Migrate Dashboard Summary live delivery to a version-2 data-free invalidation
and identity/generation-correlated pull contract.

The Summary subscription no longer publishes business snapshot payloads. The
Server issues an opaque identity, work generation, and cause; the Web adapter
pulls the current Summary and accepts it only when it still matches the active
wake-up. Trends, Git, and Changes retain their existing contracts.
