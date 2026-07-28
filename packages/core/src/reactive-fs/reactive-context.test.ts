/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Verify dependency tracking and reactive stream behavior.
 * 2. Prove recompute lifecycle ordering with deterministic deferred tasks.
 * 3. Prove abort cleanup cannot emit a false recompute start.
 * 4. Prove a dependency change retires an in-flight result before it can be yielded.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Original request (2026-07-26): "dependency 在 pending load 中变化时旧 A 不得作为 current snapshot 发布。"
 */
import { describe, expect, it, vi } from 'vitest'
import { takeFromGenerator } from '../__tests__/test-utils.js'
import { ReactiveContext } from './reactive-context.js'
import { ReactiveState, contextStorage } from './reactive-state.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve']
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('ReactiveContext', () => {
  describe('track()', () => {
    it('should track dependencies', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')

      await contextStorage.run(context, async () => {
        state.get()
      })

      // 验证 state 被追踪（通过 notifyChange 触发）
      const notified = vi.fn()
      context['changePromise'] = { resolve: notified, reject: vi.fn(), promise: Promise.resolve() }

      state.set('new value')
      expect(notified).toHaveBeenCalled()
    })

    it('should not track after destroyed', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')

      // 销毁 context
      context['destroyed'] = true

      await contextStorage.run(context, async () => {
        state.get()
      })

      // 验证 state 没有被追踪
      expect(context['dependencies'].size).toBe(0)
    })
  })

  describe('notifyChange()', () => {
    it('should resolve changePromise', () => {
      const context = new ReactiveContext()
      const resolved = vi.fn()

      context['changePromise'] = {
        resolve: resolved,
        reject: vi.fn(),
        promise: Promise.resolve(),
      }

      context.notifyChange()
      expect(resolved).toHaveBeenCalled()
    })

    it('should not resolve if destroyed', () => {
      const context = new ReactiveContext()
      const resolved = vi.fn()

      context['changePromise'] = {
        resolve: resolved,
        reject: vi.fn(),
        promise: Promise.resolve(),
      }
      context['destroyed'] = true

      context.notifyChange()
      expect(resolved).not.toHaveBeenCalled()
    })

    it('should not throw if no changePromise', () => {
      const context = new ReactiveContext()
      expect(() => context.notifyChange()).not.toThrow()
    })
  })

  describe('stream()', () => {
    it('should yield initial result', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('initial')

      const generator = context.stream(async () => state.get())
      const results = await takeFromGenerator(generator, 1)

      expect(results).toEqual(['initial'])
    })

    it('should yield new result when dependency changes', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('v1')

      const generator = context.stream(async () => state.get())
      const results: string[] = []

      // 获取第一个值
      const first = await generator.next()
      results.push(first.value)

      // 修改状态
      state.set('v2')

      // 获取第二个值
      const second = await generator.next()
      results.push(second.value)

      expect(results).toEqual(['v1', 'v2'])
    })

    it('should report recompute start before the replacement task completes', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('A')
      const replacementEntered = createDeferred<void>()
      const releaseReplacement = createDeferred<void>()
      const onRecomputeStarted = vi.fn()
      let taskRuns = 0

      const generator = context.stream(
        async () => {
          taskRuns += 1
          const value = state.get()
          if (taskRuns === 2) {
            replacementEntered.resolve()
            await releaseReplacement.promise
          }
          return value
        },
        undefined,
        { onRecomputeStarted }
      )

      await expect(generator.next()).resolves.toMatchObject({ value: 'A', done: false })
      expect(onRecomputeStarted).not.toHaveBeenCalled()

      const replacementResult = generator.next()
      state.set('B')
      await replacementEntered.promise

      expect(onRecomputeStarted).toHaveBeenCalledTimes(1)

      releaseReplacement.resolve()
      await expect(replacementResult).resolves.toMatchObject({ value: 'B', done: false })
      expect(onRecomputeStarted).toHaveBeenCalledTimes(1)

      await generator.return(undefined)
    })

    it('should retire a pending result when its dependency changes before settlement', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('A')
      const firstRead = createDeferred<void>()
      const releaseA = createDeferred<void>()
      const onRecomputeStarted = vi.fn()
      let taskRuns = 0
      const generator = context.stream(
        async () => {
          taskRuns += 1
          const value = state.get()
          if (taskRuns === 1) {
            firstRead.resolve()
            await releaseA.promise
          }
          return value
        },
        undefined,
        { onRecomputeStarted }
      )

      const firstYield = generator.next()
      await firstRead.promise
      state.set('B')
      releaseA.resolve()

      await expect(firstYield).resolves.toMatchObject({ value: 'B', done: false })
      expect(taskRuns).toBe(2)
      expect(onRecomputeStarted).toHaveBeenCalledOnce()

      await generator.return(undefined)
    })

    it('should not report recompute start when aborted after initial data', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('A')
      const controller = new AbortController()
      const onRecomputeStarted = vi.fn()
      const generator = context.stream(async () => state.get(), controller.signal, {
        onRecomputeStarted,
      })

      await expect(generator.next()).resolves.toMatchObject({ value: 'A', done: false })

      const completion = generator.next()
      controller.abort()

      await expect(completion).rejects.toMatchObject({ name: 'AbortError' })
      expect(onRecomputeStarted).not.toHaveBeenCalled()
    })

    it('should reuse one abort listener across dependency-driven recomputes', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('A')
      const controller = new AbortController()
      const addEventListener = vi.spyOn(controller.signal, 'addEventListener')
      const generator = context.stream(async () => state.get(), controller.signal)

      await expect(generator.next()).resolves.toMatchObject({ value: 'A', done: false })
      const second = generator.next()
      state.set('B')
      await expect(second).resolves.toMatchObject({ value: 'B', done: false })
      const third = generator.next()
      state.set('C')
      await expect(third).resolves.toMatchObject({ value: 'C', done: false })

      expect(
        addEventListener.mock.calls.filter(([eventName]) => eventName === 'abort')
      ).toHaveLength(1)
      const completion = generator.next()
      controller.abort()
      await expect(completion).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('should not report recompute start when a dirty pending task is aborted', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('A')
      const controller = new AbortController()
      const firstRead = createDeferred<void>()
      const releaseTask = createDeferred<void>()
      const onRecomputeStarted = vi.fn()
      const generator = context.stream(
        async () => {
          state.get()
          firstRead.resolve()
          await releaseTask.promise
          throw new Error('The retired task should not publish a failure.')
        },
        controller.signal,
        { onRecomputeStarted }
      )

      const result = generator.next()
      await firstRead.promise
      state.set('B')
      controller.abort()
      releaseTask.resolve()

      await expect(result).resolves.toMatchObject({ done: true })
      expect(onRecomputeStarted).not.toHaveBeenCalled()
    })

    it('should track multiple dependencies', async () => {
      const context = new ReactiveContext()
      const state1 = new ReactiveState('a')
      const state2 = new ReactiveState('b')

      const generator = context.stream(async () => `${state1.get()}-${state2.get()}`)
      const results: string[] = []

      // 获取第一个值
      results.push((await generator.next()).value)

      // 修改 state1
      state1.set('A')
      results.push((await generator.next()).value)

      // 修改 state2
      state2.set('B')
      results.push((await generator.next()).value)

      expect(results).toEqual(['a-b', 'A-b', 'A-B'])
    })

    it('should exit when no dependencies', async () => {
      const context = new ReactiveContext()
      let callCount = 0

      const generator = context.stream(async () => {
        callCount++
        return 'static'
      })

      const results: string[] = []
      for await (const item of generator) {
        results.push(item)
        // generator 会自动结束因为没有依赖
      }

      // 只执行一次，因为没有依赖
      expect(results).toEqual(['static'])
      expect(callCount).toBe(1)
    })

    it('should stop on abort signal', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')
      const controller = new AbortController()

      const generator = context.stream(async () => state.get(), controller.signal)

      // 获取第一个值
      await generator.next()

      // 中止
      controller.abort()

      // 下一次迭代应该结束（可能抛出 AbortError 或返回 done）
      try {
        const result = await generator.next()
        expect(result.done).toBe(true)
      } catch (e) {
        // AbortError 也是预期行为
        expect((e as Error).name).toBe('AbortError')
      }
    })

    it('should cleanup dependencies on each iteration', async () => {
      const context = new ReactiveContext()
      const state1 = new ReactiveState('a')
      const state2 = new ReactiveState('b')
      let useState2 = true

      const generator = context.stream(async () => {
        const v1 = state1.get()
        if (useState2) {
          return `${v1}-${state2.get()}`
        }
        return v1
      })

      // 第一次迭代，依赖 state1 和 state2
      await generator.next()

      // 第二次迭代，只依赖 state1
      useState2 = false
      state1.set('A')
      await generator.next()

      // 修改 state2 不应该触发更新
      const notified = vi.fn()
      context['changePromise'] = { resolve: notified, reject: vi.fn(), promise: Promise.resolve() }

      state2.set('B')
      // state2 已经不在依赖中，不应该触发
      // 注意：这里需要验证 state2 的订阅者中不包含 context
      expect(state2.subscriberCount).toBe(0)
    })

    it('should handle concurrent state changes', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState(0)
      const onRecomputeStarted = vi.fn()

      const generator = context.stream(async () => state.get(), undefined, { onRecomputeStarted })
      const results: number[] = []

      // 获取初始值
      results.push((await generator.next()).value)

      // 快速连续修改
      state.set(1)
      state.set(2)
      state.set(3)

      // 只会获取最新值
      results.push((await generator.next()).value)

      expect(results[0]).toBe(0)
      expect(results[1]).toBe(3)
      expect(onRecomputeStarted).toHaveBeenCalledTimes(1)
    })
  })

  describe('runOnce()', () => {
    it('should execute task once', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')

      const result = await context.runOnce(async () => state.get())

      expect(result).toBe('value')
    })

    it('should track dependencies', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')

      await context.runOnce(async () => state.get())

      // 验证依赖被追踪
      expect(state.subscriberCount).toBe(1)
    })

    it('should not re-execute on change', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('initial')
      let callCount = 0

      await context.runOnce(async () => {
        callCount++
        return state.get()
      })

      // 清理依赖以避免 unhandled rejection
      state.unsubscribe(context)

      state.set('changed')

      // 等待一下确保没有重新执行
      await new Promise((r) => setTimeout(r, 50))

      expect(callCount).toBe(1)
    })
  })

  describe('destroy behavior', () => {
    it('should cleanup all dependencies on stream end', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')
      const controller = new AbortController()

      const generator = context.stream(async () => state.get(), controller.signal)

      await generator.next()
      controller.abort()

      // 触发 finally（可能抛出 AbortError）
      try {
        await generator.next()
      } catch {
        // AbortError 是预期的
      }

      // 验证依赖已清理
      expect(context['dependencies'].size).toBe(0)
      expect(context['destroyed']).toBe(true)
    })

    it('should clear changePromise on destroy', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')
      const controller = new AbortController()

      const generator = context.stream(async () => state.get(), controller.signal)

      await generator.next()

      // 验证 changePromise 存在
      expect(context['changePromise']).toBeDefined()

      controller.abort()

      // 触发 finally（可能抛出 AbortError）
      try {
        await generator.next()
      } catch {
        // AbortError 是预期的
      }

      // changePromise 应该被清除
      expect(context['changePromise']).toBeUndefined()
    })
  })

  describe('waitForAbort()', () => {
    it('should reject immediately if already aborted', async () => {
      const context = new ReactiveContext()
      const controller = new AbortController()
      controller.abort()

      await expect(context['waitForAbort'](controller.signal)).rejects.toThrow('Aborted')
    })

    it('should reject when signal aborts', async () => {
      const context = new ReactiveContext()
      const controller = new AbortController()

      const promise = context['waitForAbort'](controller.signal)

      setTimeout(() => controller.abort(), 10)

      await expect(promise).rejects.toThrow('Aborted')
    })
  })

  describe('integration scenarios', () => {
    it('should handle nested context runs', async () => {
      const outerContext = new ReactiveContext()
      const innerContext = new ReactiveContext()
      const state = new ReactiveState('value')

      let outerValue: string | undefined
      let innerValue: string | undefined

      await contextStorage.run(outerContext, async () => {
        outerValue = state.get()

        await contextStorage.run(innerContext, async () => {
          innerValue = state.get()
        })
      })

      expect(outerValue).toBe('value')
      expect(innerValue).toBe('value')

      // 两个 context 都应该追踪了 state
      expect(state.subscriberCount).toBe(2)
    })

    it('should handle async task with multiple awaits', async () => {
      const context = new ReactiveContext()
      const state1 = new ReactiveState('a')
      const state2 = new ReactiveState('b')

      const generator = context.stream(async () => {
        const v1 = state1.get()
        await new Promise((r) => setTimeout(r, 10))
        const v2 = state2.get()
        return `${v1}-${v2}`
      })

      const result = await generator.next()
      expect(result.value).toBe('a-b')

      // 两个状态都应该被追踪
      expect(state1.subscriberCount).toBe(1)
      expect(state2.subscriberCount).toBe(1)
    })

    it('should handle error in task', async () => {
      const context = new ReactiveContext()
      const state = new ReactiveState('value')

      const generator = context.stream(async () => {
        state.get()
        throw new Error('Task error')
      })

      await expect(generator.next()).rejects.toThrow('Task error')

      // context 应该被销毁
      expect(context['destroyed']).toBe(true)
    })
  })
})
