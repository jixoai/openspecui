---
"@openspecui/web": patch
---

Add a "Skip version check" escape hatch to the OpenSpec CLI version gate.

When the CLI is detected but its version is outside the supported range
(too low or too high), the blocking dialog now offers a "Skip version check"
button. Clicking it dismisses the gate for the current session so OpenSpecUI
can be used with an out-of-range CLI version as a temporary workaround — for
example, when OpenSpec was just upgraded but OpenSpecUI has not caught up.

This is a session-only override (a refresh re-checks the version) and is not
supported: no compatibility guarantees are made for out-of-range CLI versions.
The CLI must still be detected/available for the skip option to appear.
