/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Parse the interactive App admission answer without runtime side effects.
 * 2. Own the exact TTY prompt lifecycle while treating EOF as a safe Direct Web rejection.
 *
 * Original request (2026-07-29): "如果发现没有 app daemon，那么会出现一个 [Y/n] 选项。"
 */
import type { Readable, Writable } from 'node:stream'

export const APP_ADMISSION_PROMPT = 'Start OpenSpecUI App? [Y/n] '

/** Interpret an admission answer; empty input accepts the default while EOF declines. */
export function parseAppAdmissionAnswer(answer: string | null): boolean {
  if (answer === null) return false
  const normalized = answer.trim().toLowerCase()
  return normalized === '' || normalized === 'y' || normalized === 'yes'
}

/** Ask for App admission on an already-verified interactive terminal. */
export async function promptForAppAdmission(options: {
  input: Readable
  output: Writable
}): Promise<boolean> {
  options.output.write(APP_ADMISSION_PROMPT)
  const answer = await new Promise<string | null>((resolve) => {
    let buffer = ''
    let settled = false
    const cleanup = () => {
      options.input.off('data', onData)
      options.input.off('end', onEnd)
      options.input.off('error', onError)
    }
    const settle = (value: string | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString()
      const lineEnd = buffer.search(/[\r\n]/)
      if (lineEnd >= 0) settle(buffer.slice(0, lineEnd))
    }
    const onEnd = () => settle(buffer.length > 0 ? buffer : null)
    const onError = () => settle(null)

    options.input.on('data', onData)
    options.input.once('end', onEnd)
    options.input.once('error', onError)
  })
  return parseAppAdmissionAnswer(answer)
}
