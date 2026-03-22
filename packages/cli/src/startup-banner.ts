export interface StartupBannerOptions {
  projectDir: string
  version: string
}

const STARTUP_BANNER_TOP = '┌─────────────────────────────────────────────┐'
const STARTUP_BANNER_BOTTOM = '└─────────────────────────────────────────────┘'
const STARTUP_BANNER_INNER_WIDTH = STARTUP_BANNER_TOP.length - 2

function centerBannerText(text: string, width = STARTUP_BANNER_INNER_WIDTH): string {
  if (text.length >= width) return text.slice(0, width)
  const totalPadding = width - text.length
  const leftPadding = Math.floor(totalPadding / 2)
  const rightPadding = totalPadding - leftPadding
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`
}

export function buildStartupBanner({ projectDir, version }: StartupBannerOptions): string {
  return `
${STARTUP_BANNER_TOP}
│${centerBannerText(`OpenSpec UI v${version}`)}│
│   Visual interface for spec-driven dev      │
${STARTUP_BANNER_BOTTOM}

📁 Project: ${projectDir}
`
}
