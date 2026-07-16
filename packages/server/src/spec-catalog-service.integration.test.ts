/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Execute pinned OpenSpec 1.6 Doctor, Reference list, and referenced show contracts.
 * 2. Carry real CLI evidence through the production Spec Catalog and detail projection.
 * 3. Prove exact Store provenance survives the complete Reference path.
 *
 * Original request (2026-07-16): "真实 Doctor/list/show 必须穿过 production Catalog/detail。"
 */
import { OpenSpecCliContractExecutor, resolveRootContext, type CliResult } from '@openspecui/core'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { readSpecCatalog, readSpecDocument } from './spec-catalog-service.js'

const CLI_BIN = resolve(import.meta.dirname, '../node_modules/openspec-cli-16/bin/openspec.js')

function fixtureEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
  }
}

function runCli(args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [CLI_BIN, ...args],
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000 },
      (error, stdout, stderr) => {
        const exitCode = typeof error?.code === 'number' ? error.code : error ? 1 : 0
        complete({ success: exitCode === 0, stdout, stderr, exitCode })
      }
    )
  })
}

async function setupStore(
  id: string,
  root: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const result = await runCli(
    ['store', 'setup', id, '--path', root, '--no-init-git', '--json'],
    cwd,
    env
  )
  expect(result.success, result.stdout + '\n' + result.stderr).toBe(true)
  return realpath(root)
}

describe('pinned OpenSpec 1.6 Spec Catalog integration', () => {
  it('drives real Doctor, per-Store list, and show evidence through Catalog and detail', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-catalog-16-'))
    const launch = join(base, 'launch')
    const env = fixtureEnv(base)
    await mkdir(join(launch, 'openspec'), { recursive: true })

    try {
      const team = await setupStore('team', join(base, 'team'), base, env)
      const platform = await setupStore('platform', join(base, 'platform'), base, env)
      await mkdir(join(platform, 'openspec', 'specs', 'identity'), { recursive: true })
      await writeFile(
        join(platform, 'openspec', 'specs', 'identity', 'spec.md'),
        [
          '# identity Specification',
          '',
          '## Purpose',
          'Shared identity facts.',
          '',
          '## Requirements',
          '',
          '### Requirement: Identity',
          'The system SHALL expose identity.',
          '',
          '#### Scenario: Visible',
          '- **WHEN** identity is read',
          '- **THEN** it is visible',
          '',
        ].join('\n')
      )
      await writeFile(
        join(team, 'openspec', 'config.yaml'),
        ['schema: spec-driven', 'references:', '  - platform', ''].join('\n')
      )
      await writeFile(join(launch, 'openspec', 'config.yaml'), 'store: team\n')

      const contracts = new OpenSpecCliContractExecutor((args) => runCli(args, launch, env))
      const rootState = await resolveRootContext({
        launchProjectDir: launch,
        cliExecutor: {
          checkAvailability: async () => ({ available: true, version: '1.6.0' }),
          contracts,
        },
        env,
        now: () => 16,
      })
      expect(rootState.state).toBe('ready')
      if (rootState.state !== 'ready') throw new Error(rootState.error.message)
      expect(rootState.data).toMatchObject({
        planningRoot: { path: team, source: 'declared', store_id: 'team' },
        references: [{ store_id: 'platform', root: platform, status: [] }],
      })

      const source = {
        rootContext: rootState.data,
        adapter: { listSpecsWithMeta: vi.fn().mockResolvedValue([]) },
        documentService: {
          readSpec: vi.fn().mockResolvedValue(null),
          readSpecRaw: vi.fn().mockResolvedValue(null),
        },
        contracts,
      }
      const catalog = await readSpecCatalog(source, { now: () => 17 })
      expect(catalog).toMatchObject({
        entries: [
          {
            identity: { kind: 'referenced', storeId: 'platform', specId: 'identity' },
            readOnly: true,
          },
        ],
        referenceSources: [{ storeId: 'platform', state: 'ready', evidence: { exitCode: 0 } }],
      })

      const detail = await readSpecDocument(source, {
        kind: 'referenced',
        storeId: 'platform',
        specId: 'identity',
      })
      expect(detail).toMatchObject({
        state: 'ready',
        readOnly: true,
        upstream: {
          id: 'identity',
          root: { path: platform, source: 'store', store_id: 'platform' },
          requirements: [{ text: 'The system SHALL expose identity.' }],
        },
        evidence: { success: true, exitCode: 0 },
      })
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  }, 60_000)
})
