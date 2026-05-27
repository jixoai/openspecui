declare module 'ctranslate2' {
  export class Ct2Translator {
    constructor(options: Ct2TranslatorOptions)
    translateBatch(
      source: string[],
      options?: TranslateBatchOptions | undefined | null
    ): Promise<TranslationResult[]>
  }

  export interface Ct2TranslatorOptions {
    modelPath: string
    device?: string
    threads?: number
  }

  export interface TranslateBatchOptions {
    beamSize?: number
    maxBatchSize?: number
    returnScores?: boolean
  }

  export interface TranslationResult {
    text: string
    score?: number
  }
}
