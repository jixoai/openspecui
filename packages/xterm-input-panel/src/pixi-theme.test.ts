import { describe, it, expect } from 'vitest'
import { resolvePixiTheme, cssColorToHex, blendHex } from './pixi-theme.js'

describe('pixi-theme', () => {
  describe('resolvePixiTheme', () => {
    it('returns a PixiTheme with all number fields', () => {
      const theme = resolvePixiTheme()

      expect(typeof theme.background).toBe('number')
      expect(typeof theme.surface).toBe('number')
      expect(typeof theme.surfaceBorder).toBe('number')
      expect(typeof theme.keyNormal).toBe('number')
      expect(typeof theme.keyModifier).toBe('number')
      expect(typeof theme.keyPressed).toBe('number')
      expect(typeof theme.text).toBe('number')
      expect(typeof theme.textMuted).toBe('number')
      expect(typeof theme.accent).toBe('number')
      expect(typeof theme.accentFg).toBe('number')
      expect(typeof theme.feedbackColor).toBe('number')
      expect(typeof theme.hintText).toBe('number')
    })
  })

  describe('cssColorToHex', () => {
    it('converts hex color strings', () => {
      expect(cssColorToHex('#ff0000')).toBe(0xff0000)
    })

    it('converts named colors', () => {
      expect(cssColorToHex('red')).toBe(0xff0000)
    })

    it('returns null for empty strings', () => {
      expect(cssColorToHex('')).toBeNull()
    })
  })

  describe('blendHex', () => {
    it('returns first color at t=0', () => {
      expect(blendHex(0x000000, 0xffffff, 0)).toBe(0x000000)
    })

    it('returns second color at t=1', () => {
      expect(blendHex(0x000000, 0xffffff, 1)).toBe(0xffffff)
    })

    it('returns midpoint at t=0.5', () => {
      const result = blendHex(0x000000, 0xffffff, 0.5)
      // Each channel should be ~128 (0x80)
      const r = (result >> 16) & 0xff
      const g = (result >> 8) & 0xff
      const b = result & 0xff
      expect(r).toBe(128)
      expect(g).toBe(128)
      expect(b).toBe(128)
    })
  })
})
