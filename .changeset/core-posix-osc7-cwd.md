---
'@openspecui/core': patch
---

Resolve OSC 7 working-directory metadata on POSIX for host-qualified file URLs: `fileURLToPath` rejects non-local hostnames there, so the informational host is stripped before resolving the pathname, while Windows keeps mapping the hostname to a UNC path.
