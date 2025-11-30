import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { ReactiveState } from './reactive-state.js'
import { acquireWatcher } from './watcher-pool.js'

/** 状态缓存：路径 -> ReactiveState */
const stateCache = new Map<string, ReactiveState<unknown>>()

/** 监听器释放函数缓存 */
const releaseCache = new Map<string, () => void>()

/**
 * 响应式读取文件内容
 *
 * 特性：
 * - 自动注册文件监听
 * - 文件变更时自动更新状态
 * - 在 ReactiveContext 中调用时自动追踪依赖
 *
 * @param filepath 文件路径
 * @returns 文件内容，文件不存在时返回 null
 */
export async function reactiveReadFile(filepath: string): Promise<string | null> {
  const normalizedPath = resolve(filepath)
  const key = `file:${normalizedPath}`

  const getValue = async (): Promise<string | null> => {
    try {
      return await readFile(normalizedPath, 'utf-8')
    } catch {
      return null
    }
  }

  let state = stateCache.get(key) as ReactiveState<string | null> | undefined

  if (!state) {
    // 创建新的响应式状态
    const initialValue = await getValue()
    state = new ReactiveState<string | null>(initialValue)
    stateCache.set(key, state as ReactiveState<unknown>)

    // 设置文件监听
    // 监听文件所在目录，因为文件可能被删除后重新创建
    const dirPath = dirname(normalizedPath)
    const release = acquireWatcher(dirPath, async () => {
      const newValue = await getValue()
      state!.set(newValue)
    })
    releaseCache.set(key, release)
  }

  return state.get()
}

/**
 * 响应式读取目录内容
 *
 * 特性：
 * - 自动注册目录监听
 * - 目录变更时自动更新状态
 * - 在 ReactiveContext 中调用时自动追踪依赖
 *
 * @param dirpath 目录路径
 * @param options 选项
 * @returns 目录项名称数组
 */
export async function reactiveReadDir(
  dirpath: string,
  options: {
    /** 是否只返回目录 */
    directoriesOnly?: boolean
    /** 是否只返回文件 */
    filesOnly?: boolean
    /** 是否包含隐藏文件（以 . 开头） */
    includeHidden?: boolean
    /** 排除的名称 */
    exclude?: string[]
  } = {}
): Promise<string[]> {
  const normalizedPath = resolve(dirpath)
  const optionsKey = JSON.stringify(options)
  const key = `dir:${normalizedPath}:${optionsKey}`

  const getValue = async (): Promise<string[]> => {
    try {
      const entries = await readdir(normalizedPath, { withFileTypes: true })
      return entries
        .filter((entry) => {
          // 隐藏文件过滤
          if (!options.includeHidden && entry.name.startsWith('.')) {
            return false
          }
          // 排除列表过滤
          if (options.exclude?.includes(entry.name)) {
            return false
          }
          // 类型过滤
          if (options.directoriesOnly && !entry.isDirectory()) {
            return false
          }
          if (options.filesOnly && !entry.isFile()) {
            return false
          }
          return true
        })
        .map((entry) => entry.name)
    } catch {
      return []
    }
  }

  let state = stateCache.get(key) as ReactiveState<string[]> | undefined

  if (!state) {
    // 创建新的响应式状态
    const initialValue = await getValue()
    state = new ReactiveState<string[]>(initialValue, {
      // 数组相等性比较
      equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    })
    stateCache.set(key, state as ReactiveState<unknown>)

    // 设置目录监听（递归监听）
    const release = acquireWatcher(
      normalizedPath,
      async () => {
        const newValue = await getValue()
        state!.set(newValue)
      },
      { recursive: true }
    )
    releaseCache.set(key, release)
  }

  return state.get()
}

/**
 * 响应式检查路径是否存在
 *
 * @param path 路径
 * @returns 是否存在
 */
export async function reactiveExists(path: string): Promise<boolean> {
  const normalizedPath = resolve(path)
  const key = `exists:${normalizedPath}`

  const getValue = async (): Promise<boolean> => {
    try {
      await stat(normalizedPath)
      return true
    } catch {
      return false
    }
  }

  let state = stateCache.get(key) as ReactiveState<boolean> | undefined

  if (!state) {
    const initialValue = await getValue()
    state = new ReactiveState<boolean>(initialValue)
    stateCache.set(key, state as ReactiveState<unknown>)

    // 监听父目录
    const dirPath = dirname(normalizedPath)
    const release = acquireWatcher(dirPath, async () => {
      const newValue = await getValue()
      state!.set(newValue)
    })
    releaseCache.set(key, release)
  }

  return state.get()
}

/**
 * 响应式获取文件/目录的 stat 信息
 *
 * @param path 路径
 * @returns stat 信息，不存在时返回 null
 */
export async function reactiveStat(
  path: string
): Promise<{ isDirectory: boolean; isFile: boolean; mtime: number; birthtime: number } | null> {
  const normalizedPath = resolve(path)
  const key = `stat:${normalizedPath}`

  type StatResult = { isDirectory: boolean; isFile: boolean; mtime: number; birthtime: number } | null

  const getValue = async (): Promise<StatResult> => {
    try {
      const s = await stat(normalizedPath)
      return {
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        mtime: s.mtime.getTime(),
        birthtime: s.birthtime.getTime(),
      }
    } catch {
      return null
    }
  }

  let state = stateCache.get(key) as ReactiveState<StatResult> | undefined

  if (!state) {
    const initialValue = await getValue()
    state = new ReactiveState<StatResult>(initialValue, {
      equals: (a, b) => {
        if (a === null && b === null) return true
        if (a === null || b === null) return false
        return (
          a.isDirectory === b.isDirectory &&
          a.isFile === b.isFile &&
          a.mtime === b.mtime &&
          a.birthtime === b.birthtime
        )
      },
    })
    stateCache.set(key, state as ReactiveState<unknown>)

    const dirPath = dirname(normalizedPath)
    const release = acquireWatcher(dirPath, async () => {
      const newValue = await getValue()
      state!.set(newValue)
    })
    releaseCache.set(key, release)
  }

  return state.get()
}

/**
 * 清除指定路径的缓存（用于测试）
 */
export function clearCache(path?: string): void {
  if (path) {
    const normalizedPath = resolve(path)
    // 清除所有以该路径开头的缓存
    for (const [key, release] of releaseCache) {
      if (key.includes(normalizedPath)) {
        release()
        releaseCache.delete(key)
        stateCache.delete(key)
      }
    }
  } else {
    // 清除所有缓存
    for (const release of releaseCache.values()) {
      release()
    }
    releaseCache.clear()
    stateCache.clear()
  }
}

/**
 * 获取缓存大小（用于调试）
 */
export function getCacheSize(): number {
  return stateCache.size
}
