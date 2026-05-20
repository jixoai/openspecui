import {
  inferFileMime,
  inferFilePreviewKind,
  type FilePreviewKind,
  type OpsxEntityStage,
} from '@openspecui/core'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { resolveEntityEntryPath } from './entity-file-paths.js'

export interface PreparedFilePreview {
  hash: string
  mime: string
  previewKind: FilePreviewKind
  relativePath: string
  resourcePathname: string | null
  entryPathname: string
  urlPath: string
}

interface PreviewSession {
  hash: string
  directoryPath: string
  mime: string
  previewKind: Exclude<FilePreviewKind, 'markdown' | 'text' | 'none'>
  entryFileName: string | null
}

const PREVIEW_ENTRY_FILE_BY_KIND: Record<
  Exclude<FilePreviewKind, 'markdown' | 'text' | 'none' | 'html'>,
  string
> = {
  image: 'image-preview.html',
  audio: 'audio-preview.html',
  video: 'video-preview.html',
  pdf: 'pdf-preview.html',
}

const SESSION_PREVIEW_KINDS = new Set<Exclude<FilePreviewKind, 'markdown' | 'text' | 'none'>>([
  'html',
  'image',
  'audio',
  'video',
  'pdf',
])

function isSessionPreviewKind(
  previewKind: FilePreviewKind
): previewKind is Exclude<FilePreviewKind, 'markdown' | 'text' | 'none'> {
  return SESSION_PREVIEW_KINDS.has(previewKind as Exclude<FilePreviewKind, 'markdown' | 'text' | 'none'>)
}

function toHash(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '')
}

function inferPreviewAssetContentType(path: string): string {
  const extension = extname(path).toLowerCase()
  switch (extension) {
    case '.html':
      return 'text/html'
    case '.js':
    case '.mjs':
      return 'application/javascript'
    case '.css':
      return 'text/css'
    case '.json':
      return 'application/json'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    default:
      return inferFileMime(path) ?? 'application/octet-stream'
  }
}

function isRewritablePreviewAsset(path: string): boolean {
  const extension = extname(path).toLowerCase()
  return extension === '.html' || extension === '.js' || extension === '.mjs' || extension === '.css'
}

function rewritePreviewAssetPaths(content: string, hash: string): string {
  const sessionAssetPrefix = `/api/file-preview/${hash}/assets/`
  return content.replaceAll('/assets/', sessionAssetPrefix)
}

export class FilePreviewService {
  private readonly sessions = new Map<string, PreviewSession>()

  constructor(
    private readonly projectDir: string,
    private readonly previewAssetsDir: string
  ) {}

  prepareEntityFilePreview(input: {
    stage: OpsxEntityStage
    changeId: string
    path: string
  }): PreparedFilePreview {
    const resolved = resolveEntityEntryPath({
      projectDir: this.projectDir,
      stage: input.stage,
      changeId: input.changeId,
      path: input.path,
    })
    const statInfo = statSync(resolved.absolutePath, { throwIfNoEntry: false })
    if (!statInfo?.isFile()) {
      throw new Error('Preview target file not found.')
    }

    const mime = inferFileMime(resolved.relativePath)
    if (!mime) {
      throw new Error('Preview target mime is unknown.')
    }

    const previewKind = inferFilePreviewKind(resolved.relativePath, mime)
    if (!isSessionPreviewKind(previewKind)) {
      throw new Error('Preview route is not supported for this file type.')
    }

    const directoryPath = resolve(resolved.absolutePath, '..')
    const hash = toHash(`${directoryPath}:${mime}`)
    const entryFileName = previewKind === 'html' ? null : PREVIEW_ENTRY_FILE_BY_KIND[previewKind]
    const fileName = basename(resolved.absolutePath)

    this.sessions.set(hash, {
      hash,
      directoryPath,
      mime,
      previewKind,
      entryFileName,
    })

    const htmlPathname = `/api/file-preview/${hash}/${fileName}`
    const resourcePathname =
      previewKind === 'html' ? null : `/api/file-preview/${hash}/resource/${fileName}`
    const entryPathname =
      previewKind === 'html' ? htmlPathname : `/api/file-preview/${hash}/${entryFileName}`
    return {
      hash,
      mime,
      previewKind,
      relativePath: resolved.relativePath,
      resourcePathname,
      entryPathname,
      urlPath: previewKind === 'html' ? htmlPathname : `${entryPathname}?file=${encodeURIComponent(fileName)}`,
    }
  }

  readPreviewRequest(
    hash: string,
    requestPath: string
  ): { content: Buffer; contentType: string } | null {
    const session = this.sessions.get(hash)
    if (!session) return null

    const normalized = stripLeadingSlash(requestPath)
    if (session.previewKind === 'html') {
      const absolutePath = resolve(session.directoryPath, normalized)
      if (!absolutePath.startsWith(session.directoryPath + '/')) {
        return null
      }
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        return null
      }
      return {
        content: readFileSync(absolutePath),
        contentType: inferFileMime(absolutePath) ?? 'application/octet-stream',
      }
    }

    if (normalized.startsWith('resource/')) {
      const resourcePath = normalized.slice('resource/'.length)
      const absolutePath = resolve(session.directoryPath, resourcePath)
      if (!absolutePath.startsWith(session.directoryPath + '/')) {
        return null
      }
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        return null
      }
      return {
        content: readFileSync(absolutePath),
        contentType: inferFileMime(absolutePath) ?? 'application/octet-stream',
      }
    }

    const assetName = normalized || session.entryFileName
    if (!assetName) {
      return null
    }
    const absolutePath = resolve(this.previewAssetsDir, assetName)
    if (!absolutePath.startsWith(resolve(this.previewAssetsDir) + '/')) {
      return null
    }
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      return null
    }
    if (isRewritablePreviewAsset(assetName)) {
      const rewritten = rewritePreviewAssetPaths(readFileSync(absolutePath, 'utf8'), hash)
      return {
        content: Buffer.from(rewritten, 'utf8'),
        contentType: inferPreviewAssetContentType(absolutePath),
      }
    }
    return {
      content: readFileSync(absolutePath),
      contentType: inferPreviewAssetContentType(absolutePath),
    }
  }
}
