/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Lock command argv for root-aware workflow and Reference reads.
 * 2. Lock official Store mutation argv without registry synthesis.
 * 3. Lock strict Archive mutation and Archive Instructions JSON argv.
 * 4. Lock schema and template JSON reads to checked command contracts.
 *
 * Original request (2026-07-15): "坚持 CLI-first。"
 */
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { CliExecutor, type CliResult } from './cli-executor.js'
import { ConfigManager } from './config.js'

const EMPTY_JSON_RESULT: CliResult = {
  success: true,
  stdout: '{}',
  stderr: '',
  exitCode: 0,
}

describe('CliExecutor OpenSpec 1.6 contracts', () => {
  let executor: CliExecutor
  let execute: MockInstance<CliExecutor['execute']>

  beforeEach(() => {
    executor = new CliExecutor(new ConfigManager('/project'), '/project')
    execute = vi.spyOn(executor, 'execute').mockResolvedValue(EMPTY_JSON_RESULT)
  })

  it('builds nearest and explicit-Store root-aware read commands', async () => {
    await executor.contracts.listChanges()
    await executor.contracts.listSpecs({ store: 'shared' })
    await executor.contracts.showSpec('auth', { store: 'shared' })
    await executor.contracts.doctorRoot()
    await executor.contracts.context({ store: 'shared' })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['list', '--json'],
      ['list', '--specs', '--json', '--store', 'shared'],
      ['show', 'auth', '--type', 'spec', '--json', '--store', 'shared'],
      ['doctor', '--json'],
      ['context', '--json', '--store', 'shared'],
    ])
  })

  it('preserves explicitly present empty Store and optional string arguments for CLI diagnostics', async () => {
    await executor.contracts.listSpecs({ store: '' })
    await executor.contracts.workflowStatus('add-auth', { store: '', schema: '' })
    await executor.contracts.doctorStores('')
    await executor.contracts.setupStore('shared', { path: '/stores/shared', remote: '' })
    await executor.contracts.registerStore('/stores/existing', { id: '' })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['list', '--specs', '--json', '--store', ''],
      ['status', '--change', 'add-auth', '--json', '--schema', '', '--store', ''],
      ['store', 'doctor', '', '--json'],
      ['store', 'setup', 'shared', '--path', '/stores/shared', '--remote', '', '--json'],
      ['store', 'register', '/stores/existing', '--id', '', '--json'],
    ])
  })

  it('builds workflow commands with CLI-resolved path and Reference payloads', async () => {
    await executor.contracts.workflowStatus('add-auth', { store: 'shared', schema: 'custom' })
    await executor.contracts.artifactInstructions('add-auth', 'proposal', { store: 'shared' })
    await executor.contracts.applyInstructions('add-auth', { store: 'shared' })
    await executor.contracts.archiveInstructions('add-auth', { store: 'shared' })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['status', '--change', 'add-auth', '--json', '--schema', 'custom', '--store', 'shared'],
      ['instructions', 'proposal', '--change', 'add-auth', '--json', '--store', 'shared'],
      ['instructions', 'apply', '--change', 'add-auth', '--json', '--store', 'shared'],
      ['instructions', 'archive', '--change', 'add-auth', '--json', '--store', 'shared'],
    ])
  })

  it('builds checked Schema and Template JSON commands', async () => {
    await executor.contracts.schemas()
    await executor.contracts.schemaWhich('custom')
    await executor.contracts.templates()
    await executor.contracts.templates('custom')

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['schemas', '--json'],
      ['schema', 'which', 'custom', '--json'],
      ['templates', '--json'],
      ['templates', '--json', '--schema', 'custom'],
    ])
  })

  it('builds every Store inspection and mutation command', async () => {
    await executor.contracts.listStores()
    await executor.contracts.doctorStores('shared')
    await executor.contracts.setupStore('shared', {
      path: '/stores/shared',
      initGit: false,
      remote: 'https://example.test/shared.git',
    })
    await executor.contracts.registerStore('/stores/existing', {
      id: 'existing',
      confirmIdentity: true,
    })
    await executor.contracts.unregisterStore('existing')
    await executor.contracts.removeStore('shared', { confirmDelete: true })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['store', 'list', '--json'],
      ['store', 'doctor', 'shared', '--json'],
      [
        'store',
        'setup',
        'shared',
        '--path',
        '/stores/shared',
        '--no-init-git',
        '--remote',
        'https://example.test/shared.git',
        '--json',
      ],
      ['store', 'register', '/stores/existing', '--id', 'existing', '--yes', '--json'],
      ['store', 'unregister', 'existing', '--json'],
      ['store', 'remove', 'shared', '--yes', '--json'],
    ])
  })

  it('builds strict validate, archived validate, and archive commands without implicit retry', async () => {
    await executor.contracts.validate({
      target: { kind: 'item', id: 'add-auth', type: 'change' },
      strict: true,
      store: 'shared',
    })
    await executor.contracts.validate({ target: { kind: 'scope', scope: 'all' } })
    await executor.contracts.validate({ target: { kind: 'archived' }, store: 'shared' })
    await executor.contracts.archive('add-auth', { store: 'shared', skipSpecs: true })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['validate', 'add-auth', '--type', 'change', '--strict', '--json', '--store', 'shared'],
      ['validate', '--all', '--json'],
      ['validate', '--archived', '--json', '--store', 'shared'],
      ['archive', 'add-auth', '--json', '--yes', '--skip-specs', '--store', 'shared'],
    ])
    expect(execute).toHaveBeenCalledTimes(4)
  })

  it('adds --no-validate only for an explicit archive request', async () => {
    await executor.contracts.archive('add-auth')
    await executor.contracts.archive('add-auth', { noValidate: true })

    expect(execute.mock.calls.map(([args]) => args)).toEqual([
      ['archive', 'add-auth', '--json', '--yes'],
      ['archive', 'add-auth', '--json', '--yes', '--no-validate'],
    ])
  })
})
