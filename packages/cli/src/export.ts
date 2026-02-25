import {
  CliExecutor,
  ConfigManager,
  DEFAULT_CONFIG,
  OpenSpecAdapter,
  SchemaDetailSchema,
  SchemaInfoSchema,
  SchemaResolutionSchema,
  TemplatesSchema,
  toOpsxDisplayPath,
  type ExportSnapshot,
  type SchemaDetail,
  type SchemaInfo,
  type SchemaResolution,
  type TemplatesMap,
} from '@openspecui/core'
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { parse as parseYaml } from 'yaml'
import pkg from '../package.json' with { type: 'json' }

const __dirname = dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)

export type ExportFormat = 'html' | 'json'

export interface ExportOptions {
  /** Project directory containing openspec/ */
  projectDir: string
  /** Output directory for static export */
  outputDir: string
  /** Export format: 'html' (default) or 'json' */
  format?: ExportFormat
  /** Base path for deployment (html only) */
  basePath?: string
  /** Clean output directory before export */
  clean?: boolean
  /** Start preview server and open in browser (html only) */
  open?: boolean
  /** Port for preview server */
  previewPort?: number
  /** Host for preview server */
  previewHost?: string
}

// Re-export ExportSnapshot from core for backwards compatibility
export type { ExportSnapshot } from '@openspecui/core'

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } }

function parseCliJson<T>(
  raw: string,
  schema: { safeParse: (value: unknown) => SafeParseResult<T> },
  label: string
): T {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(`${label} returned empty output`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`${label} returned invalid JSON: ${message}`)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`${label} returned unexpected JSON: ${result.error.message}`)
  }
  return result.data
}

function parseSchemaYaml(content: string): SchemaDetail {
  const raw = parseYaml(content) as unknown
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid schema.yaml: expected YAML object')
  }

  const schemaObj = raw as Record<string, unknown>
  const artifactsRaw = Array.isArray(schemaObj.artifacts) ? schemaObj.artifacts : []
  const artifacts = artifactsRaw.map((artifact) => {
    if (!artifact || typeof artifact !== 'object') {
      throw new Error('Invalid schema.yaml: artifacts must be objects')
    }
    const artifactObj = artifact as Record<string, unknown>
    const id = typeof artifactObj.id === 'string' ? artifactObj.id : ''
    const generates = typeof artifactObj.generates === 'string' ? artifactObj.generates : ''
    const description =
      typeof artifactObj.description === 'string' ? artifactObj.description : undefined
    const template = typeof artifactObj.template === 'string' ? artifactObj.template : undefined
    const instruction =
      typeof artifactObj.instruction === 'string' ? artifactObj.instruction : undefined
    const requires = Array.isArray(artifactObj.requires)
      ? artifactObj.requires.filter((value): value is string => typeof value === 'string')
      : []

    return {
      id,
      outputPath: generates,
      description,
      template,
      instruction,
      requires,
    }
  })

  const apply = schemaObj.apply
  const applyObj = apply && typeof apply === 'object' ? (apply as Record<string, unknown>) : {}
  const applyRequires = Array.isArray(applyObj.requires)
    ? applyObj.requires.filter((value): value is string => typeof value === 'string')
    : []
  const applyTracks = typeof applyObj.tracks === 'string' ? applyObj.tracks : undefined
  const applyInstruction =
    typeof applyObj.instruction === 'string' ? applyObj.instruction : undefined

  const detail = {
    name: typeof schemaObj.name === 'string' ? schemaObj.name : '',
    description: typeof schemaObj.description === 'string' ? schemaObj.description : undefined,
    version:
      typeof schemaObj.version === 'string' || typeof schemaObj.version === 'number'
        ? schemaObj.version
        : undefined,
    artifacts,
    applyRequires,
    applyTracks,
    applyInstruction,
  }

  const validated = SchemaDetailSchema.safeParse(detail)
  if (!validated.success) {
    throw new Error(`Invalid schema.yaml detail: ${validated.error.message}`)
  }
  return validated.data
}

function isAbsoluteFsPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)
}

function toAbsoluteProjectPath(projectDir: string, path: string): string {
  return isAbsoluteFsPath(path) ? path : resolve(projectDir, path)
}

type SnapshotGitCommit = NonNullable<ExportSnapshot['git']>['recentCommits'][number]

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function parseRelatedChanges(paths: string[]): string[] {
  const related = new Set<string>()

  for (const rawPath of paths) {
    const path = normalizeGitPath(rawPath)
    const activeMatch = /^openspec\/changes\/([^/]+)\//.exec(path)
    if (activeMatch?.[1]) {
      related.add(activeMatch[1])
      continue
    }

    const archiveMatch = /^openspec\/changes\/archive\/([^/]+)\//.exec(path)
    if (archiveMatch?.[1]) {
      related.add(archiveMatch[1].replace(/^\d{4}-\d{2}-\d{2}-/, ''))
    }
  }

  return [...related].sort((a, b) => a.localeCompare(b))
}

function parseNumstat(numstatOutput: string): {
  files: number
  insertions: number
  deletions: number
} {
  let files = 0
  let insertions = 0
  let deletions = 0

  for (const line of numstatOutput.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const [addRaw, delRaw] = trimmed.split('\t')
    if (!addRaw || !delRaw) continue
    files += 1
    if (addRaw !== '-') insertions += Number(addRaw) || 0
    if (delRaw !== '-') deletions += Number(delRaw) || 0
  }

  return { files, insertions, deletions }
}

async function readDefaultBranch(projectDir: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
      {
        cwd: projectDir,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      }
    )
    const branch = stdout.trim()
    if (branch.length > 0) return branch
  } catch {
    // ignore and fallback
  }

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    const branch = stdout.trim()
    if (branch.length > 0 && branch !== 'HEAD') return branch
  } catch {
    // ignore and fallback
  }

  return 'main'
}

function parseRecentCommitLog(output: string): SnapshotGitCommit[] {
  const commits: SnapshotGitCommit[] = []
  let current: {
    hash: string
    title: string
    committedAt: number
    numstatLines: string[]
    changedPaths: string[]
  } | null = null

  const pushCurrent = () => {
    if (!current) return
    commits.push({
      hash: current.hash,
      title: current.title,
      committedAt: current.committedAt,
      relatedChanges: parseRelatedChanges(current.changedPaths),
      diff: parseNumstat(current.numstatLines.join('\n')),
    })
    current = null
  }

  for (const line of output.split('\n')) {
    if (line.startsWith('__COMMIT__\t')) {
      pushCurrent()
      const [_, hash, tsRaw, ...titleParts] = line.split('\t')
      const committedAt = Number(tsRaw) * 1000
      current = {
        hash: hash ?? '',
        title: titleParts.join('\t').trim() || (hash ? hash.slice(0, 8) : 'commit'),
        committedAt: Number.isFinite(committedAt) && committedAt > 0 ? committedAt : 0,
        numstatLines: [],
        changedPaths: [],
      }
      continue
    }

    if (!current) continue
    const trimmed = line.trim()
    if (!trimmed) continue

    const [addRaw, delRaw, ...pathParts] = trimmed.split('\t')
    if (!addRaw || !delRaw || pathParts.length === 0) continue
    const path = pathParts.join('\t')
    current.numstatLines.push(`${addRaw}\t${delRaw}\t${path}`)
    current.changedPaths.push(path)
  }

  pushCurrent()
  return commits.filter((commit) => commit.hash.length > 0)
}

function normalizeRepositoryUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\.git$/i, '')
  }

  const gitAtMatch = /^git@([^:]+):(.+)$/.exec(value)
  if (gitAtMatch?.[1] && gitAtMatch[2]) {
    return `https://${gitAtMatch[1]}/${gitAtMatch[2].replace(/\.git$/i, '')}`
  }

  if (value.startsWith('ssh://')) {
    try {
      const parsed = new URL(value)
      const pathname = parsed.pathname.replace(/^\/+/, '').replace(/\.git$/i, '')
      if (!pathname) return null
      return `https://${parsed.hostname}/${pathname}`
    } catch {
      // ignore and fallback to raw value below
    }
  }

  return value.replace(/\.git$/i, '')
}

async function readSnapshotGit(projectDir: string): Promise<ExportSnapshot['git']> {
  try {
    const defaultBranch = await readDefaultBranch(projectDir)
    const { stdout: latestTsRaw } = await execFileAsync('git', ['log', '-1', '--format=%ct'], {
      cwd: projectDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    const latestSeconds = Number(latestTsRaw.trim())
    const latestCommitTs =
      Number.isFinite(latestSeconds) && latestSeconds > 0 ? latestSeconds * 1000 : null

    let repositoryUrl: string | null = null
    try {
      const { stdout: remoteRaw } = await execFileAsync(
        'git',
        ['config', '--get', 'remote.origin.url'],
        {
          cwd: projectDir,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        }
      )
      repositoryUrl = normalizeRepositoryUrl(remoteRaw)
    } catch {
      repositoryUrl = null
    }

    const { stdout: logOutput } = await execFileAsync(
      'git',
      ['log', '-n', '5', '--format=__COMMIT__%x09%H%x09%ct%x09%s', '--numstat', '--'],
      {
        cwd: projectDir,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      }
    )

    return {
      defaultBranch,
      repositoryUrl,
      latestCommitTs,
      recentCommits: parseRecentCommitLog(logOutput),
    }
  } catch {
    return undefined
  }
}

/**
 * Generate a complete data snapshot of the OpenSpec project
 * (Kept for backwards compatibility and testing)
 */
export async function generateSnapshot(projectDir: string): Promise<ExportSnapshot> {
  const adapter = new OpenSpecAdapter(projectDir)
  const configManager = new ConfigManager(projectDir)
  const cliExecutor = new CliExecutor(configManager, projectDir)
  const uiConfig = await configManager.readConfig().catch(() => DEFAULT_CONFIG)

  // Check if initialized
  const isInit = await adapter.isInitialized()
  if (!isInit) {
    throw new Error(`OpenSpec not initialized in ${projectDir}`)
  }

  // Get all specs with parsed content
  const specsMeta = await adapter.listSpecsWithMeta()
  const specs = await Promise.all(
    specsMeta.map(async (meta) => {
      const raw = await adapter.readSpecRaw(meta.id)
      const parsed = await adapter.readSpec(meta.id)
      return {
        id: meta.id,
        name: meta.name,
        content: raw || '',
        overview: parsed?.overview || '',
        requirements: parsed?.requirements || [],
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
      }
    })
  )

  // Get all changes with parsed content
  const changesMeta = await adapter.listChangesWithMeta()
  const changes = await Promise.all(
    changesMeta.map(async (meta) => {
      const change = await adapter.readChange(meta.id)

      const files = await adapter.readChangeFiles(meta.id)
      const proposalFile = files.find((f) => f.path === 'proposal.md')
      const tasksFile = files.find((f) => f.path === 'tasks.md')
      const designFile = files.find((f) => f.path === 'design.md')

      // Get delta spec content
      const deltas = (change?.deltaSpecs || []).map((ds) => ({
        capability: ds.specId,
        content: ds.content || '',
      }))

      return {
        id: meta.id,
        name: meta.name,
        proposal: proposalFile?.content || '',
        tasks: tasksFile?.content,
        design: designFile?.content,
        why: change?.why || '',
        whatChanges: change?.whatChanges || '',
        parsedTasks: change?.tasks || [],
        deltas,
        progress: change?.progress ?? meta.progress,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
      }
    })
  )

  // Get all archives with parsed content
  const archivesMeta = await adapter.listArchivedChangesWithMeta()
  const archives = await Promise.all(
    archivesMeta.map(async (meta) => {
      const files = await adapter.readArchivedChangeFiles(meta.id)
      const proposalFile = files.find((f) => f.path === 'proposal.md')
      const tasksFile = files.find((f) => f.path === 'tasks.md')
      const designFile = files.find((f) => f.path === 'design.md')

      // Parse the proposal to extract why and whatChanges
      const change = await adapter.readArchivedChange(meta.id)

      return {
        id: meta.id,
        name: meta.name || meta.id,
        proposal: proposalFile?.content || '',
        tasks: tasksFile?.content,
        design: designFile?.content,
        why: change?.why || '',
        whatChanges: change?.whatChanges || '',
        parsedTasks: change?.tasks || [],
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
      }
    })
  )

  // Get project.md and AGENTS.md
  let projectMd: string | undefined
  let agentsMd: string | undefined

  try {
    const projectMdContent = await adapter.readProjectMd()
    projectMd = projectMdContent ?? undefined
  } catch {
    // project.md is optional
  }

  try {
    const agentsMdContent = await adapter.readAgentsMd()
    agentsMd = agentsMdContent ?? undefined
  } catch {
    // AGENTS.md is optional
  }

  // OPSX config snapshot
  let configYaml: string | undefined
  let schemas: SchemaInfo[] = []
  const schemaDetails: Record<string, SchemaDetail> = {}
  const schemaYamls: Record<string, string> = {}
  const schemaResolutions: Record<string, SchemaResolution> = {}
  const templates: Record<string, TemplatesMap> = {}
  const templateContents: Record<
    string,
    Record<
      string,
      {
        content: string | null
        path: string
        displayPath?: string
        source: 'project' | 'user' | 'package'
      }
    >
  > = {}
  const changeMetadata: Record<string, string | null> = {}

  try {
    const configPath = join(projectDir, 'openspec', 'config.yaml')
    configYaml = await readFile(configPath, 'utf-8')
  } catch {
    configYaml = undefined
  }

  try {
    const schemasResult = await cliExecutor.schemas()
    if (schemasResult.success) {
      schemas = parseCliJson(schemasResult.stdout, SchemaInfoSchema.array(), 'openspec schemas')
    }
  } catch {
    schemas = []
  }

  for (const schema of schemas) {
    try {
      const resolutionResult = await cliExecutor.schemaWhich(schema.name)
      if (resolutionResult.success) {
        const resolution = parseCliJson(
          resolutionResult.stdout,
          SchemaResolutionSchema,
          'openspec schema which'
        )
        schemaResolutions[schema.name] = {
          ...resolution,
          displayPath: toOpsxDisplayPath(resolution.path, {
            source: resolution.source,
            projectDir,
          }),
          shadows: resolution.shadows.map((shadow) => ({
            ...shadow,
            displayPath: toOpsxDisplayPath(shadow.path, {
              source: shadow.source,
              projectDir,
            }),
          })),
        }
        try {
          const schemaPath = join(resolution.path, 'schema.yaml')
          const schemaContent = await readFile(schemaPath, 'utf-8')
          schemaDetails[schema.name] = parseSchemaYaml(schemaContent)
          schemaYamls[schema.name] = schemaContent
        } catch {
          // Skip invalid schema detail
        }
      }
    } catch {
      // Skip schema resolution errors
    }

    try {
      const templatesResult = await cliExecutor.templates(schema.name)
      if (templatesResult.success) {
        const parsedTemplates = parseCliJson(
          templatesResult.stdout,
          TemplatesSchema,
          'openspec templates'
        )
        const normalizedTemplates = Object.fromEntries(
          Object.entries(parsedTemplates).map(([artifactId, info]) => [
            artifactId,
            {
              ...info,
              path: toAbsoluteProjectPath(projectDir, info.path),
              displayPath: toOpsxDisplayPath(info.path, {
                source: info.source,
                projectDir,
              }),
            },
          ])
        )
        templates[schema.name] = normalizedTemplates
        const contents = await Promise.all(
          Object.entries(normalizedTemplates).map(async ([artifactId, info]) => {
            let content: string | null = null
            try {
              content = await readFile(info.path, 'utf-8')
            } catch {
              content = null
            }
            return [
              artifactId,
              {
                content,
                path: info.path,
                displayPath: info.displayPath,
                source: info.source,
              },
            ] as const
          })
        )
        templateContents[schema.name] = Object.fromEntries(contents)
      }
    } catch {
      // Skip templates errors
    }
  }

  try {
    const changeIds = await adapter.listChanges()
    for (const changeId of changeIds) {
      try {
        const metaPath = join(projectDir, 'openspec', 'changes', changeId, '.openspec.yaml')
        const metaContent = await readFile(metaPath, 'utf-8')
        changeMetadata[changeId] = metaContent
      } catch {
        changeMetadata[changeId] = null
      }
    }
  } catch {
    // ignore change metadata errors
  }

  const git = await readSnapshotGit(projectDir)

  const snapshot: ExportSnapshot = {
    meta: {
      timestamp: new Date().toISOString(),
      version: pkg.version,
      projectDir,
    },
    dashboard: {
      specsCount: specs.length,
      changesCount: changes.filter((c) => c !== null).length,
      archivesCount: archives.length,
    },
    git,
    config: uiConfig,
    specs,
    changes,
    archives,
    projectMd,
    agentsMd,
    opsx: {
      configYaml,
      schemas,
      schemaDetails,
      schemaYamls,
      schemaResolutions,
      templates,
      templateContents,
      changeMetadata,
    },
  }

  return snapshot
}

/**
 * Check if running in local monorepo development mode
 * Returns the path to web package root if available, null otherwise
 */
function findLocalWebPackage(): string | null {
  // Check for local development - packages/cli/src -> packages/web
  const localWebPkg = join(__dirname, '..', '..', 'web', 'package.json')
  if (existsSync(localWebPkg)) {
    return join(__dirname, '..', '..', 'web')
  }
  return null
}

/**
 * Run a command and wait for it to complete
 */
function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd, shell: false })
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`Command failed with exit code ${code}`))
    })
    child.on('error', (err) => reject(err))
  })
}

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno'

type MinimalPackageJson = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const LOCAL_PACKAGE_PROTOCOLS = ['workspace:', 'file:', 'link:'] as const

/**
 * Detect the package manager used in the current project
 */
function detectPackageManager(): PackageManager {
  // Deno sets DENO_VERSION environment variable
  if (process.env.DENO_VERSION) return 'deno'

  // npm_config_user_agent format: "pnpm/9.0.0 node/v20.10.0 darwin arm64"
  const userAgent = process.env.npm_config_user_agent
  if (userAgent) {
    if (userAgent.startsWith('bun')) return 'bun'
    if (userAgent.startsWith('pnpm')) return 'pnpm'
    if (userAgent.startsWith('yarn')) return 'yarn'
    if (userAgent.startsWith('npm')) return 'npm'
    if (userAgent.startsWith('deno')) return 'deno'
  }

  // Fallback: check lockfiles
  if (existsSync('deno.lock')) return 'deno'
  if (existsSync('bun.lockb') || existsSync('bun.lock')) return 'bun'
  if (existsSync('pnpm-lock.yaml')) return 'pnpm'
  if (existsSync('yarn.lock')) return 'yarn'
  return 'npm'
}

/**
 * Get the command to run a binary in a package-manager agnostic way.
 */
function getRunCommand(pm: PackageManager, bin: string): { cmd: string; args: string[] } {
  switch (pm) {
    case 'bun':
      return { cmd: 'bunx', args: [bin] }
    case 'pnpm':
      return { cmd: 'pnpm', args: ['dlx', bin] }
    case 'yarn':
      return { cmd: 'yarn', args: ['dlx', bin] }
    case 'deno':
      return { cmd: 'deno', args: ['run', '-A', `npm:${bin}`] }
    default:
      return { cmd: 'npx', args: [bin] }
  }
}

export function findNearestPackageJson(startDir: string): string | null {
  let currentDir = startDir
  while (true) {
    const packageJsonPath = join(currentDir, 'package.json')
    if (existsSync(packageJsonPath)) {
      return packageJsonPath
    }
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      return null
    }
    currentDir = parentDir
  }
}

export function readWebPackageRangeFromPackageJson(startDir: string): string | null {
  const packageJsonPath = findNearestPackageJson(startDir)
  if (!packageJsonPath) {
    return null
  }
  try {
    const packageJsonRaw = readFileSync(packageJsonPath, 'utf-8')
    const parsed = JSON.parse(packageJsonRaw) as MinimalPackageJson
    return (
      parsed.dependencies?.['@openspecui/web'] ??
      parsed.devDependencies?.['@openspecui/web'] ??
      parsed.peerDependencies?.['@openspecui/web'] ??
      parsed.optionalDependencies?.['@openspecui/web'] ??
      null
    )
  } catch {
    return null
  }
}

export function isLocalPackageRange(range: string | null): boolean {
  if (!range) return false
  return LOCAL_PACKAGE_PROTOCOLS.some((protocol) => range.startsWith(protocol))
}

/**
 * Get the exec command for running a package binary
 * Uses appropriate flags to ensure the correct version of @openspecui/web is installed
 */
function getExecCommand(pm: PackageManager, webPkgSpec: string): { cmd: string; args: string[] } {
  switch (pm) {
    case 'bun':
      // bunx -p @openspecui/web@version openspecui-ssg
      return { cmd: 'bunx', args: ['-p', webPkgSpec, 'openspecui-ssg'] }
    case 'pnpm':
      // pnpm dlx @openspecui/web@version --package @openspecui/web@version openspecui-ssg
      // Note: pnpm dlx runs the bin from the package directly
      return { cmd: 'pnpm', args: ['dlx', webPkgSpec] }
    case 'yarn':
      // yarn dlx @openspecui/web@version
      return { cmd: 'yarn', args: ['dlx', webPkgSpec] }
    case 'deno':
      // deno run -A npm:@openspecui/web@version/openspecui-ssg
      return { cmd: 'deno', args: ['run', '-A', `npm:${webPkgSpec}/openspecui-ssg`] }
    default:
      // npx -p @openspecui/web@version openspecui-ssg
      return { cmd: 'npx', args: ['-p', webPkgSpec, 'openspecui-ssg'] }
  }
}

/**
 * Export as JSON only (data.json)
 */
async function exportJson(options: ExportOptions): Promise<void> {
  const { projectDir, outputDir, clean } = options

  if (clean && existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true })
  }
  mkdirSync(outputDir, { recursive: true })

  console.log('Generating data snapshot...')
  const snapshot = await generateSnapshot(projectDir)
  const dataJsonPath = join(outputDir, 'data.json')
  writeFileSync(dataJsonPath, JSON.stringify(snapshot, null, 2))
  console.log(`\nExported to ${dataJsonPath}`)
  console.log(`  Specs: ${snapshot.specs.length}`)
  console.log(`  Changes: ${snapshot.changes.length}`)
  console.log(`  Archives: ${snapshot.archives.length}`)
}

/**
 * Export as static HTML site
 */
async function exportHtml(options: ExportOptions): Promise<void> {
  const { projectDir, outputDir, basePath = '/', clean, open, previewPort, previewHost } = options

  if (clean && existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true })
  }
  mkdirSync(outputDir, { recursive: true })

  // 1. Generate data.json
  console.log('Generating data snapshot...')
  const snapshot = await generateSnapshot(projectDir)
  const dataJsonPath = join(outputDir, 'data.json')
  writeFileSync(dataJsonPath, JSON.stringify(snapshot, null, 2))
  console.log(`Data snapshot written to ${dataJsonPath}`)

  // 2. Run SSG
  const localWebPkg = findLocalWebPackage()
  const webPackageRange = readWebPackageRangeFromPackageJson(__dirname)
  const localRangeMode = isLocalPackageRange(webPackageRange)

  if (localRangeMode) {
    if (!localWebPkg) {
      throw new Error(
        `Detected local/dev @openspecui/web range "${webPackageRange}" but local web package was not found`
      )
    }

    // Local development: run SSG CLI directly via tsx
    console.log('\n[Local dev mode] Running SSG from local web package...')
    const ssgCli = join(localWebPkg, 'src', 'ssg', 'cli.ts')
    await runCommand(
      'pnpm',
      ['tsx', ssgCli, '--data', dataJsonPath, '--output', outputDir, '--base-path', basePath],
      localWebPkg
    )
  } else {
    // Production: call the bundled SSG CLI from @openspecui/web
    console.log('\n[Production mode] Running SSG via @openspecui/web...')

    const pm = detectPackageManager()
    const webPkgSpec = `@openspecui/web@${webPackageRange || pkg.version}`
    const execCmd = getExecCommand(pm, webPkgSpec)

    try {
      await runCommand(
        execCmd.cmd,
        [...execCmd.args, '--data', dataJsonPath, '--output', outputDir, '--base-path', basePath],
        process.cwd()
      )
    } catch (err) {
      console.error('\nSSG failed. Make sure @openspecui/web is installed:')
      console.error(`  ${pm} add @openspecui/web`)
      throw err
    }
  }

  console.log(`\nExport complete: ${outputDir}`)

  // 3. Start preview server if requested
  if (open) {
    console.log('\nStarting preview server...')
    const viteArgs = ['preview', '--outDir', resolve(outputDir)]
    if (previewPort) viteArgs.push('--port', String(previewPort))
    if (previewHost) viteArgs.push('--host', previewHost)
    viteArgs.push('--open')

    const pm = detectPackageManager()
    const { cmd, args } = getRunCommand(pm, 'vite')
    await runCommand(cmd, [...args, ...viteArgs], outputDir)
  }
}

/**
 * Export the OpenSpec project
 *
 * @param options Export options
 * @param options.format 'html' (default) - full static site, 'json' - data only
 */
export async function exportStaticSite(options: ExportOptions): Promise<void> {
  const format = options.format || 'html'

  if (format === 'json') {
    await exportJson(options)
  } else {
    await exportHtml(options)
  }
}
