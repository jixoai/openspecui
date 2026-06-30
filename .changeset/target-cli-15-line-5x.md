---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
openspecui: major
---

Target the OpenSpec CLI 1.5.x line with OpenSpecUI 5.x.

OpenSpecUI follows a strict 1:1 major-to-minor version law: one OpenSpecUI
major line targets exactly one OpenSpec CLI minor line (2.x→1.2, 3.x→1.3,
4.x→1.4, 5.x→1.5). This release introduces the 5.x line for OpenSpec CLI 1.5.x.

- OpenSpec CLI `>=1.5.0 <1.6.0` is the current/recommended line.
- OpenSpec CLI `>=1.4.0 <1.5.0` is accepted as legacy-compatible.
- OpenSpec CLI 1.3.x and older are no longer supported (each line
  backward-supports only the previous CLI minor line).

Note: 4.1.0 was published to npm as a transition artifact; 5.0.0 is the
correct line going forward. The Stores panel (beta) and navigation
improvements ship on this line.
