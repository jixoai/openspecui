import { OpenSpecAdapter } from '@openspecui/core'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ExportOptions {
  /** Project directory containing openspec/ */
  projectDir: string
  /** Output directory for static export */
  outputDir: string
  /** Base path for deployment (default: /) */
  basePath?: string
  /** Clean output directory before export */
  clean?: boolean
}

export interface ExportSnapshot {
  /** Snapshot metadata */
  meta: {
    timestamp: string
    version: string
    projectDir: string
  }
  /** Dashboard data */
  dashboard: {
    specsCount: number
    changesCount: number
    archivesCount: number
  }
  /** All specs with metadata */
  specs: Array<{
    id: string
    name: string
    content: string
    overview: string
    requirements: Array<{
      id: string
      text: string
      scenarios: Array<{ rawText: string }>
    }>
    createdAt: number
    updatedAt: number
  }>
  /** All changes with metadata */
  changes: Array<{
    id: string
    name: string
    proposal: string
    tasks?: string
    design?: string
    why: string
    whatChanges: string
    parsedTasks: Array<{
      id: string
      text: string
      completed: boolean
      section?: string
    }>
    deltas: Array<{
      capability: string
      content: string
    }>
    progress: { total: number; completed: number }
    createdAt: number
    updatedAt: number
  }>
  /** All archived changes */
  archives: Array<{
    id: string
    name: string
    proposal: string
    tasks?: string
    design?: string
    why: string
    whatChanges: string
    parsedTasks: Array<{
      id: string
      text: string
      completed: boolean
      section?: string
    }>
    createdAt: number
    updatedAt: number
  }>
  /** Project.md content */
  projectMd?: string
  /** AGENTS.md content */
  agentsMd?: string
}

/**
 * Generate a complete data snapshot of the OpenSpec project
 */
export async function generateSnapshot(projectDir: string): Promise<ExportSnapshot> {
  const adapter = new OpenSpecAdapter(projectDir)

  console.log('📊 Generating data snapshot...')

  // Check if initialized
  const isInit = await adapter.isInitialized()
  if (!isInit) {
    throw new Error(`OpenSpec not initialized in ${projectDir}`)
  }

  // Read package version
  const pkgPath = join(__dirname, '..', 'package.json')
  let version = '0.0.0'
  try {
    const pkgContent = await import(pkgPath, { with: { type: 'json' } })
    version = pkgContent.default.version || '0.0.0'
  } catch {
    // Fallback version
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
      if (!change) return null

      const files = await adapter.readChangeFiles(meta.id)
      const proposalFile = files.find((f) => f.path === 'proposal.md')
      const tasksFile = files.find((f) => f.path === 'tasks.md')
      const designFile = files.find((f) => f.path === 'design.md')

      // Get delta spec content
      const deltas = (change.deltaSpecs || []).map((ds) => ({
        capability: ds.specId,
        content: ds.content || '',
      }))

      return {
        id: meta.id,
        name: meta.name,
        proposal: proposalFile?.content || '',
        tasks: tasksFile?.content,
        design: designFile?.content,
        why: change.why || '',
        whatChanges: change.whatChanges || '',
        parsedTasks: change.tasks || [],
        deltas,
        progress: meta.progress,
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
  } catch (error) {
    // project.md is optional
    console.log('  ℹ No project.md found')
  }

  try {
    const agentsMdContent = await adapter.readAgentsMd()
    agentsMd = agentsMdContent ?? undefined
  } catch (error) {
    // AGENTS.md is optional
    console.log('  ℹ No AGENTS.md found')
  }

  const snapshot: ExportSnapshot = {
    meta: {
      timestamp: new Date().toISOString(),
      version,
      projectDir,
    },
    dashboard: {
      specsCount: specs.length,
      changesCount: changes.filter((c) => c !== null).length,
      archivesCount: archives.length,
    },
    specs,
    changes: changes.filter((c): c is NonNullable<typeof c> => c !== null),
    archives,
    projectMd,
    agentsMd,
  }

  console.log(`  ✓ ${specs.length} specs`)
  console.log(`  ✓ ${snapshot.changes.length} changes`)
  console.log(`  ✓ ${archives.length} archived changes`)

  return snapshot
}

/**
 * Get the path to the web build directory
 */
function getWebBuildDir(useCustomBuild: boolean = false): string {
  // If using a custom build (e.g., with custom base path), use the web package dist
  if (useCustomBuild) {
    const webDistPath = join(__dirname, '..', '..', 'web', 'dist')
    if (existsSync(webDistPath)) {
      return webDistPath
    }
  }

  // In production, web assets are in ./web
  // In development, we need to build first
  const prodPath = join(__dirname, '..', 'web')
  if (existsSync(prodPath)) {
    return prodPath
  }

  throw new Error(
    'Web assets not found. Please run `pnpm build` first to generate the static export.'
  )
}

/**
 * Export the OpenSpec UI as a static website
 */
export async function exportStaticSite(options: ExportOptions): Promise<void> {
  const { projectDir, outputDir, basePath = '/', clean = false } = options

  const resolvedOutputDir = resolve(outputDir)
  const resolvedProjectDir = resolve(projectDir)

  console.log('\n┌─────────────────────────────────────────────┐')
  console.log('│       OpenSpec UI Static Export             │')
  console.log('└─────────────────────────────────────────────┘\n')

  console.log(`📁 Project:  ${resolvedProjectDir}`)
  console.log(`📦 Output:   ${resolvedOutputDir}`)
  console.log(`🔗 Base path: ${basePath}\n`)

  const startTime = Date.now()
  let useCustomBuild = false

  try {
    // Step 1: Clean output directory if requested
    if (clean && existsSync(resolvedOutputDir)) {
      console.log('🧹 Cleaning output directory...')
      await rm(resolvedOutputDir, { recursive: true, force: true })
    }

    // Step 2: Create output directory
    await mkdir(resolvedOutputDir, { recursive: true })

    // Step 3: Generate data snapshot
    const snapshot = await generateSnapshot(resolvedProjectDir)

    // Check snapshot size and warn if too large
    const snapshotSize = JSON.stringify(snapshot).length
    const sizeMB = (snapshotSize / 1024 / 1024).toFixed(2)
    console.log(`📊 Snapshot size: ${sizeMB} MB`)
    if (snapshotSize > 10 * 1024 * 1024) {
      console.warn(`⚠️  Warning: Snapshot exceeds 10MB. Consider splitting large projects.`)
    }

    // Step 4: Build or rebuild web app if custom base path is specified
    if (basePath !== '/') {
      console.log(`🏗️  Building web app with base path ${basePath}...`)
      const webPkgDir = join(__dirname, '..', '..', 'web')
      const webDistDir = join(webPkgDir, 'dist')

      // Clean the dist directory first to avoid stale assets
      if (existsSync(webDistDir)) {
        console.log('  🧹 Cleaning previous build...')
        await rm(webDistDir, { recursive: true, force: true })
      }

      try {
        execSync('npm run build', {
          cwd: webPkgDir,
          env: {
            ...process.env,
            VITE_BASE_PATH: basePath,
          },
          stdio: 'inherit',
        })
        console.log('  ✓ Web app built successfully')
        useCustomBuild = true
      } catch (error) {
        console.error('\n  ❌ Failed to build web app with custom base path')
        console.error(
          '  💡 This usually means there are TypeScript errors or missing dependencies.'
        )
        console.error(`  📁 Build directory: ${webPkgDir}`)
        throw new Error('Web app build failed. See output above for details.')
      }
    }

    // Step 5: Write data snapshot
    console.log('💾 Writing data snapshot...')
    const snapshotPath = join(resolvedOutputDir, 'data.json')
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')

    // Step 6: Copy web build assets
    console.log('📋 Copying web assets...')
    const webBuildDir = getWebBuildDir(useCustomBuild)
    const files = await import('node:fs/promises').then((fs) => fs.readdir(webBuildDir))

    for (const file of files) {
      const srcPath = join(webBuildDir, file)
      const destPath = join(resolvedOutputDir, file)
      await cp(srcPath, destPath, { recursive: true })
    }

    // Step 6: Generate fallback routing files
    console.log('🔀 Generating routing fallback...')

    // Netlify _redirects
    const redirectsContent = `/*    /index.html   200\n`
    await writeFile(join(resolvedOutputDir, '_redirects'), redirectsContent, 'utf-8')

    // GitHub Pages 404.html (SPA fallback trick)
    const indexPath = join(resolvedOutputDir, 'index.html')
    if (existsSync(indexPath)) {
      await cp(indexPath, join(resolvedOutputDir, '404.html'))
    }

    // Step 7: Generate routes manifest
    console.log('📝 Generating routes manifest...')
    const routes = {
      core: ['/', '/specs', '/changes', '/archive', '/project', '/settings'],
      specs: snapshot.specs.map((s) => ({ id: s.id, name: s.name, path: `/specs/${s.id}` })),
      changes: snapshot.changes.map((c) => ({ id: c.id, name: c.name, path: `/changes/${c.id}` })),
      archives: snapshot.archives.map((a) => ({
        id: a.id,
        name: a.name,
        path: `/archive/${a.id}`,
      })),
    }
    await writeFile(
      join(resolvedOutputDir, 'routes.json'),
      JSON.stringify(routes, null, 2),
      'utf-8'
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const totalPages =
      routes.core.length + routes.specs.length + routes.changes.length + routes.archives.length

    console.log('\n✅ Export complete!')
    console.log(`⏱️  Time: ${duration}s`)
    console.log(`📄 Pages: ${totalPages}`)
    console.log(`📦 Output: ${resolvedOutputDir}\n`)
  } catch (error) {
    console.error('\n❌ Export failed:', error)
    throw error
  }
}
