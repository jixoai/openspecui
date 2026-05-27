# @openspecui/local-ct2-translator

OpenSpecUI adapter for the `local-ct2` translation engine.

This package sits between:

- `ctranslate2`: the native Node.js host package
- OpenSpecUI translation contracts: model planning, runtime preparation, and `TranslatorFactory`

## Scope

`@openspecui/local-ct2-translator` owns:

- CT2 model download-plan resolution from Hugging Face repository files
- OpenSpecUI `TranslatorFactory` integration for `local-ct2`
- runtime config parsing for CT2 model directories

It does not own:

- native addon compilation or `.node` distribution
- model downloading UI or server-side asset lifecycle orchestration
- OpenSpecUI settings panel composition

Those responsibilities stay in `ctranslate2`, `@openspecui/server`, and `@openspecui/web`.

## Required CT2 Artifacts

Current `opus-mt` CT2 repos are considered runnable when a concrete group contains:

- `config.json`
- `model.bin`
- `shared_vocabulary.json`
- `source.spm`
- `target.spm`

Optional files such as `tokenizer_config.json` and `vocab.json` are preserved in the plan when present, but they do not block first-pass usability.

## Smoke Test

Use a prepared CT2 model directory and run:

```bash
OPENSPECUI_CT2_MODEL_PATH=/path/to/model-dir \
pnpm --filter @openspecui/local-ct2-translator smoke
```

Optional environment variables:

- `OPENSPECUI_CT2_MODEL_ID`
- `OPENSPECUI_CT2_SOURCE_LANGUAGE`
- `OPENSPECUI_CT2_TARGET_LANGUAGE`
- `OPENSPECUI_CT2_SOURCE_TEXT`

The smoke script creates a `LocalCt2TranslatorFactory`, points it at the provided model directory, and prints the translation output as JSON.

## Package Boundary

- `@openspecui/server` depends directly on this package.
- `ctranslate2` stays as the runtime-native dependency.
- the final `openspecui` CLI installs `ctranslate2` dynamically as an optional runtime dependency.
