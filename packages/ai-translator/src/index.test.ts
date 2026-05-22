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

describe('AI translator package', () => {
  it('requires a token before creating a translator', async () => {
    const { createAiTranslatorFactory } = await import('./index.js')

    await expect(
      createAiTranslatorFactory({ baseUrl: '', token: '', model: 'custom-model' }).create({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      })
    ).rejects.toThrow('AI translator token is required.')
  })

  it('uses TanStack AI chat with rich translation input and custom model support', async () => {
    chatMock.mockResolvedValueOnce('你好')
    const { createAiTranslatorFactory } = await import('./index.js')
    const translator = await createAiTranslatorFactory({
      baseUrl: 'https://api.example.com/v1/',
      token: 'secret-token',
      model: 'vendor/custom-model',
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })

    await expect(
      translator.translate({
        instructions: 'Keep xN tags.',
        context: '# Proposal',
        source: '<x1>Hello</x1>',
      })
    ).resolves.toBe('你好')

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
})
