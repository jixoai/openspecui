---
'openspecui': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Keep the CT2 model download card in a loading state while artifact profiles are still resolving, ignore malformed translation segments before rendering translated Markdown, and surface unsupported local-llama GGUF groups as explicit runtime compatibility failures before translation starts.
