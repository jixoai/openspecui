/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Project persisted credential-free backend connection entries.
 * 2. Publish same-window and storage-driven shell-state changes.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 */
import { useSyncExternalStore } from 'react'
import {
  areHostedShellStatesEqual,
  createEmptyHostedShellState,
  loadHostedShellState,
  saveHostedShellState,
  type HostedShellState,
} from './shell-state'

const SHELL_STATE_STORE_KEY = 'openspecui-app:shell'

/**
 * 持久化的 backend 连接条目（live 同步 localStorage）。
 *
 * 复用 shell-state.ts 的 HostedShellTab——它是「无凭据」的 backend 定位（apiBaseUrl），
 * 与 AGENTS.md「连接持久化不带凭据」一致。凭据只在 session memory 中（本轮骨架不涉及）。
 */
function createShellStateStore() {
  const listeners = new Set<() => void>()
  // 缓存上次解析结果，保证 useSyncExternalStore 的 getSnapshot 引用稳定（避免无限渲染）。
  let cached: HostedShellState =
    typeof localStorage !== 'undefined'
      ? loadHostedShellState(localStorage)
      : createEmptyHostedShellState()

  function refresh(): void {
    const next =
      typeof localStorage !== 'undefined'
        ? loadHostedShellState(localStorage)
        : createEmptyHostedShellState()
    // 只在内容真正变化时更新缓存引用并通知（引用稳定 = 不触发多余渲染）。
    if (!areHostedShellStatesEqual(cached, next)) {
      cached = next
      listeners.forEach((listener) => listener())
    }
  }

  // 跨窗口同步：hosted-shell-sync.ts 已有机制；这里订阅 storage 事件保持本地视图新鲜。
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === SHELL_STATE_STORE_KEY) refresh()
    })
  }

  return {
    // 惰性解析 localStorage：若内容未变则返回缓存引用（保持稳定，避免无限渲染）；
    // 若内容变了则更新缓存并返回新引用（驱动重新渲染）。
    getState: () => {
      const next =
        typeof localStorage !== 'undefined'
          ? loadHostedShellState(localStorage)
          : createEmptyHostedShellState()
      if (areHostedShellStatesEqual(cached, next)) return cached
      cached = next
      return cached
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setState(next: HostedShellState) {
      if (typeof localStorage !== 'undefined') {
        saveHostedShellState(localStorage, next)
      }
      refresh()
    },
  }
}

const shellStateStore = createShellStateStore()

/** Subscribe to the persisted credential-free backend connection list. */
export function useConnections() {
  const state = useSyncExternalStore(shellStateStore.subscribe, shellStateStore.getState)

  return state
}

/** 触发 shell state 变更（add/remove/reorder）的命令入口。 */
export function useConnectionsActions() {
  return shellStateStore
}
