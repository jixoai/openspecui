---
'openspecui': patch
'@openspecui/server': patch
'@openspecui/local-translator': patch
---

Stop preinstalling the Local-Transformers runtime at startup. The runtime is now installed only when the translation settings panel asks for it, so the default install graph no longer pulls in `@huggingface/transformers` or `onnxruntime-node` unless the user opts into that engine.
