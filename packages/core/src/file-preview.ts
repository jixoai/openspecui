const MIME_BY_EXTENSION = new Map<string, string>([
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.mdown', 'text/markdown'],
  ['.mkd', 'text/markdown'],
  ['.txt', 'text/plain'],
  ['.log', 'text/plain'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
  ['.json', 'application/json'],
  ['.jsonc', 'application/json'],
  ['.toml', 'application/toml'],
  ['.ini', 'text/plain'],
  ['.cfg', 'text/plain'],
  ['.conf', 'text/plain'],
  ['.html', 'text/html'],
  ['.htm', 'text/html'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.oga', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac'],
  ['.flac', 'audio/flac'],
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.mkv', 'video/x-matroska'],
  ['.ogv', 'video/ogg'],
  ['.pdf', 'application/pdf'],
  ['.js', 'text/javascript'],
  ['.jsx', 'text/javascript'],
  ['.ts', 'text/typescript'],
  ['.tsx', 'text/typescript'],
  ['.css', 'text/css'],
  ['.sh', 'text/plain'],
  ['.py', 'text/plain'],
  ['.rs', 'text/plain'],
  ['.go', 'text/plain'],
  ['.java', 'text/plain'],
  ['.c', 'text/plain'],
  ['.cc', 'text/plain'],
  ['.cpp', 'text/plain'],
  ['.h', 'text/plain'],
  ['.hpp', 'text/plain'],
])

const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_VALUES = new Set([
  'application/json',
  'application/yaml',
  'application/toml',
  'application/xml',
  'image/svg+xml',
])

export const FILE_PREVIEW_KINDS = [
  'markdown',
  'html',
  'image',
  'audio',
  'video',
  'pdf',
  'text',
  'none',
] as const

export type FilePreviewKind = (typeof FILE_PREVIEW_KINDS)[number]

function getExtension(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const name = normalized.split('/').pop() ?? normalized
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex < 0) return ''
  return name.slice(dotIndex).toLowerCase()
}

export function inferFileMime(path: string): string | null {
  return MIME_BY_EXTENSION.get(getExtension(path)) ?? null
}

export function inferFilePreviewKind(path: string, mime?: string | null): FilePreviewKind {
  const resolvedMime = mime ?? inferFileMime(path)
  if (!resolvedMime) return 'none'
  if (resolvedMime === 'text/markdown') return 'markdown'
  if (resolvedMime === 'text/html') return 'html'
  if (resolvedMime.startsWith('image/')) return resolvedMime === 'image/svg+xml' ? 'text' : 'image'
  if (resolvedMime.startsWith('audio/')) return 'audio'
  if (resolvedMime.startsWith('video/')) return 'video'
  if (resolvedMime === 'application/pdf') return 'pdf'
  if (isTextLikeMime(resolvedMime)) return 'text'
  return 'none'
}

export function isTextLikeMime(mime: string | null | undefined): boolean {
  if (!mime) return false
  if (TEXT_MIME_VALUES.has(mime)) return true
  return TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
}

export function isTextLikeFile(path: string, mime?: string | null): boolean {
  return isTextLikeMime(mime ?? inferFileMime(path))
}

export function isPreviewableFile(path: string, mime?: string | null): boolean {
  return inferFilePreviewKind(path, mime) !== 'none'
}
