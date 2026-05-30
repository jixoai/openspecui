import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('useDocumentTranslation architecture', () => {
  it('delegates service availability instead of querying local model state directly', async () => {
    const source = await readFile(resolve(__dirname, 'use-document-translation.ts'), 'utf8')

    expect(source).toContain('resolveTranslateServiceState')
    expect(source).toContain('ensureBrowserTranslationReady')
    expect(source).not.toContain('localModels.panelState')
    expect(source).not.toContain('projectTranslateServiceStatus')
  })
})
