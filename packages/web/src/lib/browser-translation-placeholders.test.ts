import type { ElementContent } from 'hast'
import { describe, expect, it } from 'vitest'
import {
  createTranslationPlaceholderProtocol,
  restoreTranslatedPlaceholderFragment,
} from './browser-translation-placeholders'

describe('browser translation placeholders', () => {
  it('keeps code-like element source text visible and stores translated text as hover metadata', () => {
    const protocol = createTranslationPlaceholderProtocol([
      text('Press '),
      element('code', [text('Config')]),
      text(', '),
      element('kbd', [text('Enter')]),
      text(', and read '),
      element('samp', [text('stdout')]),
      text('.'),
    ])

    expect(protocol.translatorInput).toBe(
      'Press <x1>Config</x1>, <x2>Enter</x2>, and read <x3>stdout</x3>.'
    )

    const restored = restoreTranslatedPlaceholderFragment(
      '按 <x1>配置</x1>，<x2>回车</x2>，并读取 <x3>标准输出</x3>。',
      protocol
    )

    expect(findElement(restored.targetNodes, 'code')).toMatchObject({
      properties: { title: '配置' },
      children: [{ type: 'text', value: 'Config' }],
    })
    expect(findElement(restored.targetNodes, 'kbd')).toMatchObject({
      properties: { title: '回车' },
      children: [{ type: 'text', value: 'Enter' }],
    })
    expect(findElement(restored.targetNodes, 'samp')).toMatchObject({
      properties: { title: '标准输出' },
      children: [{ type: 'text', value: 'stdout' }],
    })
    expect(restored.target).toBe('按 Config，Enter，并读取 stdout。')
  })
})

function text(value: string): ElementContent {
  return { type: 'text', value }
}

function element(tagName: string, children: ElementContent[]): ElementContent {
  return {
    type: 'element',
    tagName,
    properties: {},
    children,
  }
}

function findElement(
  nodes: readonly ElementContent[],
  tagName: string
): ElementContent | undefined {
  return nodes.find((node) => node.type === 'element' && node.tagName === tagName)
}
