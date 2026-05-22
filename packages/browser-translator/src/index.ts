import type {
  Translator,
  TranslatorCreateMonitor,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
} from '@openspecui/core/translator'

export type BrowserTranslationAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'missing'
  | 'error'

export interface BrowserTranslationStatus {
  availability: BrowserTranslationAvailability
  progress?: number
  message?: string
}

interface NativeTranslator {
  translate(input: string, options?: { signal?: AbortSignal }): Promise<string>
  destroy?: () => void
}

interface NativeTranslatorFactory {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
    signal?: AbortSignal
  }): Promise<NativeTranslator>
}

interface WindowWithTranslator extends Window {
  Translator?: NativeTranslatorFactory
}

const DEFAULT_SOURCE_LANGUAGE = 'en'

export function isBrowserTranslatorSupported(win: Window = window): boolean {
  return !!(win as WindowWithTranslator).Translator
}

export async function probeBrowserTranslator(
  targetLanguage: string,
  sourceLanguage = DEFAULT_SOURCE_LANGUAGE,
  win: Window = window
): Promise<BrowserTranslationStatus> {
  const translator = (win as WindowWithTranslator).Translator
  if (!translator) {
    return { availability: 'missing', message: 'Browser Translator API is not exposed.' }
  }

  try {
    const availability = await translator.availability({ sourceLanguage, targetLanguage })
    return { availability: normalizeAvailability(availability) }
  } catch (error) {
    return { availability: 'error', message: getErrorMessage(error) }
  }
}

export class BrowserTranslatorFactory implements TranslatorFactory {
  constructor(private readonly win: Window = window) {}

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    const factory = (this.win as WindowWithTranslator).Translator
    if (!factory) {
      throw new Error('Browser Translator API is not exposed.')
    }

    const native = await raceAbort(
      factory.create({
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
        signal: options.signal,
        monitor: (monitor) => monitorDownload(monitor, options.monitor),
      }),
      options.signal
    )

    return {
      async *batchTranslate(
        inputs: string[],
        batchOptions?: { signal?: AbortSignal }
      ): AsyncGenerator<{ index: number; output: string }> {
        for (const [index, input] of inputs.entries()) {
          const output = await native.translate(input, batchOptions)
          yield { index, output }
        }
      },
      destroy() {
        native.destroy?.()
      },
    }
  }
}

export function createBrowserTranslatorFactory(win: Window = window): BrowserTranslatorFactory {
  return new BrowserTranslatorFactory(win)
}

function normalizeAvailability(value: string): BrowserTranslationAvailability {
  if (
    value === 'available' ||
    value === 'downloadable' ||
    value === 'downloading' ||
    value === 'unavailable'
  ) {
    return value
  }
  return 'error'
}

function monitorDownload(monitor: EventTarget, target?: TranslatorCreateMonitor): void {
  target?.setStatus({ message: 'Preparing browser translation support.' })
  monitor.addEventListener('downloadprogress', (event) => {
    const progress = readProgress(event)
    target?.setStatus({
      message:
        progress === undefined
          ? 'Downloading browser translation support.'
          : `Downloading browser translation support ${Math.round(progress * 100)}%.`,
      ...(progress === undefined ? {} : { progress }),
    })
  })
}

function readProgress(event: Event): number | undefined {
  const value = (event as { loaded?: unknown; total?: unknown }).loaded
  const total = (event as { loaded?: unknown; total?: unknown }).total
  if (typeof value === 'number' && typeof total === 'number' && total > 0) {
    return Math.max(0, Math.min(1, value / total))
  }
  const progress = (event as { progress?: unknown }).progress
  return typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : undefined
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
