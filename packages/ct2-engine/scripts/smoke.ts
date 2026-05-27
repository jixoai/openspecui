const { Ct2Translator } = require('../index.js')

const modelPath = process.env.OPENSPECUI_CT2_MODEL_PATH

if (!modelPath) {
  throw new Error('OPENSPECUI_CT2_MODEL_PATH is required')
}

const translator = new Ct2Translator({
  modelPath,
})

async function main() {
  const results = await translator.translateBatch(['Hello world!'], {
    returnScores: true,
  })

  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
