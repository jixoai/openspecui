import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReactiveState, contextStorage } from './reactive-state.js'
import { ReactiveContext } from './reactive-context.js'

describe('ReactiveState', () => {
  describe('基础功能', () => {
    it('should create state with initial value', () => {
      const state = new ReactiveState('hello')
      expect(state.get()).toBe('hello')
    })

    it('should return current value on get()', () => {
      const state = new ReactiveState(42)
      expect(state.get()).toBe(42)
      expect(state.get()).toBe(42) // 多次调用返回相同值
    })

    it('should update value on set()', () => {
      const state = new ReactiveState('initial')
      state.set('updated')
      expect(state.get()).toBe('updated')
    })

    it('should return true when value changes', () => {
      const state = new ReactiveState('a')
      expect(state.set('b')).toBe(true)
    })

    it('should return false when value is equal', () => {
      const state = new ReactiveState('same')
      expect(state.set('same')).toBe(false)
    })
  })

  describe('自定义相等性', () => {
    it('should use custom equals function', () => {
      const state = new ReactiveState(
        { id: 1, name: 'test' },
        { equals: (a, b) => a.id === b.id }
      )

      // 相同 id，不同 name，应该被认为相等
      expect(state.set({ id: 1, name: 'different' })).toBe(false)

      // 不同 id，应该被认为不相等
      expect(state.set({ id: 2, name: 'test' })).toBe(true)
    })

    it('should handle array comparison', () => {
      const arrayEquals = (a: string[], b: string[]) =>
        a.length === b.length && a.every((v, i) => v === b[i])

      const state = new ReactiveState(['a', 'b'], { equals: arrayEquals })

      // 相同内容的数组
      expect(state.set(['a', 'b'])).toBe(false)

      // 不同内容的数组
      expect(state.set(['a', 'c'])).toBe(true)
    })

    it('should handle object deep comparison', () => {
      const deepEquals = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

      const state = new ReactiveState({ nested: { value: 1 } }, { equals: deepEquals })

      expect(state.set({ nested: { value: 1 } })).toBe(false)
      expect(state.set({ nested: { value: 2 } })).toBe(true)
    })
  })

  describe('订阅机制', () => {
    it('should track dependency when get() called in context', async () => {
      const state = new ReactiveState('value')
      const context = new ReactiveContext()

      // 在 context 中调用 get()
      await contextStorage.run(context, async () => {
        state.get()
      })

      // 验证 context 追踪了这个 state
      const notified = vi.fn()
      context['changePromise'] = { resolve: notified, reject: vi.fn(), promise: Promise.resolve() }

      state.set('new value')
      expect(notified).toHaveBeenCalled()
    })

    it('should not track when get() called outside context', () => {
      const state = new ReactiveState('value')

      // 在 context 外调用 get()
      state.get()

      // 没有 context，不应该有订阅者
      // 这里我们通过检查 set 不会抛出错误来验证
      expect(() => state.set('new value')).not.toThrow()
    })

    it('should notify all subscribers on change', async () => {
      const state = new ReactiveState('initial')
      const context1 = new ReactiveContext()
      const context2 = new ReactiveContext()

      const notified1 = vi.fn()
      const notified2 = vi.fn()

      // 两个 context 都订阅
      await contextStorage.run(context1, async () => {
        state.get()
      })
      context1['changePromise'] = { resolve: notified1, reject: vi.fn(), promise: Promise.resolve() }

      await contextStorage.run(context2, async () => {
        state.get()
      })
      context2['changePromise'] = { resolve: notified2, reject: vi.fn(), promise: Promise.resolve() }

      // 修改值
      state.set('changed')

      // 两个订阅者都应该被通知
      expect(notified1).toHaveBeenCalled()
      expect(notified2).toHaveBeenCalled()
    })

    it('should remove subscriber on unsubscribe()', async () => {
      const state = new ReactiveState('value')
      const context = new ReactiveContext()

      await contextStorage.run(context, async () => {
        state.get()
      })

      // 取消订阅
      state.unsubscribe(context)

      const notified = vi.fn()
      context['changePromise'] = { resolve: notified, reject: vi.fn(), promise: Promise.resolve() }

      state.set('new value')
      expect(notified).not.toHaveBeenCalled()
    })

    it('should handle multiple subscribers', async () => {
      const state = new ReactiveState(0)
      const contexts: ReactiveContext[] = []
      const notifiers: ReturnType<typeof vi.fn>[] = []

      // 创建 5 个订阅者
      for (let i = 0; i < 5; i++) {
        const context = new ReactiveContext()
        contexts.push(context)

        await contextStorage.run(context, async () => {
          state.get()
        })

        const notified = vi.fn()
        notifiers.push(notified)
        context['changePromise'] = { resolve: notified, reject: vi.fn(), promise: Promise.resolve() }
      }

      // 修改值
      state.set(1)

      // 所有订阅者都应该被通知
      notifiers.forEach((notified) => {
        expect(notified).toHaveBeenCalled()
      })
    })
  })

  describe('AsyncLocalStorage 集成', () => {
    it('should access context via AsyncLocalStorage', async () => {
      const state = new ReactiveState('test')
      const context = new ReactiveContext()

      let contextInside: ReactiveContext | undefined

      await contextStorage.run(context, async () => {
        contextInside = contextStorage.getStore()
        state.get()
      })

      expect(contextInside).toBe(context)
    })

    it('should handle nested contexts', async () => {
      const state = new ReactiveState('value')
      const outerContext = new ReactiveContext()
      const innerContext = new ReactiveContext()

      const outerNotified = vi.fn()
      const innerNotified = vi.fn()

      await contextStorage.run(outerContext, async () => {
        state.get() // outer 订阅

        await contextStorage.run(innerContext, async () => {
          state.get() // inner 也订阅
        })
      })

      outerContext['changePromise'] = {
        resolve: outerNotified,
        reject: vi.fn(),
        promise: Promise.resolve(),
      }
      innerContext['changePromise'] = {
        resolve: innerNotified,
        reject: vi.fn(),
        promise: Promise.resolve(),
      }

      state.set('new')

      expect(outerNotified).toHaveBeenCalled()
      expect(innerNotified).toHaveBeenCalled()
    })

    it('should isolate contexts in parallel async calls', async () => {
      const state1 = new ReactiveState('s1')
      const state2 = new ReactiveState('s2')
      const context1 = new ReactiveContext()
      const context2 = new ReactiveContext()

      // 并行执行两个 context
      await Promise.all([
        contextStorage.run(context1, async () => {
          state1.get() // context1 只订阅 state1
        }),
        contextStorage.run(context2, async () => {
          state2.get() // context2 只订阅 state2
        }),
      ])

      const notified1 = vi.fn()
      const notified2 = vi.fn()

      context1['changePromise'] = { resolve: notified1, reject: vi.fn(), promise: Promise.resolve() }
      context2['changePromise'] = { resolve: notified2, reject: vi.fn(), promise: Promise.resolve() }

      // 修改 state1，只有 context1 被通知
      state1.set('new s1')
      expect(notified1).toHaveBeenCalled()
      expect(notified2).not.toHaveBeenCalled()

      notified1.mockClear()
      notified2.mockClear()

      // 修改 state2，只有 context2 被通知
      state2.set('new s2')
      expect(notified1).not.toHaveBeenCalled()
      expect(notified2).toHaveBeenCalled()
    })
  })

  describe('边界条件', () => {
    it('should handle undefined initial value', () => {
      const state = new ReactiveState<string | undefined>(undefined)
      expect(state.get()).toBeUndefined()

      state.set('defined')
      expect(state.get()).toBe('defined')

      state.set(undefined)
      expect(state.get()).toBeUndefined()
    })

    it('should handle null value', () => {
      const state = new ReactiveState<string | null>(null)
      expect(state.get()).toBeNull()

      state.set('not null')
      expect(state.get()).toBe('not null')

      state.set(null)
      expect(state.get()).toBeNull()
    })

    it('should handle concurrent set() calls', () => {
      const state = new ReactiveState(0)

      // 并发设置多个值
      state.set(1)
      state.set(2)
      state.set(3)

      // 最终值应该是最后设置的
      expect(state.get()).toBe(3)
    })

    it('should not notify when setting equal value', async () => {
      const state = new ReactiveState('same')
      const context = new ReactiveContext()

      await contextStorage.run(context, async () => {
        state.get()
      })

      const notified = vi.fn()
      context['changePromise'] = { resolve: notified, reject: vi.fn(), promise: Promise.resolve() }

      // 设置相同的值
      state.set('same')

      expect(notified).not.toHaveBeenCalled()
    })
  })
})
