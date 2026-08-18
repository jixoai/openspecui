/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Provide one clipboard writer with an execCommand fallback for non-secure contexts.
 *
 * Original request (2026-08-19): "RUN IT 这里也需要支持点击复制" — shared by hero CTA, surface commands, and run-it commands.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    try {
      document.execCommand('copy')
    } catch {
      /* clipboard unavailable without permissions */
    }
    area.remove()
  }
}
