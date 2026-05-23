const DEFAULT_HUGGING_FACE_ENDPOINT = 'https://huggingface.co'

export function normalizeHuggingFaceEndpoint(endpoint: string | undefined): string {
  const trimmed = endpoint?.trim()
  if (!trimmed) return DEFAULT_HUGGING_FACE_ENDPOINT
  return trimmed.replace(/\/+$/, '')
}

export function buildHuggingFaceApiBaseUrl(endpoint: string | undefined): string {
  return `${normalizeHuggingFaceEndpoint(endpoint)}/api`
}

export function buildTransformersRemoteHost(endpoint: string | undefined): string {
  return `${normalizeHuggingFaceEndpoint(endpoint)}/`
}
