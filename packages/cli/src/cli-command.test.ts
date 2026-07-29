/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove the production yargs registry emits the approved serve and daemon command plans.
 * 2. Prove retired App URL and conflicting presentation syntax is rejected.
 *
 * Original request (2026-07-29): "openspecui --web == openspecui serve --web。"
 */
import { describe, expect, it } from 'vitest'
import { parseCliCommand } from './cli-command.js'

describe('production CLI command registry', () => {
  it('maps bare and explicit serve commands to the same project plan', async () => {
    const bare = await parseCliCommand(['project-a', '--port', '3200', '--no-open'])
    const explicit = await parseCliCommand(['serve', 'project-a', '--port', '3200', '--no-open'])

    expect(bare).toEqual(explicit)
    expect(explicit).toMatchObject({
      kind: 'serve',
      projectDir: 'project-a',
      port: 3200,
      open: false,
    })
  })

  it('maps bare presentation flags through serve', async () => {
    await expect(parseCliCommand(['--app'])).resolves.toMatchObject({
      kind: 'serve',
      app: true,
      web: false,
    })
    await expect(parseCliCommand(['--web'])).resolves.toMatchObject({
      kind: 'serve',
      app: false,
      web: true,
    })
  })

  it('keeps start, stop, and restart daemon-only', async () => {
    await expect(parseCliCommand(['start'])).resolves.toEqual({
      kind: 'daemon',
      action: 'start',
      requestedHostMode: undefined,
    })
    await expect(parseCliCommand(['start', '--web'])).resolves.toEqual({
      kind: 'daemon',
      action: 'start',
      requestedHostMode: 'web',
    })
    await expect(parseCliCommand(['stop'])).resolves.toEqual({
      kind: 'daemon',
      action: 'stop',
      requestedHostMode: undefined,
    })
    await expect(parseCliCommand(['restart', '--web'])).resolves.toEqual({
      kind: 'daemon',
      action: 'restart',
      requestedHostMode: 'web',
    })
  })

  it('rejects project arguments and backend flags on daemon commands', async () => {
    await expect(parseCliCommand(['start', 'project-a'])).rejects.toThrow()
    await expect(parseCliCommand(['restart', '--port', '3200'])).rejects.toThrow()
  })

  it('rejects conflicting and retired App URL syntax', async () => {
    await expect(parseCliCommand(['serve', '--app', '--web'])).rejects.toThrow()
    await expect(parseCliCommand(['serve', '--app=https://custom.example'])).rejects.toThrow()
    await expect(parseCliCommand(['serve', '--auth', '--password=secret'])).rejects.toThrow()
  })
})
