/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove every built-in Terminal palette retains WCAG AA neutral-text contrast.
 * 2. Prove the Terminal surface remaps neutral tokens without descendant-wide color enforcement.
 *
 * Owner accessibility direction (2026-07-29): Terminal text must remain legible when its palette differs from the application theme.
 */
import { TERMINAL_THEME_OPTIONS, getTerminalThemeDefinition } from '@/lib/terminal-theme'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const terminalSurfaceCssPath = resolve(process.cwd(), 'src/styles/terminal-surface.css')

function parseHexColor(value: string): [number, number, number] {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Expected a six-digit hex color, received ${value}.`)
  }
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ]
}

function relativeLuminance(value: string): number {
  const [red, green, blue] = parseHexColor(value).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Terminal surface accessibility', () => {
  it('keeps every built-in neutral foreground at WCAG AA contrast', () => {
    for (const option of TERMINAL_THEME_OPTIONS) {
      const palette = getTerminalThemeDefinition(option.value).palette
      expect(
        contrastRatio(palette.foreground, palette.background),
        `${option.label} neutral foreground contrast`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('scopes neutral tokens without flattening descendant semantic colors', () => {
    const css = readFileSync(terminalSurfaceCssPath, 'utf8')

    expect(css).toContain('--foreground: var(--terminal-foreground);')
    expect(css).toContain('--muted-foreground: var(--terminal-foreground);')
    expect(css).not.toMatch(/\.terminal-surface\s+\*/)
    expect(css).not.toContain('!important')
  })
})
