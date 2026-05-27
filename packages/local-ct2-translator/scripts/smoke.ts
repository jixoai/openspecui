import { createLocalCt2TranslatorFactory } from '../src/index.js'

const modelPath = process.env.OPENSPECUI_CT2_MODEL_PATH
const sourceLanguage = process.env.OPENSPECUI_CT2_SOURCE_LANGUAGE ?? 'en'
const targetLanguage = process.env.OPENSPECUI_CT2_TARGET_LANGUAGE ?? 'zh'
const sourceText = process.env.OPENSPECUI_CT2_SOURCE_TEXT ?? 'Hello world!'
const modelId = process.env.OPENSPECUI_CT2_MODEL_ID ?? 'ooeoeo/opus-mt-en-zh-ct2-float16'

if (!modelPath) {
  throw new Error('OPENSPECUI_CT2_MODEL_PATH is required')
}

async function main() {
  const factory = createLocalCt2TranslatorFactory()
  const translator = await factory.create({
    sourceLanguage,
    targetLanguage,
    model: modelId,
    runtimeConfig: { modelPath },
  })

  try {
    const outputs: Array<{ index: number; output: string }> = []
    for await (const item of translator.batchTranslate([sourceText])) {
      outputs.push(item)
    }
    console.log(JSON.stringify(outputs, null, 2))
  } finally {
    translator.destroy?.()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
