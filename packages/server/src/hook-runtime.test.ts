import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHookRuntime } from './hook-runtime.js'

const tmpRoots: string[] = []

async function makeProject(name: string): Promise<string> {
  const dir = join(tmpdir(), `openspecui-hook-runtime-${name}-${Date.now()}`)
  tmpRoots.push(dir)
  await mkdir(join(dir, 'openspec'), { recursive: true })
  return dir
}

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ProjectHookRuntime', () => {
  it('returns empty hooks when the project hook file is missing', async () => {
    const projectDir = await makeProject('missing')
    const runtime = createHookRuntime(projectDir)

    await expect(runtime.load()).resolves.toEqual({})
  })

  it('loads TypeScript project hooks from openspec/openspecui.hooks.ts', async () => {
    const projectDir = await makeProject('typescript')
    await writeFile(
      join(projectDir, 'openspec', 'openspecui.hooks.ts'),
      `
export async function onReadDocument(_ctx, read) {
  const result = await read()
  return { ...result, markdown: result.markdown + "\\nprocessed" }
}
`,
      'utf-8'
    )

    const runtime = createHookRuntime(projectDir)
    const hooks = await runtime.load()

    expect(hooks.onReadDocument).toBeTypeOf('function')
  })

  it('ignores invalid hook exports', async () => {
    const projectDir = await makeProject('invalid')
    await writeFile(
      join(projectDir, 'openspec', 'openspecui.hooks.ts'),
      'export const onReadDocument = "not-a-function"\n',
      'utf-8'
    )

    const runtime = createHookRuntime(projectDir)
    const hooks = await runtime.load()

    expect(hooks.onReadDocument).toBeUndefined()
  })
})
