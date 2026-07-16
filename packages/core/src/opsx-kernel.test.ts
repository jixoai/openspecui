/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Prove path-backed OPSX projections react to planning-root changes.
 * 2. Prove non-canonical Change ids are rejected before projection streams start.
 *
 * Original request (2026-07-15): "Planning-root adapters and services consume the CLI-resolved root."
 */
import { mkdir, realpath, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir, waitFor, waitForDebounce } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import { acquireWatcherRoot, clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

describe('OpsxKernel artifact status reactivity', () => {
  const REACTIVE_WAIT_OPTIONS = { timeout: 20000 }
  const REACTIVE_TEST_TIMEOUT_MS = 25000
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
    rootSelector: { store?: string } = {}
  ): Promise<{
    changeDir: string
    kernel: OpsxKernel
  }> {
    const changeId = 'demo-change'
    const changeDir = join(tempDir, 'openspec', 'changes', changeId)
    const schemaDir = join(tempDir, 'openspec', 'schemas', 'test')
    await mkdir(changeDir, { recursive: true })
    await mkdir(schemaDir, { recursive: true })
    await writeFile(join(tempDir, 'openspec', 'config.yaml'), 'name: test\n', 'utf-8')
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

if (args[0] === 'status' && args.includes('--json')) {
  const changeIndex = args.indexOf('--change')
  const changeId = changeIndex >= 0 ? args[changeIndex + 1] : 'unknown-change'
  const changeDir = join(process.cwd(), 'openspec', 'changes', changeId)
  const done = isGlobPattern(outputPath)
    ? collectFiles(changeDir).some((path) => matchesGlob(path, outputPath))
    : existsSync(join(changeDir, outputPath))

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
      isComplete: done,
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
          status: done ? 'done' : 'blocked',
          missingDeps: done ? [] : [outputPath],
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
    })
    expect(changeDir).toBe(join(tempDir, 'openspec', 'changes', 'demo-change'))
    expect(kernel.getApplyInstructions('demo-change').instruction).toBe('Apply via Store shared.')
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
