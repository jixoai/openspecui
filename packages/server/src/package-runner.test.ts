import { getTranslationEngineManifest } from '@openspecui/core'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createExtensionInstallCommand, detectPackageRunner } from './package-runner.js'

describe('package runner detection', () => {
  let tempDir: string | null = null

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = null
    }
  })

  it('detects the active dlx package manager from npm environment', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-runner-'))

    expect(
      detectPackageRunner({
        cwd: tempDir,
        env: { npm_config_user_agent: 'pnpm/10.22.0 npm/? node/v24' },
      })
    ).toMatchObject({ id: 'pnpm' })
    expect(
      detectPackageRunner({
        cwd: tempDir,
        env: { npm_execpath: '/Users/me/.local/bin/vp' },
      })
    ).toMatchObject({ id: 'vp' })
  })

  it('falls back to lockfiles and local development conditions', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-runner-'))

    expect(
      detectPackageRunner({
        cwd: tempDir,
        env: { NODE_OPTIONS: '--conditions=development' },
      })
    ).toMatchObject({ id: 'local' })
    await writeFile(join(tempDir, 'pnpm-lock.yaml'), '', 'utf8')
    expect(detectPackageRunner({ cwd: tempDir, env: {} })).toMatchObject({ id: 'pnpm' })
  })

  it('builds npm alias install commands for service translator engines', () => {
    const manifest = getTranslationEngineManifest('nmt')

    expect(createExtensionInstallCommand({ runner: 'pnpm', manifest })).toEqual({
      command: 'pnpm',
      args: ['add', '@openspecui-runtime/nmt-translator@npm:@openspecui/nmt-translator@^3.7.2'],
    })
    expect(createExtensionInstallCommand({ runner: 'npm', manifest })).toEqual({
      command: 'npm',
      args: ['install', '@openspecui-runtime/nmt-translator@npm:@openspecui/nmt-translator@^3.7.2'],
    })
    expect(createExtensionInstallCommand({ runner: 'local', manifest })).toBeNull()
  })
})
