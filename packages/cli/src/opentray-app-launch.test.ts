/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove source cold launch retains only its TypeScript loader, restores development conditions, and targets public daemon start.
 * 2. Prove packaged cold launch strips transient Node flags and targets the installed CLI entry.
 * 3. Reject relative launch authority before it reaches OpenTray persistence.
 *
 * Owner correction (2026-07-30): appMode must follow the complete skill-creator-v2/OpenTray lifecycle contract.
 */
import { describe, expect, it } from 'vitest'
import { resolveOpenTrayAppLaunch } from './opentray-app-launch.js'

describe('OpenTray App cold-launch vector', () => {
  it('retains the source loader and invokes the public start lifecycle', () => {
    expect(
      resolveOpenTrayAppLaunch({
        execPath: '/runtime/node',
        execArgv: [
          '--inspect=9230',
          '--require',
          '/repo/node_modules/tsx/dist/preflight.cjs',
          '--import',
          'file:///repo/node_modules/tsx/dist/loader.mjs',
          '--eval',
          'transient()',
        ],
        entryPath: '/repo/packages/cli/src/cli.ts',
        runtimeDir: '/repo/packages/cli/src',
      })
    ).toEqual({
      command: '/runtime/node',
      args: [
        '--conditions=development',
        '--require',
        '/repo/node_modules/tsx/dist/preflight.cjs',
        '--import',
        'file:///repo/node_modules/tsx/dist/loader.mjs',
        '/repo/packages/cli/src/cli.ts',
        'start',
      ],
      cwd: '/repo/packages/cli',
    })
  })

  it('uses the packaged CLI entry without transient process flags', () => {
    expect(
      resolveOpenTrayAppLaunch({
        execPath: '/runtime/node',
        execArgv: ['--inspect=9230'],
        entryPath: '/install/node_modules/openspecui/dist/cli.mjs',
        runtimeDir: '/install/node_modules/openspecui/dist',
      })
    ).toEqual({
      command: '/runtime/node',
      args: ['/install/node_modules/openspecui/dist/cli.mjs', 'start'],
      cwd: '/install/node_modules/openspecui',
    })
  })

  it('rejects relative process authority', () => {
    expect(() =>
      resolveOpenTrayAppLaunch({
        execPath: 'node',
        execArgv: [],
        entryPath: './src/cli.ts',
        runtimeDir: '/repo/packages/cli/src',
      })
    ).toThrow('OpenTray App launch requires absolute executable and CLI entry paths.')
  })
})
