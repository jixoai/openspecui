/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Verify successful CLI Store truth acquires, retains, replaces, and removes root leases.
 * 2. Verify failed root observation cannot retain a stale registration lease.
 * 3. Verify service teardown releases every Store root and dependency before fixture cleanup.
 * 4. Verify Spec-content and Doctor facts publish separate generations after watcher settlement.
 * 5. Verify Git working-tree facts legitimately produce Doctor-context invalidation.
 *
 * Original request (2026-07-15): "Registered Store roots are added/removed from observation as registry truth changes."
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import {
  getWatcherRuntimeStatus,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  type ObservationRootOwner,
} from '@openspecui/core'
import type { StoreListEntry } from '@openspecui/core/store-types'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  removeServerTestDirectories,
  waitForServerWatcherSettlement,
} from './server-test-cleanup.js'
import type { StoreDoctorDependencyObservationFactory } from './store-doctor-dependency-observer.js'
import { StoreObservationService } from './store-observation-service.js'

function store(id: string, root: string): StoreListEntry {
  return { id, root }
}

function createInvalidationController(): RuntimeInvalidationIndex {
  return new RuntimeInvalidationIndex()
}

function createDoctorDependencyFactory(): StoreDoctorDependencyObservationFactory {
  return vi.fn(async () => ({ dispose: vi.fn(async () => {}) }))
}

const tempDirs: string[] = []

afterEach(async () => {
  await removeServerTestDirectories(tempDirs.splice(0))
})

describe('StoreObservationService', () => {
  it('publishes Spec content separately from Doctor dependency changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-store-spec-observation-'))
    tempDirs.push(root)
    await mkdir(join(root, 'openspec', 'specs', 'auth'), { recursive: true })
    await writeFile(join(root, 'openspec', 'specs', 'auth', 'spec.md'), '# Auth\n', 'utf8')
    const environment = new ReactiveObservationEnvironment()
    const invalidation = createInvalidationController()
    const doctorOwner: { changed: (() => void) | null } = { changed: null }
    const service = new StoreObservationService(
      environment,
      invalidation,
      vi.fn(async (input) => {
        doctorOwner.changed = input.onChange
        return { dispose: vi.fn(async () => {}) }
      })
    )
    const changes: Array<{ kind: string; storeId?: string }> = []
    const unsubscribe = service.subscribe((change) => changes.push(change))

    try {
      await service.reconcile([store('team', root)])
      await waitForServerWatcherSettlement()
      changes.length = 0
      const contextGeneration = invalidation.current('context')
      await writeFile(
        join(root, 'openspec', 'specs', 'auth', 'spec.md'),
        '# Auth\n\n## Requirements\n',
        'utf8'
      )
      await vi.waitFor(() =>
        expect(changes).toContainEqual(
          expect.objectContaining({ kind: 'spec-root', storeId: 'team' })
        )
      )
      expect(changes).not.toContainEqual(
        expect.objectContaining({ kind: 'doctor-root', storeId: 'team' })
      )
      expect(invalidation.current('context')).toBe(contextGeneration)

      if (!doctorOwner.changed) throw new Error('Doctor dependency callback was not installed.')
      doctorOwner.changed()
      expect(changes).toContainEqual(
        expect.objectContaining({ kind: 'doctor-root', storeId: 'team' })
      )
      expect(invalidation.current('context')).toBe(contextGeneration + 1)
    } finally {
      unsubscribe()
      await service.dispose()
      await environment.dispose()
    }
  })

  it('publishes Doctor-context invalidation for a Git Store working-tree change', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-store-git-observation-'))
    tempDirs.push(root)
    await mkdir(join(root, '.git', 'refs', 'heads'), { recursive: true })
    await Promise.all([
      writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8'),
      writeFile(join(root, '.git', 'index'), 'index-a', 'utf8'),
      writeFile(join(root, '.git', 'config'), '[core]\nrepositoryformatversion = 0\n', 'utf8'),
    ])
    const environment = new ReactiveObservationEnvironment()
    const invalidation = createInvalidationController()
    const service = new StoreObservationService(environment, invalidation)
    const changes: Array<{ kind: string; storeId?: string }> = []
    const unsubscribe = service.subscribe((change) => changes.push(change))

    try {
      await service.reconcile([store('team', root)])
      await waitForServerWatcherSettlement()
      const contextGeneration = invalidation.current('context')
      await writeFile(join(root, 'working.md'), '# tracked dirty fact\n', 'utf8')
      await vi.waitFor(() =>
        expect(changes).toContainEqual(
          expect.objectContaining({ kind: 'doctor-root', storeId: 'team' })
        )
      )
      expect(invalidation.current('context')).toBe(contextGeneration + 1)
    } finally {
      unsubscribe()
      await service.dispose()
      await environment.dispose()
    }
  })

  it('reconciles added, retained, moved, and removed Store roots', async () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>()
    const environment: ObservationRootOwner = {
      acquireRoot: vi.fn(async (rootPath) => {
        const release = vi.fn(async () => {})
        releases.set(resolve(rootPath), release)
        return release
      }),
    }
    const service = new StoreObservationService(
      environment,
      createInvalidationController(),
      createDoctorDependencyFactory()
    )

    await service.reconcile([store('alpha', '/stores/alpha'), store('beta', '/stores/beta')])
    expect(service.getObservedStores()).toEqual([
      { storeId: 'alpha', rootPath: resolve('/stores/alpha') },
      { storeId: 'beta', rootPath: resolve('/stores/beta') },
    ])
    expect(environment.acquireRoot).toHaveBeenCalledTimes(2)

    await service.reconcile([store('alpha', '/stores/alpha'), store('beta', '/stores/beta')])
    expect(environment.acquireRoot).toHaveBeenCalledTimes(2)

    await service.reconcile([store('alpha', '/stores/alpha-v2')])
    expect(releases.get(resolve('/stores/alpha'))).toHaveBeenCalledTimes(1)
    expect(releases.get(resolve('/stores/beta'))).toHaveBeenCalledTimes(1)
    expect(service.getObservedStores()).toEqual([
      { storeId: 'alpha', rootPath: resolve('/stores/alpha-v2') },
    ])

    await service.dispose()
    expect(releases.get(resolve('/stores/alpha-v2'))).toHaveBeenCalledTimes(1)
  })

  it('releases the old root when a moved Store cannot acquire its new root', async () => {
    const releaseOld = vi.fn(async () => {})
    const environment: ObservationRootOwner = {
      acquireRoot: vi.fn(async (rootPath) => {
        if (rootPath.endsWith('new')) throw new Error('watcher unavailable')
        return releaseOld
      }),
    }
    const service = new StoreObservationService(
      environment,
      createInvalidationController(),
      createDoctorDependencyFactory()
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await service.reconcile([store('alpha', '/stores/old')])
    await service.reconcile([store('alpha', '/stores/new')])

    expect(releaseOld).toHaveBeenCalledTimes(1)
    expect(service.getObservedStores()).toEqual([])
    expect(service.hasObservationGaps()).toBe(true)
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Store observation failed for 'alpha'"),
      expect.any(Error)
    )
    consoleError.mockRestore()
  })

  it('clears an observation gap after the same CLI truth retries successfully', async () => {
    const release = vi.fn(async () => {})
    const environment: ObservationRootOwner = {
      acquireRoot: vi
        .fn()
        .mockRejectedValueOnce(new Error('watcher unavailable'))
        .mockResolvedValueOnce(release),
    }
    const service = new StoreObservationService(
      environment,
      createInvalidationController(),
      createDoctorDependencyFactory()
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await service.reconcile([store('alpha', '/stores/alpha')])
    expect(service.hasObservationGaps()).toBe(true)
    await service.reconcile([store('alpha', '/stores/alpha')])
    expect(service.hasObservationGaps()).toBe(false)

    await service.dispose()
    expect(release).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  it('adds and removes physical watcher roots as registered Store truth changes', async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), 'openspecui-store-observation-a-'))
    const secondRoot = await mkdtemp(join(tmpdir(), 'openspecui-store-observation-b-'))
    tempDirs.push(firstRoot, secondRoot)
    const environment = new ReactiveObservationEnvironment()
    const service = new StoreObservationService(environment, createInvalidationController())

    await service.reconcile([store('alpha', firstRoot)])
    expect(getWatcherRuntimeStatus()?.roots.map((root) => root.rootPath)).toEqual([
      realpathSync(firstRoot),
    ])

    await service.reconcile([store('beta', secondRoot)])
    expect(getWatcherRuntimeStatus()?.roots.map((root) => root.rootPath)).toEqual([
      realpathSync(secondRoot),
    ])

    await service.reconcile([])
    expect(getWatcherRuntimeStatus()).toBeNull()
    await service.dispose()
    await environment.dispose()
  })
})
