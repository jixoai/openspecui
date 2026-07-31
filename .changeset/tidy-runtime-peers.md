---
'@openspecui/local-ct2-translator': patch
'@openspecui/local-llama-translator': patch
'@openspecui/server': patch
openspecui: patch
---

Declare CTranslate2 and node-llama-cpp as optional peers instead of install-time dependencies. Local translation runtime admission installs them only when selected.
