import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hasRuntimePackageDependencyPath,
  normalizeRuntimeHostOptionalDependencies,
  readRuntimeHostPackageDependencyRequest,
  resolveRuntimeHostPackageContext,
  type RuntimeHostPackageContext,
  type RuntimePackageDependencyTreeNode,
} from './runtime-package-host.js'

const createdDirs: string[] = []

async function createTempTree(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'openspecui-runtime-host-'))
  createdDirs.push(dir)
  return dir
}

function createRuntimeHostContext(packageDir: string): RuntimeHostPackageContext {
  return {
    packageDir,
    packageJsonPath: join(packageDir, 'package.json'),
    packageName: 'openspecui',
  }
}

describe('resolveRuntimeHostPackageContext', () => {
  afterEach(async () => {
    await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('prefers openspecui over @openspecui/server when both package roots are present', async () => {
    const dir = await createTempTree()
    const runtimeRoot = join(dir, 'node_modules', 'openspecui')
    const serverRoot = join(runtimeRoot, 'node_modules', '@openspecui', 'server')
    await mkdir(serverRoot, { recursive: true })
    await writeFile(
      join(runtimeRoot, 'package.json'),
      JSON.stringify({ name: 'openspecui' }, null, 2)
    )
    await writeFile(
      join(serverRoot, 'package.json'),
      JSON.stringify({ name: '@openspecui/server' }, null, 2)
    )

    expect(resolveRuntimeHostPackageContext(serverRoot)).toEqual({
      packageDir: runtimeRoot,
      packageJsonPath: join(runtimeRoot, 'package.json'),
      packageName: 'openspecui',
    })
  })
})

describe('readRuntimeHostPackageDependencyRequest', () => {
  afterEach(async () => {
    await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('reads the runtime dependency range from optionalDependencies first', async () => {
    const dir = await createTempTree()
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'openspecui',
          dependencies: { '@huggingface/transformers': '^4.0.0' },
          optionalDependencies: { '@huggingface/transformers': '~4.2.0' },
        },
        null,
        2
      )
    )

    expect(
      readRuntimeHostPackageDependencyRequest({
        runtimeHost: createRuntimeHostContext(dir),
        packageName: '@huggingface/transformers',
        fallbackRange: '^0.0.0',
      })
    ).toBe('@huggingface/transformers@~4.2.0')
  })

  it('falls back to the hardcoded range when the host manifest omits the runtime package', async () => {
    const dir = await createTempTree()
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'openspecui' }, null, 2))

    expect(
      readRuntimeHostPackageDependencyRequest({
        runtimeHost: createRuntimeHostContext(dir),
        packageName: '@huggingface/transformers',
        fallbackRange: '~4.2.0',
      })
    ).toBe('@huggingface/transformers@~4.2.0')
  })
})

describe('hasRuntimePackageDependencyPath', () => {
  it('walks nested dependency trees from npm list', () => {
    const tree: RuntimePackageDependencyTreeNode = {
      dependencies: {
        '@huggingface/transformers': {
          dependencies: {
            'onnxruntime-node': {
              version: '1.24.3',
            },
          },
        },
      },
    }

    expect(hasRuntimePackageDependencyPath(tree, ['@huggingface/transformers'])).toBe(true)
    expect(
      hasRuntimePackageDependencyPath(tree, ['@huggingface/transformers', 'onnxruntime-node'])
    ).toBe(true)
    expect(hasRuntimePackageDependencyPath(tree, ['onnxruntime-node'])).toBe(false)
  })
})

describe('normalizeRuntimeHostOptionalDependencies', () => {
  afterEach(async () => {
    await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('removes duplicated deno-installed runtime entries from dependencies', async () => {
    const dir = await createTempTree()
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'openspecui',
          dependencies: { '@huggingface/transformers': '~4.2.0', zod: '^3.24.1' },
          optionalDependencies: { '@huggingface/transformers': '~4.2.0' },
        },
        null,
        2
      )
    )

    normalizeRuntimeHostOptionalDependencies({
      runtimeHost: createRuntimeHostContext(dir),
      packageNames: ['@huggingface/transformers'],
    })

    const updated = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
    expect(updated.optionalDependencies?.['@huggingface/transformers']).toBe('~4.2.0')
    expect(updated.dependencies?.['@huggingface/transformers']).toBeUndefined()
    expect(updated.dependencies?.zod).toBe('^3.24.1')
  })
})
