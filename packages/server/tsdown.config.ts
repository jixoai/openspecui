import { defineConfig } from 'tsdown'

const bundledPrivateTranslatorPackages = [
  '@openspecui/local-translator',
  '@openspecui/openai-completion-translator',
]

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: false,
  noExternal: [...bundledPrivateTranslatorPackages, 'tsx'],
  external: ['@huggingface/transformers'],
})
