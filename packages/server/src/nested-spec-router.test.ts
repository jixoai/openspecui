/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove the public Router reads and writes recursive owned Spec identity through real services.
 * 2. Prove public mutation rejects encoded traversal before physical filesystem effects.
 * 3. Settle shared watcher owners before removing Windows nested-Spec fixtures.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 * Original request (2026-08-06): "Windows compatibility and adaptation, including the core and peripheral scripts."
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  parseCliCommandResult,
  type CliCommandResult,
} from '@openspecui/core'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import {
  disposeServerTestFixture,
  removeServerTestDirectories,
  SERVER_FIXTURE_TEST_TIMEOUT_MS,
} from './server-test-cleanup.js'
import { createServer } from './server.js'

function commandResult<T>(data: T, schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
    },
    schema
  )
}

async function createNestedSpecRouterFixture() {
  const root = await mkdtemp(join(tmpdir(), 'openspecui-nested-spec-router-'))
  const specPath = join(root, 'openspec', 'specs', 'platform', 'auth', 'spec.md')
  await mkdir(join(root, 'openspec'), { recursive: true })
  await mkdir(join(root, 'openspec', 'specs', 'platform', 'auth'), { recursive: true })
  await writeFile(
    specPath,
    `# Platform Auth Specification

## Purpose
Nested authentication.

## Requirements

### Requirement: Preserve identity
The platform SHALL preserve recursive Spec identity.
`,
    'utf8'
  )

  const server = createServer({ projectDir: root, enableWatcher: false })
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.7.0',
  })
  vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockResolvedValue(
    commandResult(
      {
        root: {
          path: root,
          source: 'nearest',
          healthy: true,
          status: [],
        },
        store: null,
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
  )
  vi.spyOn(server.cliExecutor.contracts, 'context').mockResolvedValue(
    commandResult(
      {
        root: {
          path: root,
          source: 'nearest',
          role: 'openspec_root',
        },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return {
    caller: appRouter.createCaller(server.createContext()),
    root,
    specPath,
    async dispose() {
      vi.restoreAllMocks()
      await disposeServerTestFixture(server)
      await removeServerTestDirectories([root])
    },
  }
}

describe('public nested Spec Router', { timeout: SERVER_FIXTURE_TEST_TIMEOUT_MS }, () => {
  it('reads and writes the complete recursive owned identity', async () => {
    const fixture = await createNestedSpecRouterFixture()
    try {
      await expect(
        fixture.caller.spec.document({ kind: 'owned', specId: 'platform/auth' })
      ).resolves.toMatchObject({
        identity: { kind: 'owned', specId: 'platform/auth' },
        state: 'ready',
        spec: { id: 'platform/auth' },
        rawMarkdown: expect.stringContaining('Preserve identity'),
      })

      await expect(
        fixture.caller.spec.save({
          identity: { kind: 'owned', specId: 'platform/auth' },
          content: '# Updated Platform Auth\n',
        })
      ).resolves.toEqual({ success: true })
      await expect(readFile(fixture.specPath, 'utf8')).resolves.toBe('# Updated Platform Auth\n')
    } finally {
      await fixture.dispose()
    }
  }, 15_000)

  it('rejects encoded traversal before creating a Spec document', async () => {
    const fixture = await createNestedSpecRouterFixture()
    try {
      await expect(
        fixture.caller.spec.save({
          identity: { kind: 'owned', specId: '%2e%2e%2fescaped' },
          content: '# Escaped\n',
        })
      ).rejects.toThrow(/Invalid specId/)
      await expect(
        readFile(join(fixture.root, 'openspec', 'escaped', 'spec.md'), 'utf8')
      ).rejects.toThrow()
    } finally {
      await fixture.dispose()
    }
  })
})
