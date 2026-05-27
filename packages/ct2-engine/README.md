# ctranslate2

Native Node.js host package for CTranslate2.

This package is intentionally narrow:

- owns the `.node` binary surface
- exposes a minimal translation API
- does not integrate with OpenSpecUI translation engine selection
- does not download models
- does not own OpenSpecUI-specific engine semantics

The current native host loads a CT2 model directory and translates plain strings through
`Ct2Translator#translateBatch`.

Higher-level translation integration lives in `@openspecui/local-ct2-translator`.

## Supported Native Targets

The published package currently ships native addons for the targets declared in
[`napi.config.json`](./napi.config.json):

- `linux-x64-gnu`
- `win32-x64-msvc`
- `darwin-x64`
- `darwin-arm64`

`index.js` enforces this support matrix before it loads the generated NAPI binding. If a new
target is added, update `napi.config.json` and the release automation together so the published
tarball still contains every declared `ct2.*.node` artifact.

## Smoke Test

Use a local CT2 model directory that contains the required artifacts:

- `config.json`
- `model.bin`
- `shared_vocabulary.json`
- `source.spm`
- `target.spm`

Then run:

```bash
OPENSPECUI_CT2_MODEL_PATH=/path/to/model-dir \
node packages/ct2-engine/scripts/smoke.ts
```

The script prints JSON translation results and is the fastest way to verify that the native addon,
tokenizer loading, and model directory are all working together.
