import type { AIProvider, CompletionOptions, CompletionResponse, StreamChunk, APIProviderConfig } from './types.js'

/**
 * API-based AI provider (OpenAI ChatCompletion compatible)
 */
export class APIProvider implements AIProvider {
  readonly name: string
  readonly type = 'api' as const

  constructor(private config: APIProviderConfig) {
    this.name = config.name
  }

  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API request failed: ${response.status} ${error}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    return {
      content: data.choices[0]?.message?.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  }

  async *completeStream(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API request failed: ${response.status} ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            yield { content: '', done: true }
            return
          }

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{ delta?: { content?: string }; finish_reason?: string }>
            }
            const content = parsed.choices[0]?.delta?.content ?? ''
            const isDone = parsed.choices[0]?.finish_reason === 'stop'

            if (content || isDone) {
              yield { content, done: isDone }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
          ...this.config.headers,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }
}
