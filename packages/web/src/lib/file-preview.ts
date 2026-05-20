import { getApiBaseUrl } from './api-config'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

export interface PreparedFilePreview {
  hash: string
  mime: string
  previewKind: string
  relativePath: string
  resourcePathname: string | null
  entryPathname: string
  urlPath: string
}

export async function prepareEntityFilePreview(input: {
  changeId: string
  archived?: boolean
  path: string
}): Promise<PreparedFilePreview | null> {
  if (isStaticMode()) {
    return null
  }

  const preview = await (input.archived
    ? trpcClient.archive.prepareFilePreview.query({
        id: input.changeId,
        path: input.path,
      })
    : trpcClient.change.prepareFilePreview.query({
        id: input.changeId,
        path: input.path,
      }))
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) {
    return preview
  }

  const prefix = (path: string) => `${apiBaseUrl}${path}`
  return {
    ...preview,
    resourcePathname: preview.resourcePathname ? prefix(preview.resourcePathname) : null,
    entryPathname: prefix(preview.entryPathname),
    urlPath: prefix(preview.urlPath),
  }
}

export async function writeEntityFile(input: {
  changeId: string
  archived?: boolean
  path: string
  content: string
}): Promise<void> {
  if (input.archived) {
    await trpcClient.archive.writeFile.mutate({
      id: input.changeId,
      path: input.path,
      content: input.content,
    })
    return
  }

  await trpcClient.change.writeFile.mutate({
    id: input.changeId,
    path: input.path,
    content: input.content,
  })
}
