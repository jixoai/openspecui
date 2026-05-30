import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  createManagedLocalBatchTranslateWorkerExecutor,
  type ManagedLocalTranslationChildProcess,
  type ManagedLocalTranslationWorkerMessage,
} from './translation-engine-worker.js'

class FakeTranslationChildProcess
  extends EventEmitter
  implements ManagedLocalTranslationChildProcess
{
  pid = 12345
  sentMessages: unknown[] = []
  killedSignals: Array<NodeJS.Signals | undefined> = []

  send(message: unknown): boolean {
    this.sentMessages.push(message)
    return true
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.killedSignals.push(signal)
    return true
  }
}

describe('managed local translation process host', () => {
  it('turns child process crashes into per-item runtime failures', async () => {
    const child = new FakeTranslationChildProcess()
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: () => child,
    })
    const eventsPromise = collectAsyncGenerator(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello', 'World'],
        signal: new AbortController().signal,
      })
    )

    child.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
    child.emit('exit', 134, null)

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'runtime',
          message: 'Translation engine process exited unexpectedly with exit code 134.',
        },
      },
      {
        index: 1,
        error: {
          kind: 'runtime',
          message: 'Translation engine process exited unexpectedly with exit code 134.',
        },
      },
    ])
    expect(child.sentMessages[0]).toMatchObject({
      engineId: 'local-llama',
      cacheDir: '/tmp/local-llama',
    })
  })

  it('turns child process IPC disconnects into per-item runtime failures', async () => {
    const child = new FakeTranslationChildProcess()
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: () => child,
    })
    const eventsPromise = collectAsyncGeneratorWithTimeout(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello', 'World'],
        signal: new AbortController().signal,
      })
    )

    child.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
    child.emit('disconnect')

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'runtime',
          message: 'Translation engine process IPC disconnected unexpectedly.',
        },
      },
      {
        index: 1,
        error: {
          kind: 'runtime',
          message: 'Translation engine process IPC disconnected unexpectedly.',
        },
      },
    ])
  })

  it('turns child process close events into per-item runtime failures', async () => {
    const child = new FakeTranslationChildProcess()
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: () => child,
    })
    const eventsPromise = collectAsyncGeneratorWithTimeout(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello'],
        signal: new AbortController().signal,
      })
    )

    child.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
    child.emit('close', 134, null)

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'runtime',
          message: 'Translation engine process closed unexpectedly with exit code 134.',
        },
      },
    ])
  })

  it('turns child process spawn errors before ready into per-item runtime failures', async () => {
    const child = new FakeTranslationChildProcess()
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: () => child,
    })
    const eventsPromise = collectAsyncGeneratorWithTimeout(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello'],
        signal: new AbortController().signal,
      })
    )

    child.emit('error', new Error('spawn node ENOENT'))

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'runtime',
          message: 'spawn node ENOENT',
        },
      },
    ])
  })

  it('creates a fresh child process for the next batch after a process failure', async () => {
    const firstChild = new FakeTranslationChildProcess()
    const secondChild = new FakeTranslationChildProcess()
    const processHosts = [firstChild, secondChild]
    const createProcessHost = vi.fn(() => {
      const next = processHosts.shift()
      if (!next) throw new Error('Unexpected extra process host creation.')
      return next
    })
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost,
    })

    const firstEventsPromise = collectAsyncGeneratorWithTimeout(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello'],
        signal: new AbortController().signal,
      })
    )
    firstChild.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
    firstChild.emit('exit', 134, null)
    await expect(firstEventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'runtime',
          message: 'Translation engine process exited unexpectedly with exit code 134.',
        },
      },
    ])

    const secondEventsPromise = collectAsyncGeneratorWithTimeout(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['World'],
        signal: new AbortController().signal,
      })
    )
    secondChild.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
    secondChild.emit('message', {
      type: 'event',
      event: { index: 0, output: '世界' },
    } satisfies ManagedLocalTranslationWorkerMessage)
    secondChild.emit('message', { type: 'complete' } satisfies ManagedLocalTranslationWorkerMessage)

    await expect(secondEventsPromise).resolves.toEqual([{ index: 0, output: '世界' }])
    expect(createProcessHost).toHaveBeenCalledTimes(2)
    expect(firstChild).not.toBe(secondChild)
  })

  it('passes process heap flags and kills the child when RSS exceeds budget', async () => {
    const child = new FakeTranslationChildProcess()
    let capturedExecArgv: string[] = []
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: (input) => {
        capturedExecArgv = input.execArgv
        return child
      },
      readProcessRssMb: vi.fn(async () => 512),
      rssPollIntervalMs: 1,
    })
    const eventsPromise = collectAsyncGenerator(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello'],
        signal: new AbortController().signal,
        workerResourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 64,
          codeRangeSizeMb: 128,
          maxRssMb: 128,
        },
      })
    )

    child.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'memory-limit',
          message: 'Translation process exceeded memory limit: 512MB > 128MB.',
        },
      },
    ])
    expect(capturedExecArgv).toContain('--max-old-space-size=256')
    expect(capturedExecArgv).toContain('--max-semi-space-size=64')
    expect(child.killedSignals).toContain('SIGKILL')
  })
})

async function collectAsyncGenerator<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of generator) {
    items.push(item)
  }
  return items
}

async function collectAsyncGeneratorWithTimeout<T>(
  generator: AsyncGenerator<T>,
  timeoutMs = 50
): Promise<T[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      collectAsyncGenerator(generator),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Timed out waiting for process host.')),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
