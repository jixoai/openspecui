---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
---

Migrate Dashboard Summary live delivery to a version-2 data-free invalidation
and identity/generation-correlated retained/current pull contract, and unify
Web realtime loading, revalidation, and command-activity presentation.

The Summary subscription no longer publishes business snapshot payloads. The
Server issues an opaque identity, work generation, and cause; the Web adapter
pulls the retained or current Summary and accepts it only when it still matches
the active wake-up. Fresh browser Documents can render bounded Server-retained
data as display-only while matching current work converges. Web routes retain
readable content during revalidation, use stable local skeleton geometry for
first loads, and preserve command labels while actions are pending. Trends,
Git, and Changes retain their existing transport contracts.

Live Project Web now settles protected health admission before importing its
ordinary transports, while clean static export resolves the hashed SSG server
entry through Vite's manifest. Authentication rejection becomes an explicit
terminal document instead of an indefinite loading/retry loop.

Effective OpenSpec data-home observation now settles initially missing Store,
Workset, and Schema targets from bounded ancestor creation events without
introducing generic missing-path polling.
