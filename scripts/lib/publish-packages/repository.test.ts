import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizeRepositoryUrl, preparePublishDirectory, resolveRepositoryUrl } from './repository'

describe('normalizeRepositoryUrl', () => {
  it('normalizes common GitHub remote URL forms', () => {
    expect(normalizeRepositoryUrl('https://github.com/jixoai/openspecui.git')).toBe(
      'https://github.com/jixoai/openspecui'
    )
    expect(normalizeRepositoryUrl('git@github.com:jixoai/openspecui.git')).toBe(
      'https://github.com/jixoai/openspecui'
    )
    expect(normalizeRepositoryUrl('ssh://git@github.com/jixoai/openspecui.git')).toBe(
      'https://github.com/jixoai/openspecui'
    )
  })

  it('returns null for unsupported remotes', () => {
    expect(normalizeRepositoryUrl('https://gitlab.com/jixoai/openspecui.git')).toBeNull()
  })
})

describe('resolveRepositoryUrl', () => {
  it('prefers GitHub Actions environment metadata', () => {
    expect(
      resolveRepositoryUrl(process.cwd(), {
        GITHUB_REPOSITORY: 'jixoai/openspecui',
        GITHUB_SERVER_URL: 'https://github.com',
      })
    ).toBe('https://github.com/jixoai/openspecui')
  })
})

describe('preparePublishDirectory', () => {
  it('stages a temp directory and injects repository metadata when missing', () => {
    const sourceDir = mkdtempSync(join(tmpdir(), 'openspecui-publish-source-'))
    writeFileSync(join(sourceDir, 'package.json'), '{"name":"pkg","repository":null}\n')
    writeFileSync(join(sourceDir, 'payload.txt'), 'hello\n')

    const prepared = preparePublishDirectory(sourceDir, 'https://github.com/jixoai/openspecui')
    const stagedManifest = JSON.parse(readFileSync(join(prepared.dir, 'package.json'), 'utf8')) as {
      repository: { type: string; url: string }
    }

    expect(prepared.dir).not.toBe(sourceDir)
    expect(stagedManifest.repository).toEqual({
      type: 'git',
      url: 'https://github.com/jixoai/openspecui',
    })
    expect(readFileSync(join(prepared.dir, 'payload.txt'), 'utf8')).toBe('hello\n')
    expect(readFileSync(join(sourceDir, 'package.json'), 'utf8')).toContain('"repository":null')

    prepared.cleanup()
    rmSync(sourceDir, { force: true, recursive: true })
  })

  it('reuses the original directory when repository metadata already exists', () => {
    const sourceDir = mkdtempSync(join(tmpdir(), 'openspecui-publish-source-'))
    writeFileSync(
      join(sourceDir, 'package.json'),
      '{"name":"pkg","repository":{"type":"git","url":"https://github.com/jixoai/openspecui"}}\n'
    )

    const prepared = preparePublishDirectory(sourceDir, 'https://github.com/jixoai/openspecui')

    expect(prepared.dir).toBe(sourceDir)
    prepared.cleanup()
    rmSync(sourceDir, { force: true, recursive: true })
  })
})
