import {
  MarkdownParser,
  OPENSPECUI_HOOKS_VERSION,
  type Change,
  type ChangeFile,
  type DeltaSpec,
  type DocumentConsumerV1,
  type DocumentReadModeV1,
  type DocumentRefV1,
  type OpenSpecAdapter,
  type ReadDocumentResultV1,
  type Spec,
} from '@openspecui/core'
import { join, matchesGlob } from 'node:path'
import type { HookRuntime } from './hook-runtime.js'

type RawChangeDocuments = {
  proposal: ReadDocumentResultV1 & { sourceMarkdown: string }
  tasks: ReadDocumentResultV1 & { sourceMarkdown: string }
  design?: ReadDocumentResultV1 & { sourceMarkdown: string }
  deltaSpecs: Array<DeltaSpec & { sourceContent?: string }>
}

export type ReadSpecDocumentResult = ReadDocumentResultV1 & { sourceMarkdown: string }

type StageChangeFile = ChangeFile & { type: 'file'; content: string }

function toErrorDiagnostic(error: unknown) {
  return {
    level: 'error' as const,
    message: error instanceof Error ? error.message : String(error),
  }
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function normalizeChangeFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

export class DocumentService {
  private readonly parser = new MarkdownParser()

  constructor(
    private readonly projectDir: string,
    private readonly adapter: OpenSpecAdapter,
    private readonly hookRuntime: HookRuntime
  ) {}

  async readProjectMd(
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<ReadDocumentResultV1 | null> {
    const source = await this.adapter.readProjectMd()
    if (source === null) return null

    return this.processDocument({
      consumer,
      mode,
      document: {
        stage: 'project',
        kind: 'project',
        relativePath: 'openspec/project.md',
        absolutePath: join(this.projectDir, 'openspec', 'project.md'),
      },
      source,
    })
  }

  async readSpecRaw(
    specId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<ReadSpecDocumentResult | null> {
    const source = await this.adapter.readSpecRaw(specId)
    if (source === null) return null

    return this.processDocument({
      consumer,
      mode,
      document: {
        stage: 'main',
        kind: 'spec',
        specId,
        relativePath: `openspec/specs/${specId}/spec.md`,
        absolutePath: join(this.projectDir, 'openspec', 'specs', specId, 'spec.md'),
      },
      source,
    })
  }

  async readSpec(
    specId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<Spec | null> {
    try {
      const content = await this.readSpecRaw(specId, consumer, mode)
      if (!content) return null
      return this.parser.parseSpec(specId, content.markdown)
    } catch {
      return null
    }
  }

  async readChangeRaw(
    changeId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<RawChangeDocuments | null> {
    const raw = await this.adapter.readChangeRaw(changeId)
    if (!raw) return null

    const process = (kind: DocumentRefV1['kind'], relativePath: string, source: string) =>
      this.processDocument({
        consumer,
        mode,
        document: {
          stage: 'change',
          kind,
          changeId,
          relativePath,
          absolutePath: join(this.projectDir, relativePath),
        },
        source,
      })

    const [proposal, tasks, design, deltaSpecs] = await Promise.all([
      process('proposal', `openspec/changes/${changeId}/proposal.md`, raw.proposal),
      process('tasks', `openspec/changes/${changeId}/tasks.md`, raw.tasks),
      raw.design
        ? process('design', `openspec/changes/${changeId}/design.md`, raw.design)
        : Promise.resolve(undefined),
      Promise.all(
        raw.deltaSpecs.map(async (deltaSpec) => {
          const result = await process(
            'delta-spec',
            `openspec/changes/${changeId}/specs/${deltaSpec.specId}/spec.md`,
            deltaSpec.content
          )
          return {
            specId: deltaSpec.specId,
            content: result.markdown,
            sourceContent: deltaSpec.content,
          }
        })
      ),
    ])

    return { proposal, tasks, design, deltaSpecs }
  }

  async readChange(
    changeId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<Change | null> {
    try {
      const raw = await this.readChangeRaw(changeId, consumer, mode)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal.markdown, raw.tasks.markdown, {
        design: raw.design?.markdown,
        deltaSpecs: raw.deltaSpecs,
      })
    } catch {
      return null
    }
  }

  async readArchivedChangeRaw(
    changeId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<RawChangeDocuments | null> {
    const raw = await this.adapter.readArchivedChangeRaw(changeId)
    if (!raw) return null

    const process = (kind: DocumentRefV1['kind'], relativePath: string, source: string) =>
      this.processDocument({
        consumer,
        mode,
        document: {
          stage: 'archive',
          kind,
          changeId,
          relativePath,
          absolutePath: join(this.projectDir, relativePath),
        },
        source,
      })

    const [proposal, tasks, design, deltaSpecs] = await Promise.all([
      process('proposal', `openspec/changes/archive/${changeId}/proposal.md`, raw.proposal),
      process('tasks', `openspec/changes/archive/${changeId}/tasks.md`, raw.tasks),
      raw.design
        ? process('design', `openspec/changes/archive/${changeId}/design.md`, raw.design)
        : Promise.resolve(undefined),
      Promise.all(
        raw.deltaSpecs.map(async (deltaSpec) => {
          const result = await process(
            'delta-spec',
            `openspec/changes/archive/${changeId}/specs/${deltaSpec.specId}/spec.md`,
            deltaSpec.content
          )
          return {
            specId: deltaSpec.specId,
            content: result.markdown,
            sourceContent: deltaSpec.content,
          }
        })
      ),
    ])

    return { proposal, tasks, design, deltaSpecs }
  }

  async readArchivedChange(
    changeId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<Change | null> {
    try {
      const raw = await this.readArchivedChangeRaw(changeId, consumer, mode)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal.markdown, raw.tasks.markdown, {
        design: raw.design?.markdown,
        deltaSpecs: raw.deltaSpecs,
      })
    } catch {
      return null
    }
  }

  async readChangeFiles(
    changeId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<ChangeFile[]> {
    const files = await this.adapter.readChangeFiles(changeId)
    return this.processChangeFiles('change', changeId, files, consumer, mode)
  }

  async readChangeArtifactOutput(
    changeId: string,
    outputPath: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<string | null> {
    const normalizedPath = normalizeChangeFilePath(outputPath)
    const files = await this.readChangeArtifactFiles(changeId, normalizedPath, consumer, mode)
    return files.find((file) => file.path === normalizedPath)?.content ?? null
  }

  async readChangeGlobArtifactFiles(
    changeId: string,
    outputPath: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<StageChangeFile[]> {
    const normalizedPattern = normalizeChangeFilePath(outputPath)
    return this.readChangeArtifactFiles(changeId, normalizedPattern, consumer, mode)
  }

  async readArchivedChangeFiles(
    changeId: string,
    consumer: DocumentConsumerV1 = 'view',
    mode: DocumentReadModeV1 = 'processed'
  ): Promise<ChangeFile[]> {
    const files = await this.adapter.readArchivedChangeFiles(changeId)
    return this.processChangeFiles('archive', changeId, files, consumer, mode)
  }

  private async processChangeFiles(
    stage: 'change' | 'archive',
    changeId: string,
    files: ChangeFile[],
    consumer: DocumentConsumerV1,
    mode: DocumentReadModeV1
  ): Promise<ChangeFile[]> {
    const root =
      stage === 'change' ? `openspec/changes/${changeId}` : `openspec/changes/archive/${changeId}`

    const processed = await Promise.all(
      files.map((file) => this.processChangeFile(stage, changeId, root, file, consumer, mode))
    )

    return processed.filter(isNotNull)
  }

  private async readChangeArtifactFiles(
    changeId: string,
    outputPath: string,
    consumer: DocumentConsumerV1,
    mode: DocumentReadModeV1
  ): Promise<StageChangeFile[]> {
    const files = await this.adapter.readChangeFiles(changeId)
    const matchingFiles = files.filter((file): file is StageChangeFile => {
      if (file.type !== 'file' || file.content === undefined) return false
      return matchesGlob(file.path, outputPath) || file.path === outputPath
    })
    const root = `openspec/changes/${changeId}`

    const processed = await Promise.all(
      matchingFiles.map((file) =>
        this.processChangeFile('change', changeId, root, file, consumer, mode)
      )
    )

    return processed
      .filter(isNotNull)
      .filter((file): file is StageChangeFile => file.type === 'file' && file.content !== undefined)
  }

  private async processChangeFile(
    stage: 'change' | 'archive',
    changeId: string,
    root: string,
    file: ChangeFile,
    consumer: DocumentConsumerV1,
    mode: DocumentReadModeV1
  ): Promise<ChangeFile | null> {
    if (file.type !== 'file' || file.content === undefined || !file.path.endsWith('.md')) {
      return file
    }

    const kind = this.inferChangeFileKind(file.path)
    if (!kind) return file

    const result = await this.processDocument({
      consumer,
      mode,
      document: {
        stage,
        kind,
        changeId,
        relativePath: `${root}/${file.path}`,
        absolutePath: join(this.projectDir, root, file.path),
      },
      source: file.content,
    })
    return { ...file, content: result.markdown }
  }

  private inferChangeFileKind(path: string): DocumentRefV1['kind'] | null {
    if (path === 'proposal.md') return 'proposal'
    if (path === 'tasks.md') return 'tasks'
    if (path === 'design.md') return 'design'
    if (/^specs\/[^/]+\/spec\.md$/.test(path)) return 'delta-spec'
    return null
  }

  private async processDocument(input: {
    consumer: DocumentConsumerV1
    mode: DocumentReadModeV1
    document: DocumentRefV1
    source: string
  }): Promise<ReadSpecDocumentResult> {
    const read = async (): Promise<ReadSpecDocumentResult> => ({
      markdown: input.source,
      sourceMarkdown: input.source,
    })

    if (input.mode === 'source') {
      return read()
    }

    const hooks = await this.hookRuntime.load()
    if (!hooks.onReadDocument) {
      return read()
    }

    try {
      const result = await hooks.onReadDocument(
        {
          version: OPENSPECUI_HOOKS_VERSION,
          projectDir: this.projectDir,
          consumer: input.consumer,
          document: input.document,
          signal: new AbortController().signal,
          lifecycle: this.hookRuntime,
        },
        read
      )
      return { ...result, sourceMarkdown: input.source }
    } catch (error) {
      const fallback = await read()
      return {
        ...fallback,
        diagnostics: [...(fallback.diagnostics ?? []), toErrorDiagnostic(error)],
      }
    }
  }
}
