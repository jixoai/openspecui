import type { ExportSnapshot } from '@openspecui/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const staticState = vi.hoisted(() => ({
  snapshot: null as ExportSnapshot | null,
}))

vi.mock('./static-mode', () => ({
  getBasePath: () => '/',
  getInitialData: () => staticState.snapshot,
}))

function createSnapshot(): ExportSnapshot {
  return {
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      projectDir: '/tmp/project',
    },
    dashboard: {
      specsCount: 0,
      changesCount: 1,
      archivesCount: 0,
    },
    specs: [],
    changes: [
      {
        id: 'add-2fa',
        name: 'add-2fa',
        proposal: '# Proposal',
        tasks: '- [ ] task',
        design: '# Design',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        deltas: [
          {
            capability: 'auth',
            content: '# Delta',
          },
        ],
        progress: { total: 1, completed: 0 },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    archives: [],
    opsx: {
      configYaml: 'schema: spec-driven',
      schemas: [
        {
          name: 'spec-driven',
          artifacts: ['proposal', 'specs', 'design', 'tasks'],
          source: 'project',
        },
      ],
      schemaDetails: {
        'spec-driven': {
          name: 'spec-driven',
          applyRequires: ['proposal'],
          artifacts: [
            {
              id: 'proposal',
              outputPath: 'proposal.md',
              requires: [],
            },
            {
              id: 'specs',
              outputPath: 'specs/**/*.md',
              requires: ['proposal'],
            },
            {
              id: 'design',
              outputPath: 'design.md',
              requires: ['proposal'],
            },
            {
              id: 'tasks',
              outputPath: 'tasks.md',
              requires: ['proposal', 'specs'],
            },
          ],
        },
      },
      schemaResolutions: {
        'spec-driven': {
          name: 'spec-driven',
          source: 'project',
          path: '/tmp/project/openspec/schemas/spec-driven',
          shadows: [],
        },
      },
      templates: {},
      changeMetadata: {
        'add-2fa': 'schema: spec-driven',
      },
    },
  }
}

describe('static-data-provider opsx adapters', () => {
  beforeEach(() => {
    vi.resetModules()
    staticState.snapshot = createSnapshot()
  })

  it('builds status list from static snapshot', async () => {
    const provider = await import('./static-data-provider')
    const list = await provider.getOpsxStatusList()

    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      changeName: 'add-2fa',
      schemaName: 'spec-driven',
      isComplete: true,
    })
    expect(list[0]?.artifacts.map((artifact) => artifact.status)).toEqual([
      'done',
      'done',
      'done',
      'done',
    ])
  })

  it('returns single change status in static mode', async () => {
    const provider = await import('./static-data-provider')
    const status = await provider.getOpsxStatus('add-2fa')

    expect(status?.changeName).toBe('add-2fa')
    expect(status?.artifacts[0]?.relativePath).toBe('openspec/changes/add-2fa/proposal.md')
  })

  it('reads artifact output and glob files from snapshot', async () => {
    const provider = await import('./static-data-provider')

    await expect(provider.getOpsxArtifactOutput('add-2fa', 'proposal.md')).resolves.toBe(
      '# Proposal'
    )

    const files = await provider.getOpsxGlobArtifactFiles('add-2fa', 'specs/**/*.md')
    expect(files).toEqual([
      {
        path: 'specs/auth/spec.md',
        type: 'file',
        content: '# Delta',
      },
    ])
  })

  it('normalizes schema paths to relative display paths', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      opsx: {
        ...createSnapshot().opsx!,
        templates: {
          'spec-driven': {
            tasks: {
              source: 'package',
              path: '/Users/test/.bun/install/global/node_modules/@fission-ai/openspec/schemas/spec-driven/templates/tasks.md',
              displayPath: 'npm:@fission-ai/openspec/schemas/spec-driven/templates/tasks.md',
            },
          },
        },
        templateContents: {
          'spec-driven': {
            tasks: {
              source: 'package',
              path: '/Users/test/.bun/install/global/node_modules/@fission-ai/openspec/schemas/spec-driven/templates/tasks.md',
              displayPath: 'npm:@fission-ai/openspec/schemas/spec-driven/templates/tasks.md',
              content: '# Tasks template',
            },
          },
        },
      },
    }

    const provider = await import('./static-data-provider')
    const resolution = await provider.getOpsxSchemaResolution('spec-driven')
    const files = await provider.getOpsxSchemaFiles('spec-driven')

    expect(resolution?.path).toBe('/tmp/project/openspec/schemas/spec-driven')
    expect(resolution?.displayPath).toBe('project:openspec/schemas/spec-driven')
    expect(files).toContainEqual({
      path: 'templates/tasks.md',
      type: 'file',
      content: '# Tasks template',
    })
  })

  it('returns template contents for static schema preview', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      opsx: {
        ...createSnapshot().opsx!,
        templates: {
          'spec-driven': {
            proposal: {
              source: 'project',
              path: '/tmp/project/openspec/schemas/spec-driven/templates/proposal.md',
              displayPath: 'project:openspec/schemas/spec-driven/templates/proposal.md',
            },
          },
        },
        templateContents: {
          'spec-driven': {
            proposal: {
              source: 'project',
              path: '/tmp/project/openspec/schemas/spec-driven/templates/proposal.md',
              displayPath: 'project:openspec/schemas/spec-driven/templates/proposal.md',
              content: '# Proposal template',
            },
          },
        },
      },
    }

    const provider = await import('./static-data-provider')
    const template = await provider.getOpsxTemplateContent('spec-driven', 'proposal')
    const templates = await provider.getOpsxTemplateContents('spec-driven')

    expect(template?.content).toBe('# Proposal template')
    expect(template?.displayPath).toBe('project:openspec/schemas/spec-driven/templates/proposal.md')
    expect(templates?.proposal?.content).toBe('# Proposal template')
  })
})
