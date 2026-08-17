/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove path-backed OPSX projections react to both Active Root YAML filename variants.
 * 2. Prove non-canonical Change ids are rejected before projection streams start.
 * 3. Prove demand-driven Status does not require Apply/artifact warmup and retains CLI evidence.
 * 4. Prove direct Projection Work readers preserve process evidence and skipped non-physical identity.
 * 5. Keep the real-watcher reactive wait budget ahead of shared CI runners: glob reactivity
 *    intermittently needs more than 20 s there while finishing in a few seconds locally.
 *
 * Original request (2026-08-14): shared ubuntu runners timed the glob reactivity waits out ~1 in 3 runs.
 * Original request (2026-07-15): "Planning-root adapters and services consume the CLI-resolved root."
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 * Full-gate correction (2026-07-31): prove warmup independence by immediate rejection if touched, not a loaded-suite timing race.
 */
import { mkdir, realpath, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir, waitFor, waitForDebounce } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import { writeAtomicPhysicalReactiveFile } from './physical-reactive-file-writer.js'
import { acquireWatcherRoot, clearCache } from './reactive-fs/index.js'
import { ReactiveContext } from './reactive-fs/reactive-context.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

describe('OpsxKernel artifact status reactivity', () => {
  const REACTIVE_WAIT_OPTIONS = { timeout: 45000 }
  const REACTIVE_TEST_TIMEOUT_MS = 50000
  let tempDir: string
  let kernel: OpsxKernel | null = null
  let runtimeInvalidation: RuntimeInvalidationIndex

  beforeEach(async () => {
    tempDir = await createTempDir()
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    await acquireWatcherRoot(tempDir)
    runtimeInvalidation = new RuntimeInvalidationIndex()
    clearCache()
  })

  afterEach(async () => {
    kernel?.dispose()
    kernel = null
    await closeAllWatchers()
    await waitForDebounce(200)
    clearCache()
    await cleanupTempDir(tempDir)
  })

  async function prepareKernel(
    outputPath: string,
    rootSelector: { store?: string } = {},
    activeRootConfigName: 'config.yaml' | 'config.yml' = 'config.yaml'
  ): Promise<{
    changeDir: string
    kernel: OpsxKernel
  }> {
    const changeId = 'demo-change'
    const changeDir = join(tempDir, 'openspec', 'changes', changeId)
    const schemaDir = join(tempDir, 'openspec', 'schemas', 'test')
    await mkdir(changeDir, { recursive: true })
    await mkdir(schemaDir, { recursive: true })
    await writeFile(join(tempDir, 'openspec', activeRootConfigName), 'name: test\n', 'utf-8')
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: test\n', 'utf-8')
    await writeFile(
      join(schemaDir, 'schema.yaml'),
      `name: test
artifacts:
  - id: tasks
    generates: ${JSON.stringify(outputPath)}
    requires: []
apply:
  tracks: ${JSON.stringify(outputPath)}
`,
      'utf-8'
    )
    await writeFile(join(tempDir, 'schema-name.txt'), 'schema-a\n', 'utf-8')

    const cliScriptPath = join(tempDir, 'fake-openspec.mjs')
    await writeFile(
      cliScriptPath,
      `
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, matchesGlob, relative, sep } from 'node:path'

const outputPath = ${JSON.stringify(outputPath)}
const schemaDir = ${JSON.stringify(schemaDir)}
const args = process.argv.slice(2)

function isGlobPattern(pattern) {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

function collectFiles(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) {
    return []
  }

  const entries = readdirSync(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(rootDir, fullPath))
      continue
    }
    if (entry.isFile()) {
      const relativePath = relative(rootDir, fullPath).split(sep).join('/')
      files.push(relativePath)
    }
  }

  return files
}

if (args.includes('--version')) {
  console.log('0.0.0-test')
  process.exit(0)
}

if (args[0] === 'schemas' && args.includes('--json')) {
  const name = readFileSync(join(process.cwd(), 'schema-name.txt'), 'utf8').trim()
  console.log(JSON.stringify([{ name, artifacts: [], source: 'user' }]))
  process.exit(0)
}

if (args[0] === 'schema' && args[1] === 'which' && args.includes('--json')) {
  console.log(JSON.stringify({
    name: 'test',
    source: 'project',
    path: schemaDir,
    shadows: [],
  }))
  process.exit(0)
}

if (args[0] === 'instructions' && args[1] === 'artifact' && args.includes('--json')) {
  const changeId = args[args.indexOf('--change') + 1]
  const changeDir = join(process.cwd(), 'openspec', 'changes', changeId)
  console.log(JSON.stringify({
    changeName: changeId,
    artifactId: 'artifact',
    schemaName: 'test',
    changeDir,
    planningHome: {
      kind: 'repo',
      root: process.cwd(),
      changesDir: join(process.cwd(), 'openspec', 'changes'),
      defaultSchema: 'test',
    },
    outputPath,
    resolvedOutputPath: join(changeDir, outputPath),
    existingOutputPaths: [],
    description: 'Test artifact.',
    instruction: 'Write the test artifact.',
    context: 'Fixture context.',
    rules: [],
    template: '# Test artifact',
    dependencies: [],
    unlocks: [],
    references: [],
    root: {
      path: process.cwd(),
      source: args.includes('--store') ? 'store' : 'nearest',
      store_id: args.includes('--store') ? args[args.indexOf('--store') + 1] : undefined,
    },
  }))
  process.exit(0)
}

if (args[0] === 'instructions' && args[1] === 'apply' && args.includes('--json')) {
  console.log(JSON.stringify({
    changeName: 'demo-change',
    changeDir: join(process.cwd(), 'openspec', 'changes', 'demo-change'),
    schemaName: 'test',
    contextFiles: {},
    progress: { total: 0, complete: 0, remaining: 0 },
    tasks: [],
    state: 'all_done',
    instruction: args.includes('--store')
      ? 'Apply via Store ' + args[args.indexOf('--store') + 1] + '.'
      : 'Apply the change.',
    references: [],
    root: {
      path: process.cwd(),
      source: args.includes('--store') ? 'store' : 'nearest',
      store_id: args.includes('--store') ? args[args.indexOf('--store') + 1] : undefined,
    },
  }))
  process.exit(0)
}

if (args[0] === 'instructions' && args[1] === 'archive' && args.includes('--json')) {
  const changeId = args[args.indexOf('--change') + 1]
  console.log(JSON.stringify({
    changeName: changeId,
    context: 'Fixture archive context.',
    operationGuidance: ['Review fixture deltas.'],
    root: {
      path: process.cwd(),
      source: args.includes('--store') ? 'store' : 'nearest',
      store_id: args.includes('--store') ? args[args.indexOf('--store') + 1] : undefined,
    },
  }))
  process.exit(0)
}

if (args[0] === 'status' && args.includes('--json')) {
  const changeIndex = args.indexOf('--change')
  const changeId = changeIndex >= 0 ? args[changeIndex + 1] : 'unknown-change'
  if (changeId === 'cli-failure') {
    console.log(JSON.stringify({
      status: [{ severity: 'error', code: 'FIXTURE_FAILURE', message: 'Fixture status failed.' }],
    }))
    console.error('fixture status stderr')
    process.exit(7)
  }
  const changeDir = join(process.cwd(), 'openspec', 'changes', changeId)
  const done = isGlobPattern(outputPath)
    ? collectFiles(changeDir).some((path) => matchesGlob(path, outputPath))
    : existsSync(join(changeDir, outputPath))
  const skipped = changeId === 'skip-specs'

  console.log(
    JSON.stringify({
      changeName: changeId,
      schemaName: 'test',
      planningHome: {
        kind: 'repo',
        root: process.cwd(),
        changesDir: join(process.cwd(), 'openspec', 'changes'),
        defaultSchema: 'test',
      },
      changeRoot: changeDir,
      artifactPaths: {
        artifact: {
          outputPath,
          resolvedOutputPath: join(changeDir, outputPath),
          existingOutputPaths: done ? [join(changeDir, outputPath)] : [],
        },
      },
      isPlanningComplete: done || skipped,
      isComplete: done || skipped,
      applyRequires: [],
      nextSteps: [],
      actionContext: {
        mode: 'repo-local',
        sourceOfTruth: 'repo',
        planningArtifacts: ['artifact'],
        linkedContext: [],
        allowedEditRoots: [process.cwd()],
        requiresAffectedAreaSelection: false,
        constraints: [],
      },
      artifacts: [
        {
          id: 'artifact',
          outputPath,
          status: skipped ? 'skipped' : done ? 'done' : 'blocked',
          requires: [],
          missingDeps: done || skipped ? [] : [outputPath],
        },
      ],
      root: {
        path: process.cwd(),
        source: args.includes('--store') ? 'store' : 'nearest',
        store_id: args.includes('--store') ? args[args.indexOf('--store') + 1] : undefined,
        healthy: true,
        status: [],
      },
    })
  )
  process.exit(0)
}

console.error('Unsupported args:', args.join(' '))
process.exit(1)
      `.trimStart(),
      'utf-8'
    )

    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({
      cli: {
        command: process.execPath,
        args: [cliScriptPath],
      },
    })

    const cliExecutor = new CliExecutor(configManager, tempDir)
    kernel = new OpsxKernel(tempDir, cliExecutor, runtimeInvalidation, rootSelector)
    return { changeDir, kernel }
  }

  async function waitForReactiveStatusSetup(): Promise<void> {
    // Native watcher backends can take a brief moment to begin delivering
    // nested file events after the initial reactive status stream is created.
    await waitForDebounce(1000)
  }

  it('preserves CLI status paths/context and the explicit Store selector', async () => {
    const { changeDir, kernel } = await prepareKernel('result.md', { store: 'shared' })
    const canonicalTempDir = await realpath(tempDir)
    const canonicalChangeDir = join(canonicalTempDir, 'openspec', 'changes', 'demo-change')

    await kernel.ensureStatus('demo-change')
    await kernel.ensureApplyInstructions('demo-change')
    await kernel.ensureInstructions('demo-change', 'artifact')

    expect(kernel.getStatus('demo-change').provenance).toMatchObject({
      kind: 'cli',
      changeRoot: canonicalChangeDir,
      artifactPaths: {
        artifact: {
          outputPath: 'result.md',
          resolvedOutputPath: join(canonicalChangeDir, 'result.md'),
          existingOutputPaths: [],
        },
      },
      actionContext: {
        mode: 'repo-local',
        sourceOfTruth: 'repo',
        allowedEditRoots: [canonicalTempDir],
      },
      root: { source: 'store', store_id: 'shared' },
      evidence: {
        command: 'status',
        success: true,
        selector: { store: 'shared' },
      },
    })
    expect(changeDir).toBe(join(tempDir, 'openspec', 'changes', 'demo-change'))
    expect(kernel.getApplyInstructions('demo-change')).toMatchObject({
      instruction: 'Apply via Store shared.',
      evidence: {
        command: 'instructions apply',
        success: true,
        selector: { store: 'shared' },
        root: { source: 'store', store_id: 'shared' },
      },
    })
    await kernel.ensureArchiveInstructions('demo-change')
    expect(kernel.getArchiveInstructions('demo-change')).toMatchObject({
      context: 'Fixture archive context.',
      operationGuidance: ['Review fixture deltas.'],
      evidence: {
        command: 'instructions archive',
        selector: { store: 'shared' },
      },
    })
    expect(kernel.getInstructions('demo-change', 'artifact')).toMatchObject({
      artifactId: 'artifact',
      evidence: {
        command: 'instructions',
        success: true,
        selector: { store: 'shared' },
        root: { source: 'store', store_id: 'shared' },
      },
    })
  })

  it('preserves skipped dependencies without publishing a physical artifact path', async () => {
    const { kernel } = await prepareKernel('specs/**/*.md')

    await kernel.ensureStatus('skip-specs')

    expect(kernel.getStatus('skip-specs').artifacts).toEqual([
      {
        id: 'artifact',
        outputPath: 'specs/**/*.md',
        status: 'skipped',
        requires: [],
        missingDeps: [],
      },
    ])
  })

  it('rejects non-canonical Change ids before starting path-backed projections', async () => {
    const { kernel } = await prepareKernel('result.md')

    await expect(kernel.ensureStatus('../escaped')).rejects.toThrow(/Invalid changeId/)
    await expect(kernel.ensureInstructions('../escaped', 'artifact')).rejects.toThrow(
      /Invalid changeId/
    )
    await expect(kernel.ensureApplyInstructions('../escaped')).rejects.toThrow(/Invalid changeId/)
    await expect(kernel.ensureArtifactOutput('../escaped', 'result.md')).rejects.toThrow(
      /Invalid changeId/
    )
    await expect(kernel.ensureGlobArtifactFiles('../escaped', '**/*.md')).rejects.toThrow(
      /Invalid changeId/
    )
    await expect(kernel.ensureChangeMetadata('../escaped')).rejects.toThrow(/Invalid changeId/)
    await expect(kernel.ensureArtifactOutput('demo-change', '../../escaped.md')).rejects.toThrow(
      /Invalid outputPath/
    )
    await expect(
      kernel.ensureGlobArtifactFiles('demo-change', '../outside/**/*.md')
    ).rejects.toThrow(/Invalid outputPath/)
  })

  it('delivers Status List without waiting for a pending full warmup', async () => {
    const { kernel } = await prepareKernel('result.md')
    const pendingWarmup = vi
      .spyOn(kernel, 'waitForWarmup')
      .mockRejectedValue(new Error('Status List must not wait for full warmup.'))

    await expect(kernel.ensureStatusList()).resolves.toBeUndefined()

    expect(kernel.getStatusList().map((status) => status.changeName)).toEqual(['demo-change'])
    expect(pendingWarmup).not.toHaveBeenCalled()
  })

  it('preserves real CLI success and failure evidence through direct Projection Work readers', async () => {
    const { kernel } = await prepareKernel('result.md')

    const config = await kernel.readConfigBundleProjection()
    expect(config).toMatchObject({
      value: { schemas: [{ name: 'schema-a' }] },
      evidence: {
        schemas: {
          success: true,
          stderr: '',
          exitCode: 0,
          payload: [{ name: 'schema-a', artifacts: [], source: 'user' }],
          diagnostics: [],
        },
        schemaResolutions: {
          'schema-a': { success: true, stderr: '', exitCode: 0, diagnostics: [] },
        },
      },
    })

    await expect(kernel.readStatusProjection('cli-failure')).rejects.toMatchObject({
      name: 'CliProjectionCommandError',
      message: 'fixture status stderr',
      cliEvidence: {
        success: false,
        stderr: 'fixture status stderr\n',
        exitCode: 7,
        payload: {
          status: [
            {
              severity: 'error',
              code: 'FIXTURE_FAILURE',
              message: 'Fixture status failed.',
            },
          ],
        },
        diagnostics: [
          {
            severity: 'error',
            code: 'FIXTURE_FAILURE',
            message: 'Fixture status failed.',
          },
        ],
      },
    })
  })

  it('recomputes Config Bundle from direct config.yml settlement without a Root bridge', async () => {
    const { kernel } = await prepareKernel('result.md', {}, 'config.yml')
    await closeAllWatchers()
    const context = new ReactiveContext()
    const stream = context.stream(() => kernel.readConfigBundleProjection())

    try {
      await expect(stream.next()).resolves.toMatchObject({
        done: false,
        value: { value: { schemas: [{ name: 'schema-a' }] } },
      })

      const replacement = stream.next()
      await writeFile(join(tempDir, 'schema-name.txt'), 'schema-b\n', 'utf-8')
      await writeAtomicPhysicalReactiveFile({
        rootPath: tempDir,
        relativePath: 'openspec/config.yml',
        content: 'name: changed\n',
      })

      await expect(replacement).resolves.toMatchObject({
        done: false,
        value: { value: { schemas: [{ name: 'schema-b' }] } },
      })
    } finally {
      await stream.return(undefined)
    }
  })

  it(
    'preserves Apply literal-path divergence beside tracked glob progress',
    async () => {
      const { changeDir, kernel } = await prepareKernel('work/**/*.md')
      await mkdir(join(changeDir, 'work', 'backend'), { recursive: true })
      await writeFile(
        join(changeDir, 'work', 'backend', 'tasks.md'),
        '- [x] Done\n- [ ] Remaining\n',
        'utf-8'
      )

      await kernel.ensureApplyInstructions('demo-change')

      expect(kernel.getApplyInstructions('demo-change').applyInstructionProgress).toMatchObject({
        source: 'openspec-instructions-apply',
        total: 0,
        complete: 0,
        remaining: 0,
        state: 'all_done',
        divergence: {
          kind: 'tracked-task-mismatch',
          tracked: { total: 2, completed: 1, remaining: 1, phase: 'in-progress' },
        },
      })
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'pulls fresh CLI schema projection after the runtime schema facet is invalidated',
    async () => {
      const { kernel } = await prepareKernel('result.md')

      await kernel.ensureSchemas()
      expect(kernel.getSchemas().map((schema) => schema.name)).toEqual(['schema-a'])

      await writeFile(join(tempDir, 'schema-name.txt'), 'schema-b\n', 'utf-8')
      runtimeInvalidation.invalidate(['schemas'])

      await waitFor(
        () => kernel.getSchemas().some((schema) => schema.name === 'schema-b'),
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status when a file appears inside an existing subdirectory',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/result.md')
      await mkdir(join(changeDir, 'loop'), { recursive: true })

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()
      await waitForDebounce(1000)

      await writeFile(join(changeDir, 'loop', 'result.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status when missing parent directories are created later',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/nested/result.md')

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()
      const initialStatus = kernel.getStatus('demo-change')

      await mkdir(join(changeDir, 'loop', 'nested'), { recursive: true })
      await waitFor(() => kernel.getStatus('demo-change') !== initialStatus, REACTIVE_WAIT_OPTIONS)
      await writeFile(join(changeDir, 'loop', 'nested', 'result.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status for glob artifacts when matching files appear in subdirectories',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/**/*.md')
      await mkdir(join(changeDir, 'loop'), { recursive: true })

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()

      await mkdir(join(changeDir, 'loop', 'docs'), { recursive: true })
      await waitForDebounce(250)
      await writeFile(join(changeDir, 'loop', 'docs', 'guide.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status for question-mark glob artifacts',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/file?.md')
      await mkdir(join(changeDir, 'loop'), { recursive: true })

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()

      await writeFile(join(changeDir, 'loop', 'file1.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )
})
