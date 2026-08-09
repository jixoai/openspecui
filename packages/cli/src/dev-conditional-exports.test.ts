/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Prove source-mode conditional exports select TypeScript while published default resolves dist.
 * 2. Prove source startup and CLI Web asset projection are shell-independent across Windows and POSIX.
 * 3. Prove CLI source runtime dependencies remain workspace-only development dependencies.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 * Windows correction (2026-08-04): use a directory junction when symlink privileges are unavailable.
 */
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..', '..')
const execFileAsync = promisify(execFile)
const tempDirs: string[] = []

interface ConditionalExport {
  development?: string
  import?: string
  types?: string
  default?: string
}

interface PackageJson {
  name: string
  exports?: Record<string, ConditionalExport>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(relativePath: string): PackageJson {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8')) as PackageJson
}

async function createConditionalExportFixture(): Promise<{ appDir: string }> {
  const rootDir = await mkdtemp(join(tmpdir(), 'openspecui-dev-exports-'))
  tempDirs.push(rootDir)

  const packageDir = join(rootDir, 'packages', 'fixture-package')
  const appDir = join(rootDir, 'app')
  await mkdir(join(packageDir, 'src'), { recursive: true })
  await mkdir(join(packageDir, 'dist'), { recursive: true })
  await mkdir(join(appDir, 'node_modules'), { recursive: true })
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-package',
        type: 'module',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.mjs',
          },
          './worker': {
            development: './src/worker.ts',
            default: './dist/worker.mjs',
          },
        },
      },
      null,
      2
    ),
    'utf8'
  )
  await writeFile(join(packageDir, 'src', 'index.ts'), 'export const mode = "source"\n', 'utf8')
  await writeFile(join(packageDir, 'src', 'worker.ts'), 'export const mode = "source"\n', 'utf8')
  await writeFile(join(packageDir, 'dist', 'index.mjs'), 'export const mode = "dist"\n', 'utf8')
  await writeFile(join(packageDir, 'dist', 'worker.mjs'), 'export const mode = "dist"\n', 'utf8')
  await symlink(
    packageDir,
    join(appDir, 'node_modules', 'fixture-package'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )

  return { appDir }
}

async function resolveFixturePackage(
  appDir: string,
  specifier: 'fixture-package' | 'fixture-package/worker',
  conditions: string[] = []
): Promise<string> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      ...conditions,
      '--input-type=module',
      '--eval',
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    { cwd: appDir }
  )

  return stdout.trim()
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function expectDevelopmentExport(
  packageJson: PackageJson,
  exportPath: string,
  expectedDevelopment: string,
  expectedDefault: string
): void {
  const entry = packageJson.exports?.[exportPath]
  expect(entry).toMatchObject({
    development: expectedDevelopment,
    default: expectedDefault,
  })
}

describe('development conditional exports', () => {
  it('keeps default package exports on dist while exposing source entries for development', () => {
    const cliPackage = readPackageJson('packages/cli/package.json')
    const serverPackage = readPackageJson('packages/server/package.json')
    const corePackage = readPackageJson('packages/core/package.json')

    expectDevelopmentExport(cliPackage, '.', './src/index.ts', './dist/index.mjs')
    expectDevelopmentExport(cliPackage, './hooks', './src/hooks.ts', './dist/hooks.mjs')
    expectDevelopmentExport(serverPackage, '.', './src/index.ts', './dist/index.mjs')
    expectDevelopmentExport(corePackage, '.', './src/index.ts', './dist/index.mjs')
    expectDevelopmentExport(
      corePackage,
      './notifications',
      './src/notifications.ts',
      './dist/notifications.mjs'
    )
    expectDevelopmentExport(corePackage, './sounds', './src/sounds.ts', './dist/sounds.mjs')
    expectDevelopmentExport(
      corePackage,
      './opsx-schema-detail',
      './src/opsx-schema-detail.ts',
      './dist/opsx-schema-detail.mjs'
    )

    const searchPackage = readPackageJson('packages/search/package.json')
    expectDevelopmentExport(searchPackage, '.', './src/index.ts', './dist/index.mjs')
    expectDevelopmentExport(searchPackage, './node', './src/node.ts', './dist/node.mjs')
  })

  it('uses shell-independent source dev and CLI Web asset projection scripts', () => {
    const cliPackage = readPackageJson('packages/cli/package.json')
    const serverPackage = readPackageJson('packages/server/package.json')

    expect(cliPackage.scripts?.dev).toBe('tsx --conditions=development src/cli.ts')
    expect(serverPackage.scripts?.dev).toBe(
      "tsx watch --conditions=development --include '../core/dist/**' --include '../search/dist/**' src/standalone.ts"
    )
    expect(cliPackage.scripts?.['build:copy-web']).toBe('bun scripts/copy-web-assets.ts')

    for (const command of [
      cliPackage.scripts?.dev,
      serverPackage.scripts?.dev,
      cliPackage.scripts?.['build:copy-web'],
    ]) {
      expect(command).not.toContain('NODE_OPTIONS=')
      expect(command).not.toMatch(/(?:^|&&\s*)(?:rm|cp)\s/)
    }
  })

  it('declares source-runtime workspace dependencies for the CLI package', () => {
    const cliPackage = readPackageJson('packages/cli/package.json')

    expect(cliPackage.devDependencies).toMatchObject({
      '@openspecui/core': 'workspace:*',
      '@openspecui/server': 'workspace:*',
    })
    expect(cliPackage.dependencies).not.toHaveProperty('@openspecui/server')
  })

  it('resolves package self-references to dist by default', async () => {
    const fixture = await createConditionalExportFixture()

    await expect(resolveFixturePackage(fixture.appDir, 'fixture-package')).resolves.toMatch(
      /\/dist\/index\.mjs$/
    )
    await expect(resolveFixturePackage(fixture.appDir, 'fixture-package/worker')).resolves.toMatch(
      /\/dist\/worker\.mjs$/
    )
  })

  it('resolves package self-references to TypeScript source with the development condition', async () => {
    const fixture = await createConditionalExportFixture()

    await expect(
      resolveFixturePackage(fixture.appDir, 'fixture-package', ['--conditions=development'])
    ).resolves.toMatch(/\/src\/index\.ts$/)
    await expect(
      resolveFixturePackage(fixture.appDir, 'fixture-package/worker', ['--conditions=development'])
    ).resolves.toMatch(/\/src\/worker\.ts$/)
  })
})
