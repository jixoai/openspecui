import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ct2ModelAssetService } from './ct2-model-asset-service.js'

const hubMock = vi.hoisted(() => ({
  listFiles: vi.fn(),
  modelInfo: vi.fn(),
}))

vi.mock('@huggingface/hub', () => hubMock)

const TEST_COMMIT_HASH = 'abcdef1234567890abcdef1234567890abcdef12'
const TEST_SHORT_COMMIT_HASH = TEST_COMMIT_HASH.slice(0, 6)
const TEST_GROUP_DEFAULT = `default-${TEST_SHORT_COMMIT_HASH}`
const TEST_MODEL_ID = 'ooeoeo/opus-mt-en-zh-ct2-float16'

function testRepositoryFile(path: string, size: number) {
  return {
    path,
    type: 'file',
    size,
    lastCommit: { id: TEST_COMMIT_HASH },
    lfs: {
      oid: `${path.replace(/[^a-zA-Z0-9]+/g, '-')}-oid`,
      size,
    },
  }
}

describe('Ct2ModelAssetService', () => {
  let tempDir: string
  let indexPath: string
  let profileManifestPath: string
  let cacheDir: string
  let fetchCachePath: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-ct2-assets-'))
    indexPath = join(tempDir, 'models.json')
    profileManifestPath = join(tempDir, 'profile-manifests.json')
    cacheDir = join(tempDir, 'cache')
    fetchCachePath = join(tempDir, 'fetch-cache.json')
    hubMock.listFiles.mockReset()
    hubMock.modelInfo.mockReset()
    hubMock.modelInfo.mockResolvedValue({
      sha: TEST_COMMIT_HASH,
      id: TEST_MODEL_ID,
    })
    hubMock.listFiles.mockImplementation(async function* () {
      yield testRepositoryFile('config.json', 1_234)
      yield testRepositoryFile('model.bin', 120_000_000)
      yield testRepositoryFile('shared_vocabulary.json', 42_000)
      yield testRepositoryFile('source.spm', 810_000)
      yield testRepositoryFile('target.spm', 790_000)
      yield testRepositoryFile('tokenizer_config.json', 120)
      yield testRepositoryFile('vocab.json', 9_999)
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('materializes CT2 artifact plans when selecting a new remote model', async () => {
    const service = new Ct2ModelAssetService({
      projectDir: tempDir,
      globalSettingsManager: {
        readSettings: async () => ({
          translationEngines: {
            localCt2: {
              model: TEST_MODEL_ID,
              selectedGroupId: 'default',
              hfEndpoint: 'https://hf-mirror.com/',
            },
          },
        }),
      },
      now: () => 100,
      indexPath,
      profileManifestPath,
      cacheDir,
      fetchCachePath,
    })

    const state = await service.markSelectedModel(TEST_MODEL_ID)

    expect(state.selected).toBe(true)
    expect(state.status).toBe('not-downloaded')
    expect(state.plan?.selectedGroupId).toBe(TEST_GROUP_DEFAULT)
    expect(state.plan?.groups?.map((group) => [group.baseGroupId, group.status])).toEqual([
      ['default', 'not-downloaded'],
    ])
    expect(state.files).toEqual([
      { path: 'config.json', sizeBytes: 1_234, downloadedBytes: 0 },
      { path: 'model.bin', sizeBytes: 120_000_000, downloadedBytes: 0 },
      { path: 'shared_vocabulary.json', sizeBytes: 42_000, downloadedBytes: 0 },
      { path: 'source.spm', sizeBytes: 810_000, downloadedBytes: 0 },
      { path: 'target.spm', sizeBytes: 790_000, downloadedBytes: 0 },
      { path: 'tokenizer_config.json', sizeBytes: 120, downloadedBytes: 0 },
      { path: 'vocab.json', sizeBytes: 9_999, downloadedBytes: 0 },
    ])
  })
})
