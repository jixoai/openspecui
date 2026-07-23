/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Measure controlled-directory metadata and content fingerprint cost.
 * 2. Compare fingerprint scans with the real Dashboard planning projection.
 * 3. Measure same-input repeat observations and changed-input miss behavior.
 * 4. Measure the fixed overhead of moving one digest operation to a Worker.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import {
  OpenSpecAdapter,
  projectTaskProjectionsFromMarkdownFiles,
  type ChangeFile,
} from '@openspecui/core'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Worker } from 'node:worker_threads'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { loadDashboardPlanningFacts } from '../src/dashboard-summary.js'

interface BenchArgs {
  dir: string
  iterations: number
}

interface FileEntry {
  relativePath: string
  absolutePath: string
  size: number
  mtimeNs: string
}

interface TimedResult<T> {
  value: T
  durationMs: number
}

interface WorkerDigestResult {
  digest: string
}

const workerSource = `
  const { createHash } = require('node:crypto')
  const { parentPort, workerData } = require('node:worker_threads')
  if (!parentPort || typeof workerData !== 'string') {
    throw new Error('Invalid digest worker input.')
  }
  const digest = createHash('sha256').update(workerData, 'utf8').digest('hex')
  parentPort.postMessage({ digest })
`

function isWorkerDigestResult(value: unknown): value is WorkerDigestResult {
  if (typeof value !== 'object' || value === null) return false
  const digest = Reflect.get(value, 'digest')
  return typeof digest === 'string' && digest.length === 64
}

async function listFiles(root: string, label: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = []

  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true })
    await Promise.all(
      children.map(async (child) => {
        const absolutePath = join(directory, child.name)
        if (child.isDirectory()) {
          await visit(absolutePath)
          return
        }
        if (!child.isFile()) return
        const fileStat = await stat(absolutePath, { bigint: true })
        entries.push({
          relativePath: `${label}/${relative(root, absolutePath)}`,
          absolutePath,
          size: Number(fileStat.size),
          mtimeNs: fileStat.mtimeNs.toString(),
        })
      })
    )
  }

  await visit(root)
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

async function listProjectFiles(roots: readonly string[]): Promise<FileEntry[]> {
  return (
    await Promise.all(
      roots.map((root, index) => listFiles(root, index === 0 ? 'specs' : 'changes'))
    )
  )
    .flat()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

function timed<T>(task: () => Promise<T>): Promise<TimedResult<T>> {
  const started = performance.now()
  return task().then((value) => ({ value, durationMs: performance.now() - started }))
}

async function contentFingerprint(files: readonly FileEntry[]): Promise<{
  digest: string
  bytes: number
}> {
  const hash = createHash('sha256')
  let bytes = 0
  for (const file of files) {
    const content = await readFile(file.absolutePath)
    bytes += content.byteLength
    hash.update(file.relativePath)
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
  }
  return { digest: hash.digest('hex'), bytes }
}

function metadataFingerprint(files: readonly FileEntry[]): { digest: string; bytes: number } {
  const hash = createHash('sha256')
  let bytes = 0
  for (const file of files) {
    const entry = `${file.relativePath}\0${file.size}\0${file.mtimeNs}\0`
    bytes += Buffer.byteLength(entry)
    hash.update(entry)
  }
  return { digest: hash.digest('hex'), bytes }
}

function inMemoryContentFingerprint(
  files: readonly FileEntry[],
  contents: readonly Buffer[]
): { digest: string; bytes: number } {
  if (files.length !== contents.length) {
    throw new RangeError('Fingerprint file/content counts must match.')
  }
  const hash = createHash('sha256')
  let bytes = 0
  files.forEach((file, index) => {
    const content = contents[index]
    bytes += content.byteLength
    hash.update(file.relativePath)
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
  })
  return { digest: hash.digest('hex'), bytes }
}

async function digestInWorker(content: string): Promise<string> {
  return new Promise<string>((resolveDigest, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: content })
    let settled = false
    const settle = (callback: () => void): void => {
      if (settled) return
      settled = true
      callback()
      void worker.terminate()
    }
    worker.once('message', (value: unknown) => {
      if (!isWorkerDigestResult(value)) {
        settle(() => reject(new Error('Digest worker returned an invalid result.')))
        return
      }
      settle(() => resolveDigest(value.digest))
    })
    worker.once('error', (error: Error) => settle(() => reject(error)))
    worker.once('exit', (code: number) => {
      if (code !== 0) settle(() => reject(new Error(`Digest worker exited with ${code}.`)))
    })
  })
}

async function main(): Promise<void> {
  const rawArgs = hideBin(process.argv).filter((arg) => arg !== '--')
  const cliArgs = rawArgs[0]?.endsWith('.bench.ts') ? rawArgs.slice(1) : rawArgs
  const argv = (await yargs(cliArgs)
    .option('dir', { type: 'string', default: '.' })
    .option('iterations', { type: 'number', default: 5 })
    .strict()
    .parse()) as BenchArgs
  if (!Number.isInteger(argv.iterations) || argv.iterations < 2) {
    throw new RangeError('iterations must be an integer >= 2')
  }

  const projectDir = resolve(process.cwd(), argv.dir)
  const roots = [join(projectDir, 'openspec', 'specs'), join(projectDir, 'openspec', 'changes')]
  const files = await listProjectFiles(roots)
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const fileContents = await Promise.all(files.map((file) => readFile(file.absolutePath)))
  const allContent = Buffer.concat(fileContents)
  const adapter = new OpenSpecAdapter(projectDir)

  const metadataRuns: number[] = []
  const contentRuns: number[] = []
  const inMemoryContentRuns: number[] = []
  const taskProjectionRuns: number[] = []
  const projectionRuns: number[] = []
  const metadataDigests: string[] = []
  const contentDigests: string[] = []
  const projectionCardinalities: Array<{ specs: number; changes: number; archives: number }> = []
  const textFiles: ChangeFile[] = (
    await Promise.all(
      files
        .filter((file) => /\.(?:md|markdown)$/i.test(file.relativePath))
        .map(async (file) => ({
          path: file.relativePath,
          type: 'file' as const,
          content: await readFile(file.absolutePath, 'utf8'),
        }))
    )
  ).sort((left, right) => left.path.localeCompare(right.path))
  for (let index = 0; index < argv.iterations; index += 1) {
    const metadata = await timed(async () => metadataFingerprint(await listProjectFiles(roots)))
    const content = await timed(async () => contentFingerprint(await listProjectFiles(roots)))
    const inMemoryContent = await timed(async () => inMemoryContentFingerprint(files, fileContents))
    const taskProjection = await timed(async () => {
      projectTaskProjectionsFromMarkdownFiles(textFiles)
    })
    const projection = await timed(() => loadDashboardPlanningFacts({ adapter }))
    metadataRuns.push(metadata.durationMs)
    contentRuns.push(content.durationMs)
    inMemoryContentRuns.push(inMemoryContent.durationMs)
    taskProjectionRuns.push(taskProjection.durationMs)
    projectionRuns.push(projection.durationMs)
    metadataDigests.push(metadata.value.digest)
    contentDigests.push(content.value.digest)
    projectionCardinalities.push({
      specs: projection.value.specMetas.length,
      changes: projection.value.allActiveChanges.length,
      archives: projection.value.archiveMetas.length,
    })
  }

  const mutationRoot = await mkdtemp(join(tmpdir(), 'openspecui-fingerprint-'))
  let changedInputMiss = false
  try {
    const source = files[0]
    if (!source) throw new Error('No files found for fingerprint mutation probe.')
    const copiedPath = join(mutationRoot, basename(source.absolutePath))
    const original = await readFile(source.absolutePath, 'utf8')
    await writeFile(copiedPath, original, 'utf8')
    const mutationFiles: FileEntry[] = [
      {
        relativePath: basename(copiedPath),
        absolutePath: copiedPath,
        size: Buffer.byteLength(original),
        mtimeNs: (await stat(copiedPath, { bigint: true })).mtimeNs.toString(),
      },
    ]
    const before = await contentFingerprint(mutationFiles)
    await writeFile(copiedPath, `${original}\n`, 'utf8')
    const after = await contentFingerprint([
      {
        ...mutationFiles[0],
        size: Buffer.byteLength(`${original}\n`),
        mtimeNs: (await stat(copiedPath, { bigint: true })).mtimeNs.toString(),
      },
    ])
    changedInputMiss = before.digest !== after.digest
  } finally {
    await rm(mutationRoot, { recursive: true, force: true })
  }

  const workerInput = allContent.toString('utf8')
  const worker = await timed(() => digestInWorker(workerInput))
  const mainDigest = createHash('sha256').update(workerInput, 'utf8').digest('hex')
  if (worker.value !== mainDigest) throw new Error('Worker digest differs from main-thread digest.')

  const metadataRepeatMatches = metadataDigests
    .slice(1)
    .filter((digest) => digest === metadataDigests[0]).length
  const contentRepeatMatches = contentDigests
    .slice(1)
    .filter((digest) => digest === contentDigests[0]).length
  process.stdout.write(
    `${JSON.stringify(
      {
        benchmark: 'projection-fingerprint-roi',
        projectDir,
        generatedAt: new Date().toISOString(),
        inventory: { roots, files: files.length, bytes: totalBytes },
        metadataManifest: {
          durationsMs: metadataRuns.map((duration) => Number(duration.toFixed(3))),
          digestBytes: metadataFingerprint(files).bytes,
          stableRepeatMatches: metadataRepeatMatches,
        },
        contentSha256: {
          durationsMs: contentRuns.map((duration) => Number(duration.toFixed(3))),
          inMemoryDurationsMs: inMemoryContentRuns.map((duration) => Number(duration.toFixed(3))),
          hashedBytes: totalBytes,
          digestBytes: 64,
          stableRepeatMatches: contentRepeatMatches,
          changedInputMiss,
        },
        dashboardPlanningProjection: {
          durationsMs: projectionRuns.map((duration) => Number(duration.toFixed(3))),
          cardinalities: projectionCardinalities,
        },
        markdownTaskProjection: {
          files: textFiles.length,
          bytes: textFiles.reduce(
            (sum, file) => sum + Buffer.byteLength(file.content ?? '', 'utf8'),
            0
          ),
          durationsMs: taskProjectionRuns.map((duration) => Number(duration.toFixed(3))),
        },
        worker: {
          inputBytes: Buffer.byteLength(workerInput),
          durationMs: Number(worker.durationMs.toFixed(3)),
          digestMatchesMainThread: worker.value === mainDigest,
        },
        interpretation: {
          unchangedMetadataObservationRate: `${metadataRepeatMatches}/${Math.max(argv.iterations - 1, 1)}`,
          unchangedContentObservationRate: `${contentRepeatMatches}/${Math.max(argv.iterations - 1, 1)}`,
          optimizationScope: 'measurement-only; no persistent/hash/Worker production cache enabled',
        },
      },
      null,
      2
    )}\n`
  )
}

await main()
