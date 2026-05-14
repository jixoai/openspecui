import { describe, expect, it } from 'vitest'
import { BUILTIN_SOUND_OPTIONS, getBuiltinSoundUrl } from './sounds.js'

describe('builtin sound assets', () => {
  it('uses browser-playable wav assets for every builtin sound', () => {
    expect(BUILTIN_SOUND_OPTIONS).not.toHaveLength(0)
    for (const option of BUILTIN_SOUND_OPTIONS) {
      expect(option.filename).toMatch(/\.wav$/)
      expect(option.mime).toBe('audio/wav')
      expect(getBuiltinSoundUrl(option.id)).toBe(`/sounds/${option.filename}`)
    }
  })
})
