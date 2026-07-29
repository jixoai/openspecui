/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove current README command examples execute through the production yargs registry.
 * 2. Prevent retired App-shell location contracts from returning to current documentation.
 *
 * Owner direction (2026-07-29): "openspecui --web == openspecui serve --web" and current README commands must match production parsing.
 */
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parseCliCommand } from './cli-command.js'

const readCurrentDocumentation = async () => {
  const paths = [
    new URL('../../../README.md', import.meta.url),
    new URL('../../../README-zh.md', import.meta.url),
  ]
  return Promise.all(paths.map((path) => readFile(path, 'utf8')))
}

describe('CLI documentation contract', () => {
  it('keeps every documented project and daemon command on the production parser', async () => {
    const docs = await readCurrentDocumentation()
    const cases = [
      { command: 'openspecui', expected: { kind: 'serve', app: false, web: false, open: true } },
      {
        command: 'openspecui serve ./my-project',
        expected: { kind: 'serve', projectDir: './my-project' },
      },
      { command: 'openspecui --app', expected: { kind: 'serve', app: true, web: false } },
      { command: 'openspecui serve --app', expected: { kind: 'serve', app: true, web: false } },
      { command: 'openspecui --web', expected: { kind: 'serve', app: false, web: true } },
      { command: 'openspecui serve --web', expected: { kind: 'serve', app: false, web: true } },
      {
        command: 'openspecui serve --no-open',
        expected: { kind: 'serve', open: false },
      },
      {
        command: 'openspecui start',
        expected: { kind: 'daemon', action: 'start', requestedHostMode: undefined },
      },
      {
        command: 'openspecui start --web',
        expected: { kind: 'daemon', action: 'start', requestedHostMode: 'web' },
      },
      {
        command: 'openspecui stop',
        expected: { kind: 'daemon', action: 'stop', requestedHostMode: undefined },
      },
      {
        command: 'openspecui restart',
        expected: { kind: 'daemon', action: 'restart', requestedHostMode: undefined },
      },
      {
        command: 'openspecui restart --web',
        expected: { kind: 'daemon', action: 'restart', requestedHostMode: 'web' },
      },
    ] as const

    for (const { command, expected } of cases) {
      expect(
        docs.every((document) => document.includes(command)),
        command
      ).toBe(true)
      await expect(parseCliCommand(command.split(' ').slice(1))).resolves.toMatchObject(expected)
    }
  })

  it('keeps retired App-shell location identifiers out of current README files', async () => {
    const docs = await readCurrentDocumentation()

    for (const document of docs) {
      expect(document).not.toContain('--app=')
      expect(document).not.toContain('appBaseUrl')
    }
  })
})
