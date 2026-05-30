import type {
  BatchTranslationResult,
  Translator,
  TranslatorCreateMonitor,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
} from '@openspecui/core/translator'
import { runControlledTranslationTask } from '@openspecui/core/translator'

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

export interface BrowserTranslationAvailabilityRow {
  sourceLanguage: string
  targetLanguage: string
  availability: BrowserTranslationAvailability
  progress?: number
  message?: string
}

export interface BrowserTranslationSupportTable {
  targetLanguage: string
  checked: number
  total: number
  updatedAt: number
  rows: BrowserTranslationAvailabilityRow[]
}

export interface BrowserTranslationPrepareOptions {
  sourceLanguage?: string
  signal: AbortSignal
  onStatus?: (status: BrowserTranslationStatus) => void
  win?: Window
}

export interface BrowserTranslationSupportScanOptions {
  sourceLanguages: readonly string[]
  targetLanguage: string
  signal: AbortSignal
  win?: Window
  onRow?: (row: BrowserTranslationAvailabilityRow) => void
  onProgress?: (input: { checked: number; total: number }) => void
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

export async function scanBrowserTranslationSupportTable(
  options: BrowserTranslationSupportScanOptions
): Promise<BrowserTranslationSupportTable> {
  const win = options.win ?? window
  const translator = (win as WindowWithTranslator).Translator
  if (!translator) {
    return {
      targetLanguage: options.targetLanguage,
      checked: 0,
      total: options.sourceLanguages.length,
      updatedAt: Date.now(),
      rows: [],
    }
  }

  const rows: BrowserTranslationAvailabilityRow[] = []
  let checked = 0
  const total = options.sourceLanguages.length

  for (const sourceLanguage of options.sourceLanguages) {
    if (options.signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    if (sourceLanguage === options.targetLanguage) {
      checked += 1
      options.onProgress?.({ checked, total })
      continue
    }
    let row: BrowserTranslationAvailabilityRow
    try {
      const availability = await translator.availability({
        sourceLanguage,
        targetLanguage: options.targetLanguage,
      })
      row = {
        sourceLanguage,
        targetLanguage: options.targetLanguage,
        availability: normalizeAvailability(availability),
      }
    } catch (error) {
      row = {
        sourceLanguage,
        targetLanguage: options.targetLanguage,
        availability: 'error',
        message: getErrorMessage(error),
      }
    }
    checked += 1
    if (row.availability !== 'unavailable') rows.push(row)
    options.onRow?.(row)
    options.onProgress?.({ checked, total })
  }

  return {
    targetLanguage: options.targetLanguage,
    checked,
    total,
    updatedAt: Date.now(),
    rows,
  }
}

export async function prepareBrowserTranslator(
  targetLanguage: string,
  options: BrowserTranslationPrepareOptions
): Promise<BrowserTranslationStatus> {
  const sourceLanguage = options.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE
  const win = options.win ?? window
  const translator = (win as WindowWithTranslator).Translator
  if (!translator) {
    return { availability: 'missing', message: 'Browser Translator API is not exposed.' }
  }

  try {
    const initialStatus = await probeBrowserTranslator(targetLanguage, sourceLanguage, win)
    if (
      initialStatus.availability === 'missing' ||
      initialStatus.availability === 'unavailable' ||
      initialStatus.availability === 'error'
    ) {
      options.onStatus?.(initialStatus)
      return initialStatus
    }
    if (initialStatus.availability === 'available') {
      options.onStatus?.(initialStatus)
      return initialStatus
    }

    options.onStatus?.({
      availability: 'downloading',
      message: 'Downloading browser translation support.',
    })

    const native = await raceAbort(
      translator.create({
        sourceLanguage,
        targetLanguage,
        signal: options.signal,
        monitor: (monitor) =>
          monitorDownload(monitor, {
            setStatus(input) {
              options.onStatus?.({
                availability: 'downloading',
                progress: input.progress,
                message: input.message,
              })
            },
          }),
      }),
      options.signal
    )
    native.destroy?.()

    const finalStatus = {
      availability: 'available' as const,
      message: 'Browser translator is ready.',
    }
    options.onStatus?.(finalStatus)
    return finalStatus
  } catch (error) {
    if (options.signal.aborted) {
      const cancelledStatus = {
        availability: 'downloadable' as const,
        message: 'Browser translation download was cancelled.',
      }
      options.onStatus?.(cancelledStatus)
      return cancelledStatus
    }
    const failureStatus = { availability: 'error' as const, message: getErrorMessage(error) }
    options.onStatus?.(failureStatus)
    return failureStatus
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
        batchOptions?: { signal?: AbortSignal; timeoutMs?: number }
      ): AsyncGenerator<BatchTranslationResult> {
        for (const [index, input] of inputs.entries()) {
          const controlled = await runControlledTranslationTask(
            (signal) => native.translate(input, { signal }),
            batchOptions
          )
          if (controlled.ok) {
            yield { index, output: controlled.value }
            continue
          }
          yield { index, error: controlled.error }
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
