/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Prove `--base-path` reaches markup attributes and Vite-emitted module asset literals
 *    (issue #319 #2).
 * 2. Prove the rewrite is bounded: snapshot text that merely mentions `/assets/` is untouched,
 *    and base "/" changes nothing.
 *
 * Original request (2026-11-04): "同时，处理一下#319"
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyBasePathToOutputTree,
  normalizeBasePath,
  rewriteAssetModule,
  rewriteMarkupReferences,
} from './base-path-rewrite'

const temporaryDirs: string[] = []

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'openspecui-basepath-'))
  temporaryDirs.push(root)
  mkdirSync(join(root, 'assets'), { recursive: true })
  writeFileSync(
    join(root, 'assets/index-abc.js'),
    'const w=new URL("/assets/font.woff2",import.meta.url);import("/assets/chunk-def.js");'
  )
  writeFileSync(join(root, 'assets/index-abc.css'), 'body{font-family:url(/assets/font.woff2)}')
  writeFileSync(join(root, 'index.html'), '<script src="/assets/index-abc.js"></script>')
  return root
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('base path normalization', () => {
  it.each([
    ['/', null],
    ['', null],
    ['./', null],
    ['/docs/', '/docs/'],
    ['docs', '/docs/'],
    ['/pages/my-org/my-repo/', '/pages/my-org/my-repo/'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected)
  })
})

describe('markup reference rewriting', () => {
  it('prefixes every root-absolute src/href attribute', () => {
    const markup =
      '<link rel="stylesheet" href="/assets/a.css"><script src="/assets/a.js"></script><a href="/specs">x</a>'

    const rewritten = rewriteMarkupReferences(markup, '/docs/')

    expect(rewritten).toContain('href="/docs/assets/a.css"')
    expect(rewritten).toContain('src="/docs/assets/a.js"')
    expect(rewritten).toContain('href="/docs/specs"')
  })

  it('leaves protocol-relative and absolute URLs alone', () => {
    const markup = '<script src="//cdn.example/a.js"></script><a href="https://x.test/y">x</a>'

    expect(rewriteMarkupReferences(markup, '/docs/')).toBe(markup)
  })

  // Bounded rewrite: the snapshot reaches the document through `headTags`, which this function
  // never sees, so a spec body mentioning an asset path cannot be mutated.
  it('does not touch text-node occurrences of an asset path', () => {
    const markup = '<pre>see /assets/foo.js for details</pre>'

    expect(rewriteMarkupReferences(markup, '/docs/')).toBe(markup)
  })

  it('is a no-op at the root base path', () => {
    const markup = '<script src="/assets/a.js"></script>'
    expect(rewriteMarkupReferences(markup, '/')).toBe(markup)
  })
})

describe('emitted module asset rewriting', () => {
  it('prefixes chunk imports, import.meta.url asset URLs and CSS url() declarations', () => {
    expect(rewriteAssetModule('new URL("/assets/f.woff2",import.meta.url)', '/docs/')).toBe(
      'new URL("/docs/assets/f.woff2",import.meta.url)'
    )
    expect(rewriteAssetModule('import("/assets/c.js")', '/docs/')).toBe(
      'import("/docs/assets/c.js")'
    )
    expect(rewriteAssetModule('url(/assets/f.woff2)', '/docs/')).toBe('url(/docs/assets/f.woff2)')
  })

  it('is a no-op at the root base path', () => {
    expect(rewriteAssetModule('import("/assets/c.js")', '/')).toBe('import("/assets/c.js")')
  })
})

describe('output tree rewriting', () => {
  it('rewrites module files under the emitted tree and reports how many changed', () => {
    const root = makeTree()

    expect(applyBasePathToOutputTree(root, '/docs/')).toBe(2)

    expect(readFileSync(join(root, 'assets/index-abc.js'), 'utf-8')).toContain(
      '/docs/assets/font.woff2'
    )
    expect(readFileSync(join(root, 'assets/index-abc.css'), 'utf-8')).toContain(
      'url(/docs/assets/font.woff2)'
    )
  })

  it('does nothing at the root base path', () => {
    const root = makeTree()
    expect(applyBasePathToOutputTree(root, '/')).toBe(0)
    expect(readFileSync(join(root, 'assets/index-abc.js'), 'utf-8')).toContain(
      '"/assets/font.woff2"'
    )
  })
})
