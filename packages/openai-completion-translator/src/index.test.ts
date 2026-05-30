import { describe, expect, it, vi } from 'vitest'

const chatMock = vi.hoisted(() => vi.fn())
const createModelMock = vi.hoisted(() =>
  vi.fn((name: string, input: readonly string[]) => ({ name, input }))
)
const extendAdapterMock = vi.hoisted(() =>
  vi.fn(
    (factory) => (model: string, config: { apiKey: string; baseURL: string }) =>
      factory(model, config)
  )
)
const createOpenaiChatCompletionsMock = vi.hoisted(() =>
  vi.fn((model: string, apiKey: string, config: { baseURL?: string }) => ({
    kind: 'text',
    model,
    apiKey,
    baseURL: config.baseURL,
  }))
)

vi.mock('@tanstack/ai', () => ({
  chat: chatMock,
  createModel: createModelMock,
  extendAdapter: extendAdapterMock,
}))

vi.mock('@tanstack/ai-openai', () => ({
  createOpenaiChatCompletions: createOpenaiChatCompletionsMock,
}))

describe('openai completion translator package', () => {
  it('requires a token before creating a translator', async () => {
    const { createOpenAICompletionTranslatorFactory } = await import('./index.js')

    await expect(
      createOpenAICompletionTranslatorFactory({
        baseUrl: '',
        token: '',
        model: 'custom-model',
      }).create({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      })
    ).rejects.toThrow('OpenAI completion translator token is required.')
  })

  it('uses TanStack AI chat with batch translation and custom model support', async () => {
    chatMock.mockResolvedValueOnce('你好')
    const { createOpenAICompletionTranslatorFactory } = await import('./index.js')
    const translator = await createOpenAICompletionTranslatorFactory({
      baseUrl: 'https://api.example.com/v1/',
      token: 'secret-token',
      model: 'vendor/custom-model',
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })

    const outputs: Array<{
      index: number
      output?: string
      error?: { kind: string; message: string }
    }> = []
    for await (const item of translator.batchTranslate(['<x1>Hello</x1>'], {
      instructions: 'Keep xN tags.',
      context: '# Proposal',
    })) {
      outputs.push(item)
    }
    expect(outputs).toEqual([{ index: 0, output: '你好' }])

    expect(createModelMock).toHaveBeenCalledWith('vendor/custom-model', ['text'])
    expect(createOpenaiChatCompletionsMock).toHaveBeenCalledWith(
      'vendor/custom-model',
      'secret-token',
      expect.objectContaining({
        apiKey: 'secret-token',
        baseURL: 'https://api.example.com/v1',
      })
    )
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: false,
        temperature: 0,
        systemPrompts: [expect.stringContaining('Translate from en to zh.')],
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('<source>\n<x1>Hello</x1>\n</source>'),
          }),
        ],
      })
    )
  })

  it('surfaces per-input timeout failures for OpenAI translation tasks', async () => {
    chatMock.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('你好'), 20)
        })
    )
    const { createOpenAICompletionTranslatorFactory } = await import('./index.js')
    const translator = await createOpenAICompletionTranslatorFactory({
      baseUrl: 'https://api.example.com/v1/',
      token: 'secret-token',
      model: 'vendor/custom-model',
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })

    const outputs = []
    for await (const item of translator.batchTranslate(['Hello'], { timeoutMs: 1 })) {
      outputs.push(item)
    }

    expect(outputs).toEqual([
      {
        index: 0,
        error: {
          kind: 'timeout',
          message: 'Translation task timed out after 1ms.',
        },
      },
    ])
  })
})
