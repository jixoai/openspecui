/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Prove the Kernel forwards the selected Root's Store selector to schemas on OpenSpec 1.9.
 * 2. Prove the selector is withheld on OpenSpec 1.8, where `--store` is an unknown option.
 * 3. Drive both proofs through the production OpsxKernel path with the pinned executables.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PINNED_OPENSPEC_V9_VERSIONS,
  createPinnedFixtureRoot,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV9Version,
} from './__tests__/official-cli-v9-fixtures.js'
import { cleanupTempDir } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { CliProjectionCommandError } from './cli-projection.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

const PINNED_BINS = {
  '1.8.0': resolve(import.meta.dirname, '../node_modules/openspec-cli-18/bin/openspec.js'),
  '1.9.0': resolve(import.meta.dirname, '../node_modules/openspec-cli-19/bin/openspec.js'),
} satisfies Record<PinnedOpenspecV9Version, string>

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(cleanupTempDir))
})

describe('OpsxKernel schemas selected-Root forwarding', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V9_VERSIONS) {
    it(`forwards the Store selector to schemas only on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `kernel-schemas-root-${version.replace(/\./g, '')}`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      // A valid initialized root keeps plain `schemas --json` successful, so only the
      // forwarded ghost-store selector can produce a selected-Root failure on 1.9.
      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      const config = new ConfigManager(project)
      await config.writeConfig({
        cli: { command: process.execPath, args: [PINNED_BINS[version]] },
      })
      const executor = new CliExecutor(config, project)
      const kernel = new OpsxKernel(project, executor, new RuntimeInvalidationIndex(), {
        store: 'ghost',
      })
      const schemasSpy = vi.spyOn(executor.contracts, 'schemas')

      try {
        if (version === '1.9.0') {
          // 1.9 resolves schemas through the selected Root: the ghost store must surface
          // as the selected Root's typed failure evidence, not as a fallback catalog.
          const attempt = await kernel.readConfigBundleProjection().catch((error) => error)
          expect(attempt).toBeInstanceOf(CliProjectionCommandError)
          // The diagnostic code depends on registry state (unknown_store once any store
          // registration exists, no_registered_stores otherwise); both are the selected
          // Root's own failure, and neither is a successful catalog.
          expect(attempt.cliEvidence.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: expect.stringMatching(/^(unknown_store|no_registered_stores)$/),
          })
          // Eager-JSON resolution settles before the process's natural exit, so the live
          // evidence honestly reports the exit code as unknown (null, macOS timing) or the
          // CLI's real failure exit (1, Linux timing) — never a fabricated 0.
          expect(attempt.cliEvidence.exitCode === null || attempt.cliEvidence.exitCode !== 0).toBe(
            true
          )
          expect(schemasSpy).toHaveBeenCalledWith({ store: 'ghost' })
        } else {
          // 1.8 has no schemas root selector; forwarding `--store` would fail the command
          // with an unknown-option error. The projection must succeed with it withheld.
          const bundle = await kernel.readConfigBundleProjection()
          expect(bundle.value.schemas.length).toBeGreaterThan(0)
          expect(schemasSpy).toHaveBeenCalledWith({})
        }
      } finally {
        kernel.dispose()
      }
    }, 120_000)
  }
})
