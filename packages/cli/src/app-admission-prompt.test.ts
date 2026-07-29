/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove default, affirmative, negative, and EOF App admission semantics.
 * 2. Prove the production prompt writes the approved operator question.
 *
 * Original request (2026-07-29): "如果发现没有 app daemon，那么会出现一个 [Y/n] 选项。"
 */
import { Readable, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  APP_ADMISSION_PROMPT,
  parseAppAdmissionAnswer,
  promptForAppAdmission,
} from './app-admission-prompt.js'

describe('App admission prompt', () => {
  it.each([
    { answer: '', accepted: true },
    { answer: 'y', accepted: true },
    { answer: 'YES', accepted: true },
    { answer: 'n', accepted: false },
    { answer: 'anything else', accepted: false },
    { answer: null, accepted: false },
  ])('maps $answer to accepted=$accepted', ({ answer, accepted }) => {
    expect(parseAppAdmissionAnswer(answer)).toBe(accepted)
  })

  it('writes the exact prompt and accepts the default newline', async () => {
    let output = ''
    const accepted = await promptForAppAdmission({
      input: Readable.from(['\n']),
      output: new Writable({
        write(chunk, _encoding, callback) {
          output += String(chunk)
          callback()
        },
      }),
    })

    expect(accepted).toBe(true)
    expect(output).toContain(APP_ADMISSION_PROMPT)
  })

  it('treats EOF as rejection', async () => {
    const accepted = await promptForAppAdmission({
      input: Readable.from([]),
      output: new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      }),
    })

    expect(accepted).toBe(false)
  })
})
