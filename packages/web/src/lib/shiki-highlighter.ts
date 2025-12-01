import {
  getSingletonHighlighter,
  type BundledTheme,
  type Highlighter,
  type StringLiteralUnion,
} from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null
let cachedHighlighter: Highlighter | null = null

const themes: StringLiteralUnion<BundledTheme, string>[] = [
  'github-light-default',
  'github-dark-default',
]
const langs = [
  'javascript',
  'typescript',
  'json',
  'yaml',
  'markdown',
  'tsx',
  'jsx',
  'bash',
  'shell',
]

export async function loadShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      themes,
      langs,
    }).then(
      (hl) => {
        cachedHighlighter = hl
        return hl
      },
      (err) => {
        throw err
      }
    )
  }
  return highlighterPromise
}

export function getShikiHighlighterSync(): Highlighter | null {
  return cachedHighlighter
}
