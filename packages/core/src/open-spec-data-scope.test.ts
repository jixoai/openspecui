import { describe, expect, it } from 'vitest'
import { OpenSpecUIConfigSchema } from './config.js'
import { resolveOpenSpecDataScope } from './open-spec-data-scope.js'

describe('resolveOpenSpecDataScope', () => {
  it('uses inherited XDG_DATA_HOME on every platform', () => {
    expect(
      resolveOpenSpecDataScope({
        env: { XDG_DATA_HOME: '/runtime/data' },
        platform: 'darwin',
        homedir: '/Users/test',
      })
    ).toEqual({
      path: '/runtime/data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    })
  })

  it('matches OpenSpec Unix and Windows fallback paths', () => {
    expect(resolveOpenSpecDataScope({ env: {}, platform: 'linux', homedir: '/home/test' })).toEqual(
      {
        path: '/home/test/.local/share/openspec',
        source: 'user-home-default',
        environmentVariable: null,
      }
    )

    expect(
      resolveOpenSpecDataScope({
        env: { LOCALAPPDATA: 'D:\\Runtime\\Data' },
        platform: 'win32',
        homedir: 'C:\\Users\\test',
      })
    ).toEqual({
      path: 'D:\\Runtime\\Data\\openspec',
      source: 'local-app-data',
      environmentVariable: 'LOCALAPPDATA',
    })
  })

  it('keeps project-owned data-scope and registry mechanisms outside UI config', () => {
    const config = OpenSpecUIConfigSchema.parse({
      env: { XDG_DATA_HOME: '/project/data' },
      StoreRoot: '/project/stores',
      storeRoot: '/project/stores',
      registryOverlay: ['/global/registry.yaml', '/project/registry.yaml'],
    })

    expect(Object.hasOwn(config, 'env')).toBe(false)
    expect(Object.hasOwn(config, 'StoreRoot')).toBe(false)
    expect(Object.hasOwn(config, 'storeRoot')).toBe(false)
    expect(Object.hasOwn(config, 'registryOverlay')).toBe(false)
  })
})
