/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Verify exact Active Root owner, source, official projection, diagnostics, and revision.
 * 2. Verify Structured saves preserve every unowned YAML node and representable presentation detail.
 * 3. Verify serialized parallel and observed external replacements return latest-source conflicts.
 * 4. Verify Raw mode accepts custom YAML and rejects syntax errors before physical mutation.
 * 5. Verify successful saves atomically replace and reactively settle before returning.
 *
 * Original request (2026-08-01): preserve raw YAML writes for team-defined keys outside the official standard.
 * Derived checkpoint (2026-08-02): Structured and Raw mutations are revision-aware and recover the latest source.
 */
import { ReactiveContext, type ActiveRootMutationResult, type RootContext } from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { mutateActiveRootConfig, readActiveRootConfig } from './active-root-config-service.js'

const fixturePath = fileURLToPath(
  new URL('../../../test-fixtures/openspec-1.7-active-root-config.yaml', import.meta.url)
)
const tempDirs: string[] = []

function createRootContext(launchProject: string, planningRoot: string): RootContext {
  return {
    launchProject: { path: launchProject },
    planningRoot: {
      path: planningRoot,
      source: 'declared',
      store_id: 'shared-platform',
      healthy: true,
      status: [],
    },
    storeId: 'shared-platform',
    cli: { available: true, version: '1.7.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/runtime/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

async function createFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-active-root-'))
  tempDirs.push(tempDir)
  const launchProjectDir = join(tempDir, 'launch')
  const planningRoot = join(tempDir, 'shared-platform')
  const configPath = join(planningRoot, 'openspec', 'config.yaml')
  const content = await readFile(fixturePath, 'utf8')
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, content, 'utf8')
  return {
    configPath,
    content,
    input: {
      launchProjectDir,
      rootContext: createRootContext(launchProjectDir, planningRoot),
    },
  }
}

function requireApplied(
  result: ActiveRootMutationResult
): asserts result is Extract<ActiveRootMutationResult, { state: 'applied' }> {
  if (result.state !== 'applied')
    throw new Error(`Expected applied result, received ${result.state}.`)
}

function locator(config: Awaited<ReturnType<typeof readActiveRootConfig>>) {
  return {
    ownerPath: config.owner.path,
    filePath: config.file.path,
    revision: config.revision,
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Active Root config service', () => {
  it('projects official fields, operation guidance, diagnostics, and an opaque revision', async () => {
    const fixture = await createFixture()

    const projection = await readActiveRootConfig(fixture.input)

    expect(projection).toMatchObject({
      owner: {
        path: dirname(dirname(fixture.configPath)),
        source: 'declared',
        storeId: 'shared-platform',
        externalToLaunchProject: true,
      },
      file: { path: fixture.configPath, exists: true, content: fixture.content },
      revision: expect.stringMatching(/^sha256:/),
      official: {
        schema: 'spec-driven',
        context: expect.stringContaining('Payments platform'),
        rules: {
          proposal: ['State the rollback boundary.'],
          tasks: ['Keep each task independently verifiable.'],
        },
        operations: {
          apply: { guidance: ['Run focused checks before broad gates.'] },
          archive: { guidance: ['Preserve release evidence.'] },
        },
      },
      diagnostics: [],
    })
  })

  it('preserves comments, binding nodes, ordering, and team keys during a structured save', async () => {
    const fixture = await createFixture()
    const loaded = await readActiveRootConfig(fixture.input)

    const result = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: {
        mode: 'structured',
        ...locator(loaded),
        update: {
          schema: 'team-workflow',
          context: 'Updated through structured fields.',
          rules: { proposal: ['Add rollout evidence.'] },
          operations: {
            apply: { guidance: ['Run the focused suite.'] },
            archive: null,
          },
        },
      },
    })

    requireApplied(result)
    const written = await readFile(fixture.configPath, 'utf8')
    expect(written).toContain('schema: team-workflow # Keep the selected workflow comment.')
    expect(written).toContain('# This rule comment must survive a structured save.')
    expect(written).toContain('store: shared-platform')
    expect(written).toContain('references:')
    expect(written).toContain('x-team-policy:')
    expect(written).toContain('x-review-owner: atlas')
    expect(written).toContain('deploy:')
    expect(written).toContain('x-audit:')
    expect(written).not.toContain('Preserve release evidence.')
    expect(written.indexOf('store:')).toBeLessThan(written.indexOf('schema:'))
    expect(written.indexOf('schema:')).toBeLessThan(written.indexOf('x-team-policy:'))
    expect(result.config.official).toEqual({
      schema: 'team-workflow',
      context: 'Updated through structured fields.',
      rules: { proposal: ['Add rollout evidence.'] },
      operations: { apply: { guidance: ['Run the focused suite.'] } },
    })
  })

  it('rejects a second editor that still saves revision A', async () => {
    const fixture = await createFixture()
    const revisionA = await readActiveRootConfig(fixture.input)

    const firstResult = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: {
        mode: 'raw',
        ...locator(revisionA),
        content: 'schema: first-editor\n',
      },
    })
    const secondResult = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: {
        mode: 'raw',
        ...locator(revisionA),
        content: 'schema: stale-second-editor\n',
      },
    })

    requireApplied(firstResult)
    expect(secondResult).toMatchObject({
      state: 'conflict',
      reason: 'revision-changed',
      latest: {
        revision: firstResult.config.revision,
        file: { content: 'schema: first-editor\n' },
      },
    })
    await expect(readFile(fixture.configPath, 'utf8')).resolves.toBe('schema: first-editor\n')
  })

  it('rejects an external writer replacement after revision A was loaded', async () => {
    const fixture = await createFixture()
    const revisionA = await readActiveRootConfig(fixture.input)
    await writeFile(fixture.configPath, 'schema: external-writer\n', 'utf8')

    const result = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: {
        mode: 'raw',
        ...locator(revisionA),
        content: 'schema: stale-after-external-write\n',
      },
    })

    expect(result).toMatchObject({
      state: 'conflict',
      reason: 'revision-changed',
      latest: { file: { content: 'schema: external-writer\n' } },
    })
    await expect(readFile(fixture.configPath, 'utf8')).resolves.toBe('schema: external-writer\n')
  })

  it('accepts custom Raw YAML and rejects invalid syntax without replacing the applied source', async () => {
    const fixture = await createFixture()
    const loaded = await readActiveRootConfig(fixture.input)
    const validCustomYaml = 'schema: custom\nx-company:\n  deployment-ring: canary\n'

    const applied = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: { mode: 'raw', ...locator(loaded), content: validCustomYaml },
    })
    requireApplied(applied)
    const invalid = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: {
        mode: 'raw',
        ...locator(applied.config),
        content: 'schema: [unterminated\n',
      },
    })

    expect(invalid).toMatchObject({
      state: 'invalid',
      reason: 'raw-syntax',
      diagnostics: [expect.objectContaining({ code: 'config-unparseable' })],
      latest: { revision: applied.config.revision },
    })
    await expect(readFile(fixture.configPath, 'utf8')).resolves.toBe(validCustomYaml)
  })

  it('atomically replaces and publishes the new revision before mutation success', async () => {
    const fixture = await createFixture()
    const before = await stat(fixture.configPath)
    const context = new ReactiveContext()
    const stream = context.stream(() => readActiveRootConfig(fixture.input))
    const loaded = (await stream.next()).value
    if (!loaded) throw new Error('Active Root projection did not load.')
    const replacement = stream.next()

    const result = await mutateActiveRootConfig({
      ...fixture.input,
      mutation: {
        mode: 'raw',
        ...locator(loaded),
        content: 'schema: atomically-replaced\n',
      },
    })

    requireApplied(result)
    const after = await stat(fixture.configPath)
    expect(after.ino).not.toBe(before.ino)
    await expect(replacement).resolves.toMatchObject({
      value: {
        revision: result.config.revision,
        file: { content: 'schema: atomically-replaced\n' },
      },
    })
    await stream.return(undefined)
  })
})
